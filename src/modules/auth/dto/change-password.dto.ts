import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Match } from '../../../common/validators/match.decorator';
import { PasswordField } from '../../../common/validators/password.decorator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentPass123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ example: 'NewPass123' })
  @PasswordField()
  newPassword!: string;

  @ApiProperty({ example: 'NewPass123' })
  @Match('newPassword')
  confirmPassword!: string;
}

