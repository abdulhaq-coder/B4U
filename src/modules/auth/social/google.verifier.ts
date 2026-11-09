import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialProvider } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { parseCsv } from '../../../common/utils/csv.util';
import { Env } from '../../../config/env.validation';
import { assertNonce } from './nonce.util';
import { SocialProfile } from './social-profile.interface';

@Injectable()
export class GoogleVerifier {
  private readonly client = new OAuth2Client();
  private readonly audiences: string[];

  constructor(config: ConfigService<Env, true>) {
    this.audiences = parseCsv(config.get('GOOGLE_CLIENT_IDS', { infer: true }));
  }

  async verify(idToken: string, nonce?: string): Promise<SocialProfile> {
    if (!this.audiences.length) throw new ServiceUnavailableException('Google sign-in is not configured');

    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.audiences });
      const p = ticket.getPayload();
      if (!p?.sub) throw new Error('missing sub');
      assertNonce((p as { nonce?: unknown }).nonce, nonce);

      return {
        provider: SocialProvider.GOOGLE,
        providerUserId: p.sub,
        email: p.email ? p.email.toLowerCase() : null,
        emailVerified: p.email_verified === true,
        name: p.name ?? null,
      };
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }
  }
}

