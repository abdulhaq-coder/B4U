import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role, SocialProvider } from '@prisma/client';
import type { Request, Response } from 'express';
import { AllowIncompleteProfile } from '../../common/decorators/allow-incomplete-profile.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthUser } from './interfaces/jwt-payload.interface';
import { PasswordFlowService } from './password-flow.service';
import { RefreshCookieService } from './refresh-cookie.service';
import { SocialAuthService } from './social/social-auth.service';
import { SessionMeta } from './token.service';

const meta = (req: Request): SessionMeta => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

const limit = (n: number) => ({ default: { limit: n, ttl: 60_000 } });

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwordFlow: PasswordFlowService,
    private readonly social: SocialAuthService,
    private readonly cookies: RefreshCookieService,
  ) {}

  // ---------- Register / login ----------

  @Public()
  @Throttle(limit(10))
  @Post('register')
  @ApiOperation({ summary: 'Register with password, fullName, and role (sends email OTP)' })
  @ApiResponse({ status: 201, description: 'Verification code sent to email' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle(limit(10))
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email OTP and obtain initial tokens' })
  @ApiResponse({ status: 200, description: 'Email verified, returns tokens and nextStep' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.deliver(req, res, await this.auth.verifyEmail(dto, meta(req)));
  }

  @Public()
  @Throttle(limit(5))
  @Post('otp/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification OTP' })
  resendOtp(@Body() dto: RequestOtpDto) {
    return this.auth.resendOtp(dto.email);
  }

  @Public()
  @Throttle(limit(10))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email, password, and role' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.deliver(req, res, await this.auth.login(dto, meta(req)));
  }

  // ---------- Social ----------

  @Public()
  @Throttle(limit(20))
  @Post('social/google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Google Sign-In with idToken' })
  async google(@Body() dto: SocialLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.deliver(req, res, await this.social.login(SocialProvider.GOOGLE, dto, meta(req)));
  }

  @Public()
  @Throttle(limit(20))
  @Post('social/apple')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apple Sign-In with idToken' })
  async apple(@Body() dto: SocialLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.deliver(req, res, await this.social.login(SocialProvider.APPLE, dto, meta(req)));
  }

  // ---------- Tokens ----------

  @Public()
  @Throttle(limit(20))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token (supports both web httpOnly cookies and mobile body token)' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const web = this.cookies.isWeb(req);
    let token: string | undefined;

    if (web) {
      this.cookies.assertTrustedOrigin(req);
      token = this.cookies.read(req);
    } else {
      token = dto.refreshToken;
    }
    if (!token) throw new UnauthorizedException('Missing refresh token');

    try {
      return this.deliver(req, res, await this.auth.refresh(token));
    } catch (e) {
      if (web) this.cookies.clear(res);
      throw e;
    }
  }

  @ApiBearerAuth()
  @AllowIncompleteProfile()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout current session' })
  logout(@CurrentUser() user: AuthUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (this.cookies.isWeb(req)) this.cookies.clear(res);
    return this.auth.logout(user.sessionId);
  }

  @ApiBearerAuth()
  @AllowIncompleteProfile()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout all sessions' })
  logoutAll(@CurrentUser() user: AuthUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (this.cookies.isWeb(req)) this.cookies.clear(res);
    return this.auth.logoutAll(user.id);
  }

  // ---------- Profile / account ----------

  @ApiBearerAuth()
  @AllowIncompleteProfile()
  @Roles(Role.CUSTOMER)
  @Patch('profile/complete')
  @ApiOperation({ summary: 'Complete profile (DOB, phone, gender, cityId)' })
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

  // ---------- Passwords ----------

  @Public()
  @Throttle(limit(5))
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset OTP code' })
  forgotPassword(@Body() dto: RequestOtpDto) {
    return this.passwordFlow.forgot(dto.email);
  }

  @Public()
  @Throttle(limit(10))
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with email OTP and new password' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordFlow.reset(dto);
  }

  @ApiBearerAuth()
  @Throttle(limit(5))
  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password with current password and new password' })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.passwordFlow.change(user, dto);
  }

  @ApiBearerAuth()
  @AllowIncompleteProfile()
  @Throttle(limit(10))
  @Post('password/set')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set initial password (for social login users)' })
  setPassword(@CurrentUser() user: AuthUser, @Body() dto: SetPasswordDto) {
    return this.passwordFlow.set(user, dto);
  }

  // ---------- helpers ----------

  /** Web: refresh token cookie me, body se hata do. Mobile: body me jata hai. */
  private deliver<T extends { refreshToken: string }>(
    req: Request,
    res: Response,
    result: T,
  ): Omit<T, 'refreshToken'> | T {
    if (!this.cookies.isWeb(req)) return result;
    const { refreshToken, ...rest } = result;
    this.cookies.set(res, refreshToken);
    return rest;
  }
}
