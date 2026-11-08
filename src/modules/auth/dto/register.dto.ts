import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsIn, Matches } from 'class-validator';
import { Role } from '@prisma/client';
import { CLIENT_ROLES } from '../../../common/constants/roles';
import { Match } from '../../../common/validators/match.decorator';
import { PasswordField } from '../../../common/validators/password.decorator';
import { RequestOtpDto } from './request-otp.dto';

export class RegisterDto extends RequestOtpDto {
  @ApiProperty({ example: 'Ali Khan', description: 'User full name' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @Matches(/^[\p{L}][\p{L}\p{M}.'\- ]{1,79}$/u, { message: 'fullName is invalid' })
  fullName!: string;

  @ApiProperty({ enum: CLIENT_ROLES, example: Role.CUSTOMER })
  @IsIn(CLIENT_ROLES)
  role!: Role;

  @ApiProperty({ example: 'Test1234', description: 'Min 8 chars, 1 letter, 1 number' })
  @PasswordField()
  password!: string;

  @ApiProperty({ example: 'Test1234' })
  @Match('password')
  confirmPassword!: string;

  @ApiProperty({ example: true })
  @Equals(true, { message: 'You must accept the Terms and Privacy Policy' })
  acceptTerms!: boolean;
}
