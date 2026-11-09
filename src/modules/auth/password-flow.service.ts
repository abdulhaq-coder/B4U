import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OtpPurpose, UserStatus } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { nextStepFor, toPublicUser } from '../users/user.mapper';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { AuthUser } from './interfaces/jwt-payload.interface';
import { OtpService } from './otp.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Injectable()
export class PasswordFlowService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
    private readonly passwords: PasswordService,
  ) {}

  /** Hamesha same response: email registered hai ya nahi, pata nahi chalta. */
  async forgot(email: string) {
    const generic = { message: 'If an account exists for this email, a reset code has been sent.' };

    const user = await this.users.findByEmail(email);
    if (!user || user.status !== UserStatus.ACTIVE) return generic;

    try {
      const code = await this.otp.issue(email, OtpPurpose.PASSWORD_RESET);
      await this.mail.sendOtp(email, code, OtpPurpose.PASSWORD_RESET);
    } catch (e) {
      // Cooldown ka error bhi chhupao, warna account ka pata chal jata hai
      const cooldown = e instanceof HttpException && e.getStatus() === HttpStatus.TOO_MANY_REQUESTS;
      if (!cooldown) throw e;
    }
    return generic;
  }

  async reset(dto: ResetPasswordDto) {
    await this.otp.verify(dto.email, OtpPurpose.PASSWORD_RESET, dto.code);

    const user = await this.users.findByEmail(dto.email);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.users.updatePassword(user.id, await this.passwords.hash(dto.password));
    await this.tokens.revokeAll(user.id); // purane sab sessions band
    return { message: 'Password updated. Please log in with your new password.' };
  }

  async change(authUser: AuthUser, dto: ChangePasswordDto) {
    const user = await this.users.findById(authUser.id);
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException();

    if (!user.passwordHash) {
      throw new ConflictException({ code: 'PASSWORD_NOT_SET', message: 'Set a password first' });
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException('Too many failed attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const ok = await this.passwords.verify(user.passwordHash, dto.currentPassword);
    if (!ok) {
      await this.users.registerFailedLogin(user.id); // chori hue token se brute force na ho
      throw new BadRequestException({ code: 'WRONG_PASSWORD', message: 'Current password is incorrect' });
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from the current one');
    }

    await this.users.updatePassword(user.id, await this.passwords.hash(dto.newPassword));
    await this.tokens.revokeOtherSessions(user.id, authUser.sessionId);
    return { message: 'Password changed. Other devices have been logged out.' };
  }

  /** Social login wale user ke liye pehli baar password set karna. */
  async set(authUser: AuthUser, dto: SetPasswordDto) {
    const user = await this.users.setInitialPassword(authUser.id, await this.passwords.hash(dto.password));
    if (!user) {
      throw new ConflictException({ code: 'PASSWORD_ALREADY_SET', message: 'Password is already set' });
    }

    const accessToken = await this.tokens.issueAccessToken(user, authUser.sessionId);
    return { user: toPublicUser(user), accessToken, nextStep: nextStepFor(user) };
  }
}

