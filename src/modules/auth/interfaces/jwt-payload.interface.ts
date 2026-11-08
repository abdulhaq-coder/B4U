import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  role: Role;
  sid: string;
  pc: boolean; // profile completed
}

export interface RefreshPayload {
  sub: string;
  sid: string;
  jti: string;
}

export interface AuthUser {
  id: string;
  role: Role;
  sessionId: string;
  onboarded: boolean; // profile bhari + password set
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
