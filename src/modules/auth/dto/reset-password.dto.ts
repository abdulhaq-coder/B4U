import { ApiProperty } from '@nestjs/swagger';
import { Match } from '../../../common/validators/match.decorator';
import { PasswordField } from '../../../common/validators/password.decorator';
import { VerifyOtpDto } from './verify-otp.dto';

export class ResetPasswordDto extends VerifyOtpDto {
  @ApiProperty({ example: 'NewPass123' })
  @PasswordField()
  password!: string;

  @ApiProperty({ example: 'NewPass123' })
  @Match('password')
  confirmPassword!: string;
}
