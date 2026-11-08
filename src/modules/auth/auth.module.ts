import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { LocationsModule } from '../locations/locations.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { PasswordService } from './password.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';

@Module({
  imports: [UsersModule, MailModule, LocationsModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, OtpService, TokenService, PasswordService, JwtStrategy],
  exports: [AuthService, TokenService, PasswordService],
})
export class AuthModule {}
