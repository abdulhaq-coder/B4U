import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';
import { CLIENT_ROLES } from '../../../common/constants/roles';

export class SocialLoginDto {
  @ApiProperty({ description: 'ID token received from Google/Apple SDK' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  idToken!: string;

  @ApiProperty({ enum: CLIENT_ROLES, example: Role.CUSTOMER })
  @IsIn(CLIENT_ROLES)
  role!: Role;

  @ApiProperty({ example: true })
  @Equals(true, { message: 'You must accept the Terms and Privacy Policy' })
  acceptTerms!: boolean;

  /** Optional: client ka random nonce (provider token ke nonce se match hota hai). */
  @ApiPropertyOptional({ description: 'Optional nonce for replay protection' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  nonce?: string;

  /** Apple naam sirf pehli baar app ko deta hai, wohi yahan bhejo. */
  @ApiPropertyOptional({ description: 'Full name (provided by Apple on first sign-in)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  fullName?: string;
}

