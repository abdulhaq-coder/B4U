import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BranchStatus,
  MediaPurpose,
  Prisma,
} from '@prisma/client';
import { mediaUrl } from '../../common/utils/media-url.util';
import { toE164 } from '../../common/utils/phone.util';
import { LocationsService } from '../locations/locations.service';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { Step1OnboardingDto } from './dto/step1-onboarding.dto';
import { Step3HoursDto } from './dto/step3-hours.dto';

@Injectable()
export class OwnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService,
    private readonly media: MediaService,
  ) {}

  /** Onboarding state machine for owner */
  async getOnboardingState(ownerId: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { ownerId },
      include: {
        logo: { select: { id: true, key: true } },
        branches: {
          orderBy: { createdAt: 'asc' },
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
              include: { media: { select: { id: true, key: true } } },
            },
            hours: true,
          },
        },
      },
    });

    if (!brand) {
      return {
        hasBrand: false,
        brand: null,
        activeBranch: null,
        currentStep: 1,
        canSubmit: false,
      };
    }

    const firstBranch = brand.branches[0] ?? null;

    let currentStep = 1;
    let canSubmit = false;

    if (firstBranch) {
      if (!firstBranch.step1CompletedAt) currentStep = 1;
      else if (!firstBranch.step3CompletedAt) currentStep = 3;
      else {
        currentStep = 4; // Ready to submit or submitted
        canSubmit = firstBranch.status === BranchStatus.DRAFT || firstBranch.status === BranchStatus.REJECTED;
      }
    }

    return {
      hasBrand: true,
      brand: {
        id: brand.id,
        name: brand.name,
        bio: brand.bio,
        logoUrl: brand.logo ? mediaUrl(brand.logo.key) : null,
        verifiedAt: brand.verifiedAt,
        isTrusted: brand.isTrusted,
        branchLimit: brand.branchLimit,
      },
      activeBranch: firstBranch
        ? {
            id: firstBranch.id,
            name: firstBranch.name,
            phone: firstBranch.phone,
            addressLine: firstBranch.addressLine,
            cityId: firstBranch.cityId,
            type: firstBranch.type,
            status: firstBranch.status,
            rejectionReason: firstBranch.rejectionReason,
            step1CompletedAt: firstBranch.step1CompletedAt,
            step3CompletedAt: firstBranch.step3CompletedAt,
            submittedAt: firstBranch.submittedAt,
            images: firstBranch.images.map((img) => ({
              id: img.media.id,
              url: mediaUrl(img.media.key),
              sortOrder: img.sortOrder,
            })),
            hours: firstBranch.hours,
          }
        : null,
      currentStep,
      canSubmit,
    };
  }

  /** Step 1: Save Brand and First Branch with 1 to 3 images */
  async saveStep1(ownerId: string, dto: Step1OnboardingDto) {
    const city = await this.locations.findCity(dto.cityId);
    if (!city || !city.isActive) throw new BadRequestException('Invalid city selected');

    const phone = toE164(dto.phone, city.countryCode);
    if (!phone) throw new BadRequestException('Invalid branch phone number');

    return this.prisma.$transaction(async (tx) => {
      // 1. Create or update Brand
      let brand = await tx.brand.findUnique({ where: { ownerId } });

      if (brand) {
        brand = await tx.brand.update({
          where: { id: brand.id },
          data: {
            name: dto.brandName,
            bio: dto.brandBio,
            logoId: dto.brandLogoId,
          },
        });
      } else {
        brand = await tx.brand.create({
          data: {
            ownerId,
            name: dto.brandName,
            bio: dto.brandBio,
            logoId: dto.brandLogoId,
          },
        });
      }

      // Claim brand logo if supplied
      if (dto.brandLogoId) {
        await this.media.claim(tx, {
          ids: [dto.brandLogoId],
          ownerId,
          purpose: MediaPurpose.BRAND_LOGO,
          usedBy: `BRAND:${brand.id}`,
        });
      }

      // 2. Find or create First Branch
      let branch = await tx.branch.findFirst({
        where: { brandId: brand.id },
        orderBy: { createdAt: 'asc' },
      });

      const branchData = {
        name: dto.branchName || null,
        phone,
        addressLine: dto.addressLine,
        cityId: dto.cityId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        type: dto.type,
        step1CompletedAt: new Date(),
      };

      if (branch) {
        branch = await tx.branch.update({
          where: { id: branch.id },
          data: branchData,
        });
      } else {
        branch = await tx.branch.create({
          data: {
            brandId: brand.id,
            ...branchData,
          },
        });
      }

      // 3. Claim and link Branch Images (0 = cover)
      await this.media.claim(tx, {
        ids: dto.imageIds,
        ownerId,
        purpose: MediaPurpose.BRANCH_IMAGE,
        usedBy: `BRANCH:${branch.id}`,
      });

      // Clear existing images and insert newly ordered ones
      await tx.branchImage.deleteMany({ where: { branchId: branch.id } });
      for (let i = 0; i < dto.imageIds.length; i++) {
        await tx.branchImage.create({
          data: {
            branchId: branch.id,
            mediaId: dto.imageIds[i],
            sortOrder: i,
          },
        });
      }

      return {
        message: 'Step 1 saved successfully',
        brandId: brand.id,
        branchId: branch.id,
        nextStep: 'STEP_3_HOURS',
      };
    });
  }

  /** Step 3: Operating Hours */
  async saveStep3Hours(ownerId: string, branchId: string, dto: Step3HoursDto) {
    const branch = await this.assertBranchOwner(ownerId, branchId);

    // Validate opensAtMin < closesAtMin
    for (const h of dto.hours) {
      if (h.opensAtMin >= h.closesAtMin) {
        throw new BadRequestException(`Closing time must be after opening time on ${h.day}`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.branchHours.deleteMany({ where: { branchId: branch.id } });

      for (const h of dto.hours) {
        await tx.branchHours.create({
          data: {
            branchId: branch.id,
            day: h.day,
            opensAtMin: h.opensAtMin,
            closesAtMin: h.closesAtMin,
          },
        });
      }

      await tx.branch.update({
        where: { id: branch.id },
        data: { step3CompletedAt: new Date() },
      });
    });

    return {
      message: 'Operating hours saved successfully',
      branchId: branch.id,
      canSubmit: true,
    };
  }

  /** Submit branch for admin approval (or auto-approve if brand is trusted) */
  async submitForApproval(ownerId: string, branchId: string) {
    const branch = await this.assertBranchOwner(ownerId, branchId);

    if (!branch.step1CompletedAt) {
      throw new BadRequestException('Please complete Step 1 (Brand & Location) before submitting');
    }
    if (!branch.step3CompletedAt) {
      throw new BadRequestException('Please configure Step 3 (Operating Hours) before submitting');
    }

    const imageCount = await this.prisma.branchImage.count({ where: { branchId: branch.id } });
    if (imageCount < 1) {
      throw new BadRequestException('At least 1 branch photo is required');
    }

    const brand = await this.prisma.brand.findUnique({ where: { id: branch.brandId } });
    const isTrusted = brand?.isTrusted === true;

    const newStatus = isTrusted ? BranchStatus.APPROVED : BranchStatus.PENDING_APPROVAL;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.branch.update({
        where: { id: branch.id },
        data: {
          status: newStatus,
          submittedAt: now,
          approvedAt: isTrusted ? now : null,
          rejectionReason: null,
        },
      });

      if (isTrusted && !brand?.verifiedAt) {
        await tx.brand.update({ where: { id: brand!.id }, data: { verifiedAt: now } });
      }

      await tx.branchStatusHistory.create({
        data: {
          branchId: branch.id,
          fromStatus: branch.status,
          toStatus: newStatus,
          byUserId: ownerId,
          reason: isTrusted ? 'Auto-approved (Trusted Brand)' : 'Submitted for Admin Approval',
        },
      });
    });

    return {
      message: isTrusted
        ? 'Branch approved immediately (Trusted Brand)'
        : 'Branch submitted successfully for admin review',
      status: newStatus,
    };
  }

  /** Add an additional branch to an existing brand */
  async createBranch(ownerId: string, dto: CreateBranchDto) {
    const brand = await this.prisma.brand.findUnique({
      where: { ownerId },
      include: { branches: true },
    });
    if (!brand) throw new NotFoundException('Brand not found. Complete onboarding first.');

    if (brand.branches.length >= brand.branchLimit) {
      throw new ConflictException(
        `Branch limit of ${brand.branchLimit} reached. Contact support to increase your branch limit.`,
      );
    }

    const city = await this.locations.findCity(dto.cityId);
    if (!city || !city.isActive) throw new BadRequestException('Invalid city selected');

    const phone = toE164(dto.phone, city.countryCode);
    if (!phone) throw new BadRequestException('Invalid branch phone number');

    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: {
          brandId: brand.id,
          name: dto.name,
          phone,
          addressLine: dto.addressLine,
          cityId: dto.cityId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          type: dto.type,
          step1CompletedAt: new Date(),
        },
      });

      await this.media.claim(tx, {
        ids: dto.imageIds,
        ownerId,
        purpose: MediaPurpose.BRANCH_IMAGE,
        usedBy: `BRANCH:${branch.id}`,
      });

      for (let i = 0; i < dto.imageIds.length; i++) {
        await tx.branchImage.create({
          data: {
            branchId: branch.id,
            mediaId: dto.imageIds[i],
            sortOrder: i,
          },
        });
      }

      return {
        message: 'Branch created successfully. Configure operating hours next.',
        branchId: branch.id,
      };
    });
  }

  /** List all branches belonging to the owner */
  async listBranches(ownerId: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { ownerId },
      include: {
        branches: {
          orderBy: { createdAt: 'desc' },
          include: {
            city: { select: { name: true, province: true } },
            images: {
              where: { sortOrder: 0 },
              include: { media: { select: { key: true } } },
            },
          },
        },
      },
    });

    if (!brand) return [];

    return brand.branches.map((b) => ({
      id: b.id,
      brandName: brand.name,
      branchName: b.name,
      displayName: b.name ? `${brand.name} – ${b.name}` : brand.name,
      phone: b.phone,
      addressLine: b.addressLine,
      city: b.city.name,
      province: b.city.province,
      type: b.type,
      status: b.status,
      rejectionReason: b.rejectionReason,
      coverImageUrl: b.images[0]?.media ? mediaUrl(b.images[0].media.key) : null,
      createdAt: b.createdAt,
    }));
  }

  /** View branch details */
  async getBranch(ownerId: string, branchId: string) {
    const branch = await this.assertBranchOwner(ownerId, branchId);

    const full = await this.prisma.branch.findUnique({
      where: { id: branch.id },
      include: {
        brand: true,
        city: true,
        images: {
          orderBy: { sortOrder: 'asc' },
          include: { media: { select: { id: true, key: true } } },
        },
        hours: { orderBy: { day: 'asc' } },
        history: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!full) throw new NotFoundException('Branch not found');

    return {
      id: full.id,
      brand: {
        id: full.brand.id,
        name: full.brand.name,
        bio: full.brand.bio,
      },
      name: full.name,
      displayName: full.name ? `${full.brand.name} – ${full.name}` : full.brand.name,
      phone: full.phone,
      addressLine: full.addressLine,
      city: full.city.name,
      type: full.type,
      status: full.status,
      rejectionReason: full.rejectionReason,
      images: full.images.map((img) => ({
        id: img.media.id,
        url: mediaUrl(img.media.key),
        sortOrder: img.sortOrder,
      })),
      hours: full.hours,
      history: full.history,
    };
  }

  /** Ownership security check */
  private async assertBranchOwner(ownerId: string, branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { brand: true },
    });

    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.brand.ownerId !== ownerId) {
      throw new ForbiddenException('You do not have access to this branch');
    }
    return branch;
  }
}

