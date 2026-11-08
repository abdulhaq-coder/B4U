import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialProvider } from '@prisma/client';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { parseCsv } from '../../../common/utils/csv.util';
import { Env } from '../../../config/env.validation';
import { assertNonce } from './nonce.util';
import { SocialProfile } from './social-profile.interface';

const APPLE_ISSUER = 'https://appleid.apple.com';
const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

@Injectable()
export class AppleVerifier {
  private readonly audiences: string[];

  constructor(config: ConfigService<Env, true>) {
    this.audiences = parseCsv(config.get('APPLE_CLIENT_IDS', { infer: true }));
  }

  async verify(idToken: string, nonce?: string): Promise<SocialProfile> {
    if (!this.audiences.length) throw new ServiceUnavailableException('Apple sign-in is not configured');

    try {
      const { payload } = await jwtVerify(idToken, appleKeys, {
        issuer: APPLE_ISSUER,
        audience: this.audiences,
        algorithms: ['RS256'],
      });
      if (!payload.sub) throw new Error('missing sub');
      assertNonce(payload.nonce, nonce);

      return {
        provider: SocialProvider.APPLE,
        providerUserId: payload.sub,
        email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
        name: null, // Apple token me naam nahi hota
      };
    } catch {
      throw new UnauthorizedException('Invalid Apple token');
    }
  }
}
