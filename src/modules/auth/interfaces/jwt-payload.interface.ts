import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string; // user id
  role: Role;
  sid: string; // session id
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
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

