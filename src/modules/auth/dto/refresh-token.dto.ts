import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({ description: 'Optional on web when using httpOnly cookies, required on mobile' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  refreshToken?: string;
}
