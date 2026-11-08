import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { CLIENT_ROLES } from '../../../common/constants/roles';
import { Match } from '../../../common/validators/match.decorator';
import { RequestOtpDto } from './request-otp.dto';

export class RegisterDto extends RequestOtpDto {
  @ApiProperty({ example: 'Ali Khan', description: 'Full name' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @Matches(/^[\p{L}][\p{L}\p{M}.'\- ]{1,79}$/u, { message: 'fullName is invalid' })
  fullName!: string;

  @ApiProperty({ enum: CLIENT_ROLES, example: Role.CUSTOMER })
  @IsIn(CLIENT_ROLES)
  role!: Role;

  @ApiProperty({ example: 'Test1234', description: 'Password (min 8 chars, 1 letter, 1 number)' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/[A-Za-z]/, { message: 'password must contain at least one letter' })
  @Matches(/\d/, { message: 'password must contain at least one number' })
  password!: string;

  @ApiProperty({ example: 'Test1234', description: 'Must match password' })
  @Match('password')
  confirmPassword!: string;

  @ApiProperty({ example: true, description: 'Must accept Terms and Privacy Policy' })
  @Equals(true, { message: 'You must accept the Terms and Privacy Policy' })
  acceptTerms!: boolean;
}
