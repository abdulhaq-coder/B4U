import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Weekday } from '@prisma/client';

export class DayHourDto {
  @ApiProperty({ enum: Weekday, example: Weekday.MONDAY })
  @IsEnum(Weekday)
  day!: Weekday;

  @ApiProperty({ example: 600, description: 'Opening time in minutes from midnight (10:00 = 600)' })
  @IsInt()
  @Min(0)
  @Max(1439)
  opensAtMin!: number;

  @ApiProperty({ example: 1260, description: 'Closing time in minutes from midnight (21:00 = 1260)' })
  @IsInt()
  @Min(0)
  @Max(1439)
  closesAtMin!: number;
}

export class Step3HoursDto {
  @ApiProperty({
    type: [DayHourDto],
    description: 'Operating days and timings (only include open days)',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one operating day must be configured' })
  @ValidateNested({ each: true })
  @Type(() => DayHourDto)
  hours!: DayHourDto[];
}

