import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, SocialProvider, User, UserStatus } from '@prisma/client';
import { UsersService } from '../../users/users.service';
import { buildAuthResponse } from '../auth-response.util';
import { SocialLoginDto } from '../dto/social-login.dto';
import { SessionMeta, TokenService } from '../token.service';
import { AppleVerifier } from './apple.verifier';
import { GoogleVerifier } from './google.verifier';
import { SocialProfile } from './social-profile.interface';

const wrongApp = () =>
  new ForbiddenException({ code: 'WRONG_APP', message: 'This account cannot be used in this app' });

function pickName(name: string | null | undefined, email: string): string {
  const cleaned = (name ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (/^[\p{L}][\p{L}\p{M}.'\- ]{1,79}$/u.test(cleaned)) return cleaned;
  const local = email.split('@')[0].replace(/[^\p{L}]+/gu, ' ').trim();
  return (local || 'User').slice(0, 80);
}

@Injectable()
export class SocialAuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly google: GoogleVerifier,
    private readonly apple: AppleVerifier,
  ) {}

  async login(provider: SocialProvider, dto: SocialLoginDto, meta: SessionMeta) {
    const profile =
      provider === SocialProvider.GOOGLE
        ? await this.google.verify(dto.idToken, dto.nonce)
        : await this.apple.verify(dto.idToken, dto.nonce);

    const user =
      (await this.users.findBySocial(profile.provider, profile.providerUserId)) ??
      (await this.registerOrLink(profile, dto));

    if (user.role !== dto.role) throw wrongApp();
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException({ code: 'ACCOUNT_SUSPENDED', message: 'Account is suspended' });
    }

    const tokens = await this.tokens.issueSession(user, meta);
    return buildAuthResponse(user, tokens);
  }

  private async registerOrLink(profile: SocialProfile, dto: SocialLoginDto): Promise<User> {
    if (!profile.email || !profile.emailVerified) {
      throw new BadRequestException({
        code: 'SOCIAL_EMAIL_UNAVAILABLE',
        message: 'This account does not provide a verified email address',
      });
    }

    const fullName = pickName(profile.name ?? dto.fullName, profile.email);
    const existing = await this.users.findByEmail(profile.email);

    // Active account kisi aur role ka ho to link nahi karte
    if (existing && existing.status !== UserStatus.PENDING_VERIFICATION && existing.role !== dto.role) {
      throw wrongApp();
    }

    const base = {
      provider: profile.provider,
      providerUserId: profile.providerUserId,
      email: profile.email,
      fullName,
      role: dto.role,
    };

    try {
      return existing
        ? await this.users.linkSocial(existing, base)
        : await this.users.createFromSocial(base);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Please try again');
      }
      throw e;
    }
  }
}

