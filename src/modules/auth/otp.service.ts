import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.secret = config.get('OTP_SECRET', { infer: true });
  }

  /** Issues a new 6-digit OTP, expires previous unconsumed OTPs for this email */
  async issue(email: string): Promise<string> {
    const last = await this.prisma.otpCode.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });
    if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new HttpException('Please wait before requesting another code', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

    await this.prisma.$transaction([
      this.prisma.otpCode.updateMany({
        where: { email, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.otpCode.create({
        data: {
          email,
          codeHash: this.hash(email, code),
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      }),
    ]);

    return code;
  }

  /** Verifies OTP, checks attempts and expiration, consumes atomically */
  async verify(email: string, code: string): Promise<void> {
    const record = await this.prisma.otpCode.findFirst({
      where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.attempts >= MAX_ATTEMPTS) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const expected = Buffer.from(record.codeHash);
    const actual = Buffer.from(this.hash(email, code));
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid or expired code');
    }

    // Atomic consume
    const res = await this.prisma.otpCode.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (res.count === 0) {
      throw new UnauthorizedException('Invalid or expired code');
    }
  }

  private hash(email: string, code: string): string {
    return createHmac('sha256', this.secret).update(`${email}:${code}`).digest('hex');
  }
}

