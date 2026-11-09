import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';
import { LOGIN_ROLES } from '../../../common/constants/roles';
import { RequestOtpDto } from './request-otp.dto';

export class LoginDto extends RequestOtpDto {
  @ApiProperty({ example: 'Test1234', description: 'User password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;

  /** Kis app se login ho raha hai (customer, owner, admin). */
  @ApiProperty({ enum: LOGIN_ROLES, example: Role.CUSTOMER })
  @IsIn(LOGIN_ROLES)
  role!: Role;
}
