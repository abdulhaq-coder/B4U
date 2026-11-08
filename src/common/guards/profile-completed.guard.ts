import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '../../modules/auth/interfaces/jwt-payload.interface';
import { ALLOW_INCOMPLETE_PROFILE_KEY } from '../decorators/allow-incomplete-profile.decorator';

@Injectable()
export class ProfileCompletedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_INCOMPLETE_PROFILE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user) return true; // @Public route

    if (!user.onboarded) {
      throw new ForbiddenException({
        code: 'ONBOARDING_INCOMPLETE',
        message: 'Please complete your account setup first',
      });
    }
    return true;
  }
}

