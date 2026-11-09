import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { Gender } from '@prisma/client';

export class EditProfileDto {
  @ApiPropertyOptional({ example: 'Ayesha Ali' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @Matches(/^[\p{L}][\p{L}\p{M}.'\- ]{1,79}$/u, { message: 'fullName is invalid' })
  fullName?: string;

  @ApiPropertyOptional({ example: '0300 1234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: '1998-05-20' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must be YYYY-MM-DD' })
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: Gender, example: Gender.FEMALE })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: 'PK' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{2}$/, { message: 'countryCode must be a 2 letter ISO code' })
  countryCode?: string;

  @ApiPropertyOptional({ example: 'UUID' })
  @IsOptional()
  @IsUUID()
  cityId?: string;

  @ApiPropertyOptional({ example: 'UUID', nullable: true })
  @IsOptional()
  avatarId?: string | null;
}

