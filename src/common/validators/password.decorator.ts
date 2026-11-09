import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export function PasswordField() {
  return applyDecorators(
    IsString(),
    MinLength(8),
    MaxLength(64),
    Matches(/[A-Za-z]/, { message: 'password must contain at least one letter' }),
    Matches(/\d/, { message: 'password must contain at least one number' }),
  );
}

