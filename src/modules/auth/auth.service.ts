import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OtpPurpose, Prisma, Role, User, UserStatus } from '@prisma/client';
import { ageInYears, parseIsoDate } from '../../common/utils/date.util';
import { toE164 } from '../../common/utils/phone.util';
import { LocationsService } from '../locations/locations.service';
import { MailService } from '../mail/mail.service';
import { MediaService } from '../media/media.service';
import { nextStepFor, toPublicUser } from '../users/user.mapper';
import { UsersService } from '../users/users.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthTokens, AuthUser } from './interfaces/jwt-payload.interface';
import { OtpService } from './otp.service';
import { PasswordService } from './password.service';
import { SessionMeta, TokenService } from './token.service';

const MIN_AGE: Partial<Record<Role, number>> = { CUSTOMER: 13, OWNER: 18 };
const DEFAULT_MIN_AGE = 18;
const MAX_AGE = 100;

@Injectable()
export class AuthService {
  constructor(
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly passwords: PasswordService,
    private readonly locations: LocationsService,
    private readonly media: MediaService,
  ) {}

  // ---------- Register + email verification ----------

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);

    if (existing && existing.status !== UserStatus.PENDING_VERIFICATION) {
      throw new ConflictException('This email is already registered');
    }
    // Active code ke dauran koi doosra pending signup overwrite nahi kar sakta
    if (existing && (await this.otp.hasActive(dto.email, OtpPurpose.EMAIL_VERIFICATION))) {
      throw new ConflictException('A verification code was already sent. Check your email or request a new one.');
    }

    const passwordHash = await this.passwords.hash(dto.password);
    const data = { fullName: dto.fullName, passwordHash, role: dto.role };

    try {
      if (existing) await this.users.updatePending(existing.id, data);
      else await this.users.createPending({ email: dto.email, ...data });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('This email is already registered');
      }
      throw e;
    }

    await this.sendVerificationCode(dto.email);
    return { message: 'Verification code sent to your email', email: dto.email };
  }

  async resendOtp(email: string) {
    const user = await this.users.findByEmail(email);
    if (user?.status === UserStatus.PENDING_VERIFICATION) {
      await this.sendVerificationCode(email);
    }
    return { message: 'If a pending registration exists, a new code has been sent.' };
  }

  async verifyEmail(dto: VerifyOtpDto, meta: SessionMeta) {
    await this.otp.verify(dto.email, OtpPurpose.EMAIL_VERIFICATION, dto.code);

    const user = await this.users.findByEmail(dto.email);
    if (!user || user.status !== UserStatus.PENDING_VERIFICATION) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const verified = await this.users.markVerified(user.id);
    const tokens = await this.tokens.issueSession(verified, meta);
    return this.buildAuthResponse(verified, tokens);
  }

  // ---------- Login ----------

  async login(dto: LoginDto, meta: SessionMeta) {
    const invalid = () => new UnauthorizedException('Email or password is incorrect');
    const user = await this.users.findByEmail(dto.email);

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException(
        'Too many failed attempts. Please try again in a few minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let valid = false;
    if (user?.passwordHash) valid = await this.passwords.verify(user.passwordHash, dto.password);
    else await this.passwords.verifyDummy(dto.password);

    if (!user || !valid) {
      if (user) await this.users.registerFailedLogin(user.id);
      throw invalid();
    }

    // Password sahi sabit ho chuka, ab specific errors batana safe hai
    if (user.role !== dto.role) {
      throw new ForbiddenException({ code: 'WRONG_APP', message: 'This account cannot be used in this app' });
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException({ code: 'ACCOUNT_SUSPENDED', message: 'Account is suspended' });
    }
    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email' });
    }

    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.users.resetLoginFailures(user.id);
    }

    const tokens = await this.tokens.issueSession(user, meta);
    return this.buildAuthResponse(user, tokens);
  }

  // ---------- Profile ----------

  async completeProfile(authUser: AuthUser, dto: CompleteProfileDto) {
    const user = await this.users.findById(authUser.id);
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException();
    if (user.profileCompletedAt) throw new ConflictException('Profile is already completed');

    const dob = parseIsoDate(dto.dateOfBirth);
    if (!dob) throw new BadRequestException('dateOfBirth must be a valid date (YYYY-MM-DD)');

    const age = ageInYears(dob);
    const minAge = MIN_AGE[user.role] ?? DEFAULT_MIN_AGE;
    if (age > MAX_AGE) throw new BadRequestException('dateOfBirth is invalid');
    if (age < minAge) throw new BadRequestException(`You must be at least ${minAge} years old`);

    const city = await this.locations.findCity(dto.cityId);
    if (!city || !city.isActive || city.countryCode !== dto.countryCode) {
      throw new BadRequestException('Selected city is not valid for this country');
    }

    const phone = toE164(dto.phone, dto.countryCode);
    if (!phone) throw new BadRequestException('Phone number is invalid');

    if (dto.avatarId) await this.media.setAvatar(user.id, dto.avatarId);

    const updated = await this.users.completeProfile(user.id, {
      dateOfBirth: dob,
      phone,
      gender: dto.gender,
      countryCode: dto.countryCode,
      cityId: city.id,
    });

    // Naya access token (pc=true) taake client ko dobara login na karna pade
    const accessToken = await this.tokens.issueAccessToken(updated, authUser.sessionId);
    return { user: toPublicUser(updated), accessToken, nextStep: nextStepFor(updated) };
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return { user: toPublicUser(user), nextStep: nextStepFor(user) };
  }

  // ---------- Tokens / sessions ----------

  refresh(refreshToken: string) {
    return this.tokens.rotate(refreshToken);
  }

  async logout(sessionId: string) {
    await this.tokens.revokeSession(sessionId);
    return { message: 'Logged out' };
  }

  async logoutAll(userId: string) {
    await this.tokens.revokeAll(userId);
    return { message: 'Logged out from all devices' };
  }

  // ---------- helpers ----------

  private async sendVerificationCode(email: string) {
    const code = await this.otp.issue(email, OtpPurpose.EMAIL_VERIFICATION);
    await this.mail.sendOtp(email, code, OtpPurpose.EMAIL_VERIFICATION);
  }

  private buildAuthResponse(user: User, tokens: AuthTokens) {
    return { user: toPublicUser(user), ...tokens, nextStep: nextStepFor(user) };
  }
}
