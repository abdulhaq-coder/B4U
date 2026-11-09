import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { AllowIncompleteProfile } from '../../common/decorators/allow-incomplete-profile.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/interfaces/jwt-payload.interface';
import { UploadImageDto } from './dto/upload-image.dto';
import { MediaService } from './media.service';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** multipart/form-data: fields `purpose` aur `file` (max 5 MB) */
  @ApiBearerAuth()
  @AllowIncompleteProfile() // customer profile complete karte waqt avatar upload karta hai
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('images')
  @ApiOperation({ summary: 'Upload image (AVATAR, BRAND_LOGO, BRANCH_IMAGE, SERVICE_IMAGE)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Body() dto: UploadImageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.media.upload(user, dto.purpose, file);
  }
}

