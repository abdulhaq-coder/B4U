import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SalonType } from '@prisma/client';

export class Step1OnboardingDto {
  @ApiProperty({ example: 'Lavish Salon & Spa', description: 'Brand business name' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  brandName!: string;

  @ApiPropertyOptional({ example: 'Premier beauty & styling services in Karachi' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  brandBio?: string;

  @ApiPropertyOptional({ example: 'UUID', description: 'Media asset ID of brand logo' })
  @IsOptional()
  @IsUUID()
  brandLogoId?: string;

  @ApiPropertyOptional({ example: 'Safoora Branch', description: 'Branch name (null if single location)' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(60)
  branchName?: string;

  @ApiProperty({ example: '0300 9876543', description: 'Contact phone for branch' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ example: 'Shop 4, Block 3, Safoora Chowrangi', description: 'Detailed street address' })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  addressLine!: string;

  @ApiProperty({ example: 'UUID', description: 'City ID from /locations/cities' })
  @IsUUID()
  cityId!: string;

  @ApiPropertyOptional({ example: 24.9123, description: 'GPS Latitude' })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 67.1234, description: 'GPS Longitude' })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiProperty({ enum: SalonType, example: SalonType.LADIES })
  @IsEnum(SalonType)
  type!: SalonType;

  @ApiProperty({
    example: ['uuid1', 'uuid2'],
    description: '1 to 3 MediaAsset IDs (first image is cover)',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 branch photo is required' })
  @ArrayMaxSize(3, { message: 'Maximum 3 branch photos allowed' })
  @IsUUID('4', { each: true })
  imageIds!: string[];
}

