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

export class CreateBranchDto {
  @ApiProperty({ example: 'Johar Branch', description: 'Name of the branch' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @ApiProperty({ example: '0300 1234567', description: 'Contact phone for branch' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ example: 'Plot 12, Block 14, Gulistan-e-Johar', description: 'Street address' })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  addressLine!: string;

  @ApiProperty({ example: 'UUID', description: 'City ID from /locations/cities' })
  @IsUUID()
  cityId!: string;

  @ApiPropertyOptional({ example: 24.9123 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 67.1234 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiProperty({ enum: SalonType, example: SalonType.UNISEX })
  @IsEnum(SalonType)
  type!: SalonType;

  @ApiProperty({
    example: ['uuid1'],
    description: '1 to 3 MediaAsset IDs',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsUUID('4', { each: true })
  imageIds!: string[];
}

