import { ApiProperty } from '@nestjs/swagger';
import { Match } from '../../../common/validators/match.decorator';
import { PasswordField } from '../../../common/validators/password.decorator';

export class SetPasswordDto {
  @ApiProperty({ example: 'InitialPass123' })
  @PasswordField()
  password!: string;

  @ApiProperty({ example: 'InitialPass123' })
  @Match('password')
  confirmPassword!: string;
}
