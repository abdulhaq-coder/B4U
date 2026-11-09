import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { MediaPurpose } from '@prisma/client';

export class UploadImageDto {
  @ApiProperty({ enum: MediaPurpose, example: MediaPurpose.AVATAR })
  @IsEnum(MediaPurpose)
  purpose!: MediaPurpose;
}
