import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AllowIncompleteProfile } from '../../common/decorators/allow-incomplete-profile.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthUser } from './interfaces/jwt-payload.interface';
import { SessionMeta } from './token.service';

const meta = (req: Request): SessionMeta => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register with password, fullName, and role (sends email OTP)' })
  @ApiResponse({ status: 201, description: 'Verification code sent to email' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email OTP and obtain initial tokens' })
  @ApiResponse({ status: 200, description: 'Email verified, returns tokens and nextStep: COMPLETE_PROFILE' })
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.auth.verifyEmail(dto, meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification OTP' })
  @ApiResponse({ status: 200, description: 'OTP resent if registration exists' })
  resendOtp(@Body() dto: RequestOtpDto) {
    return this.auth.resendOtp(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email, password, and role' })
  @ApiResponse({ status: 200, description: 'Logged in successfully' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token' })
  @ApiResponse({ status: 200, description: 'Tokens rotated' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @AllowIncompleteProfile()
  @Patch('profile/complete')
  @ApiOperation({ summary: 'Complete profile (DOB, phone, gender, cityId)' })
  @ApiResponse({ status: 200, description: 'Profile completed, returns fresh accessToken with pc:true' })
  completeProfile(@CurrentUser() user: AuthUser, @Body() dto: CompleteProfileDto) {
    return this.auth.completeProfile(user, dto);
  }

  @ApiBearerAuth()
  @AllowIncompleteProfile()
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile and nextStep' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @ApiBearerAuth()
  @AllowIncompleteProfile()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout current session' })
  logout(@CurrentUser() user: AuthUser) {
    return this.auth.logout(user.sessionId);
  }

  @ApiBearerAuth()
  @AllowIncompleteProfile()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout all devices' })
  logoutAll(@CurrentUser() user: AuthUser) {
    return this.auth.logoutAll(user.id);
  }
}
