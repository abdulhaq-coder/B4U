import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './otp.service';
import { SessionMeta, TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
    private readonly mail: MailService,
  ) {}

  async requestOtp(email: string) {
    const code = await this.otp.issue(email);
    await this.mail.sendOtp(email, code);
    // Generic response prevents email enumeration
    return { message: 'If the email is valid, a verification code has been sent.' };
  }

  async verifyOtp(dto: VerifyOtpDto, meta: SessionMeta) {
    await this.otp.verify(dto.email, dto.code);

    const user = await this.users.findOrCreateVerified(dto.email);
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is suspended');
    }

    const tokens = await this.tokens.issueSession(user, meta);
    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      ...tokens,
    };
  }

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
}

