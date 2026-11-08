import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthTokens, JwtPayload, RefreshPayload } from './interfaces/jwt-payload.interface';
import { isOnboarded } from '../users/user.mapper';

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

type TokenUser = Pick<User, 'id' | 'role' | 'profileCompletedAt' | 'passwordHash'>;

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.accessSecret = config.get('JWT_ACCESS_SECRET', { infer: true });
    this.refreshSecret = config.get('JWT_REFRESH_SECRET', { infer: true });
    this.accessTtl = config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
    this.refreshTtl = config.get('JWT_REFRESH_TTL_DAYS', { infer: true }) * 86_400;
  }

  async issueSession(user: TokenUser, meta: SessionMeta): Promise<AuthTokens> {
    const sessionId = randomUUID();
    const refreshToken = await this.signRefresh(user.id, sessionId);

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.hash(refreshToken),
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 255),
        expiresAt: new Date(Date.now() + this.refreshTtl * 1000),
      },
    });

    return { accessToken: await this.signAccess(user, sessionId), refreshToken };
  }

  /** Same session ke liye naya access token (jaise profile complete hone ke baad). */
  issueAccessToken(user: TokenUser, sessionId: string): Promise<string> {
    return this.signAccess(user, sessionId);
  }

  async rotate(refreshToken: string): Promise<AuthTokens> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.refreshSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      session.user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newRefresh = await this.signRefresh(session.userId, session.id);

    const res = await this.prisma.session.updateMany({
      where: { id: session.id, refreshTokenHash: this.hash(refreshToken), revokedAt: null },
      data: { refreshTokenHash: this.hash(newRefresh) },
    });

    if (res.count === 0) {
      await this.revokeAll(session.userId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    return {
      accessToken: await this.signAccess(session.user, session.id),
      refreshToken: newRefresh,
    };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeOtherSessions(userId: string, keepSessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, id: { not: keepSessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private signAccess(user: TokenUser, sid: string): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      sid,
      pc: isOnboarded(user),
    };
    return this.jwt.signAsync(payload, { secret: this.accessSecret, expiresIn: this.accessTtl });
  }

  private signRefresh(userId: string, sid: string): Promise<string> {
    const payload: RefreshPayload = { sub: userId, sid, jti: randomUUID() };
    return this.jwt.signAsync(payload, { secret: this.refreshSecret, expiresIn: this.refreshTtl });
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
