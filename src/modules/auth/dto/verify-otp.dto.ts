import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { RequestOtpDto } from './request-otp.dto';

export class VerifyOtpDto extends RequestOtpDto {
  @ApiProperty({ example: '123456', description: '6-digit OTP code' })
  @Matches(/^\d{6}$/, { message: 'code must be a 6 digit number' })
  code!: string;
}

