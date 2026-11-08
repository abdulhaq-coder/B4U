import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { Gender } from '@prisma/client';

export class CompleteProfileDto {
  @ApiProperty({ example: '1998-05-20', description: 'YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must be YYYY-MM-DD' })
  dateOfBirth!: string;

  @ApiProperty({ example: '0300 1234567', description: 'Valid phone number' })
  @IsString()
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiProperty({ example: 'PK', description: '2-letter country code' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{2}$/, { message: 'countryCode must be a 2 letter ISO code' })
  countryCode!: string;

  @ApiProperty({ example: 'UUID', description: 'Valid city ID from /locations/cities' })
  @IsUUID()
  cityId!: string;
}
