import { SocialProvider } from '@prisma/client';

export interface SocialProfile {
  provider: SocialProvider;
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

