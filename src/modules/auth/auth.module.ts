import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { LocationsModule } from '../locations/locations.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { PasswordFlowService } from './password-flow.service';
import { PasswordService } from './password.service';
import { RefreshCookieService } from './refresh-cookie.service';
import { AppleVerifier } from './social/apple.verifier';
import { GoogleVerifier } from './social/google.verifier';
import { SocialAuthService } from './social/social-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';

@Module({
  imports: [UsersModule, MailModule, LocationsModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    TokenService,
    PasswordService,
    PasswordFlowService,
    SocialAuthService,
    GoogleVerifier,
    AppleVerifier,
    RefreshCookieService,
    JwtStrategy,
  ],
  exports: [AuthService, TokenService, PasswordService],
})
export class AuthModule {}
