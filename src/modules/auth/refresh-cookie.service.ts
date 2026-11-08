import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { parseCsv } from '../../common/utils/csv.util';
import { Env } from '../../config/env.validation';

export const REFRESH_COOKIE = 'salon_rt';

@Injectable()
export class RefreshCookieService {
  private readonly options: CookieOptions;
  private readonly maxAgeMs: number;
  private readonly allowedOrigins: string[];

  constructor(config: ConfigService<Env, true>) {
    this.options = {
      httpOnly: true, // JavaScript cannot read
      secure: config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth', // only sent to auth endpoints
    };
    this.maxAgeMs = config.get('JWT_REFRESH_TTL_DAYS', { infer: true }) * 86_400_000;
    this.allowedOrigins = parseCsv(config.get('CORS_ORIGINS', { infer: true }));
  }

  isWeb(req: Request): boolean {
    return req.headers['x-client-type'] === 'web';
  }

  read(req: Request): string | undefined {
    const value = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
    return typeof value === 'string' && value ? value : undefined;
  }

  set(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, { ...this.options, maxAge: this.maxAgeMs });
  }

  clear(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.options);
  }

  /** CSRF protection: cookie requests must come from trusted web origin */
  assertTrustedOrigin(req: Request): void {
    const origin = req.headers.origin;
    if (!origin || !this.allowedOrigins.includes(origin)) {
      throw new ForbiddenException('Untrusted origin');
    }
  }
}
