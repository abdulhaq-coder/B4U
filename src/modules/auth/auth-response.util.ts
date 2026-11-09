import { User } from '@prisma/client';
import { nextStepFor, toPublicUser } from '../users/user.mapper';
import { AuthTokens } from './interfaces/jwt-payload.interface';

export function buildAuthResponse(user: User, tokens: AuthTokens) {
  return { user: toPublicUser(user), ...tokens, nextStep: nextStepFor(user) };
}

