import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaAsset, MediaPurpose, Prisma, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { mediaUrl } from '../../common/utils/media-url.util';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/interfaces/jwt-payload.interface';

const MAX_PENDING_UPLOADS = 30; // abhi tak kahin na lagi hui images ki had
const MAX_INPUT_PIXELS = 40_000_000; // bohot bari image (decompression bomb) se bachao
const ALLOWED_FORMATS = ['jpeg', 'png', 'webp'];

const PROFILES: Record<MediaPurpose, { size: number; fit: 'cover' | 'inside' }> = {
  AVATAR: { size: 512, fit: 'cover' },
  BRAND_LOGO: { size: 512, fit: 'inside' },
  BRANCH_IMAGE: { size: 1600, fit: 'inside' },
  SERVICE_IMAGE: { size: 1200, fit: 'inside' },
};

const OWNER_PURPOSES: MediaPurpose[] = [
  MediaPurpose.BRAND_LOGO,
  MediaPurpose.BRANCH_IMAGE,
  MediaPurpose.SERVICE_IMAGE,
];

@Injectable()
export class MediaService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.bucket = config.get('S3_BUCKET', { infer: true });
    this.s3 = new S3Client({
      region: config.get('S3_REGION', { infer: true }),
      endpoint: config.get('S3_ENDPOINT', { infer: true }) || undefined,
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
      },
    });
  }

  async upload(user: AuthUser, purpose: MediaPurpose, file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required (field name: file)');
    }
    if (OWNER_PURPOSES.includes(purpose) && user.role !== Role.OWNER) {
      throw new ForbiddenException('Not allowed for this account');
    }

    const pending = await this.prisma.mediaAsset.count({ where: { ownerId: user.id, usedBy: null } });
    if (pending >= MAX_PENDING_UPLOADS) {
      throw new HttpException(
        'Too many unused uploads. Use or remove some first.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const processed = await this.process(file.buffer, purpose);
    const key = `${purpose.toLowerCase()}/${user.id}/${randomUUID()}.webp`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: processed.data,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    const asset = await this.prisma.mediaAsset.create({
      data: {
        ownerId: user.id,
        purpose,
        key,
        width: processed.width,
        height: processed.height,
        sizeBytes: processed.data.length,
      },
    });

    return { id: asset.id, url: mediaUrl(asset.key), width: asset.width, height: asset.height };
  }

  /**
   * Images ko kisi cheez (avatar, branch...) se jodta hai. Sirf apni, sahi purpose ki,
   * aur kisi aur jagah na lagi hui image allow hoti hai. Transaction ke andar chalao.
   */
  async claim(
    tx: Prisma.TransactionClient,
    p: { ids: string[]; ownerId: string; purpose: MediaPurpose; usedBy: string },
  ): Promise<MediaAsset[]> {
    const ids = [...new Set(p.ids)];
    const assets = await tx.mediaAsset.findMany({ where: { id: { in: ids } } });

    if (assets.length !== ids.length) throw new BadRequestException('One or more images were not found');
    for (const a of assets) {
      if (a.ownerId !== p.ownerId || a.purpose !== p.purpose) {
        throw new BadRequestException('Invalid image');
      }
      if (a.usedBy && a.usedBy !== p.usedBy) {
        throw new BadRequestException('Image is already in use');
      }
    }

    await tx.mediaAsset.updateMany({ where: { id: { in: ids } }, data: { usedBy: p.usedBy } });
    return assets;
  }

  /** Hata di gayi images ko "unused" kar deta hai (cleanup job baad me inhe delete karega). */
  async release(tx: Prisma.TransactionClient, ids: string[]): Promise<void> {
    if (!ids.length) return;
    await tx.mediaAsset.updateMany({ where: { id: { in: ids } }, data: { usedBy: null } });
  }

  async setAvatar(userId: string, assetId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: userId }, select: { avatarId: true } });

      await this.claim(tx, {
        ids: [assetId],
        ownerId: userId,
        purpose: MediaPurpose.AVATAR,
        usedBy: `USER:${userId}`,
      });
      await tx.user.update({ where: { id: userId }, data: { avatarId: assetId } });

      if (current?.avatarId && current.avatarId !== assetId) {
        await this.release(tx, [current.avatarId]);
      }
    });
  }

  /** Image ko asli check karke WebP me convert karta hai (EXIF/GPS wagera hat jata hai). */
  private async process(buffer: Buffer, purpose: MediaPurpose) {
    const profile = PROFILES[purpose];
    try {
      const input = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' });
      const meta = await input.metadata();
      if (!meta.format || !ALLOWED_FORMATS.includes(meta.format)) throw new Error('unsupported format');

      const { data, info } = await input
        .rotate() // EXIF orientation lagao, phir metadata hata do
        .resize({ width: profile.size, height: profile.size, fit: profile.fit, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });

      return { data, width: info.width, height: info.height };
    } catch {
      throw new BadRequestException('Invalid or unsupported image (use JPEG, PNG or WebP)');
    }
  }
}

