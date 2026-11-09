import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BranchStatus } from '@prisma/client';
import { mediaUrl } from '../../common/utils/media-url.util';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** List all branches pending admin review */
  async listPendingBranches(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [total, branches] = await this.prisma.$transaction([
      this.prisma.branch.count({ where: { status: BranchStatus.PENDING_APPROVAL } }),
      this.prisma.branch.findMany({
        where: { status: BranchStatus.PENDING_APPROVAL },
        orderBy: { submittedAt: 'asc' },
        skip,
        take: limit,
        include: {
          brand: {
            include: {
              owner: { select: { id: true, email: true, fullName: true, phone: true } },
              logo: { select: { key: true } },
            },
          },
          city: true,
          images: {
            orderBy: { sortOrder: 'asc' },
            include: { media: { select: { id: true, key: true } } },
          },
          hours: { orderBy: { day: 'asc' } },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: branches.map((b) => ({
        id: b.id,
        brandId: b.brandId,
        brandName: b.brand.name,
        brandBio: b.brand.bio,
        brandLogoUrl: b.brand.logo ? mediaUrl(b.brand.logo.key) : null,
        owner: b.brand.owner,
        branchName: b.name,
        displayName: b.name ? `${b.brand.name} – ${b.name}` : b.brand.name,
        phone: b.phone,
        addressLine: b.addressLine,
        city: b.city.name,
        province: b.city.province,
        type: b.type,
        submittedAt: b.submittedAt,
        images: b.images.map((img) => ({
          id: img.media.id,
          url: mediaUrl(img.media.key),
          sortOrder: img.sortOrder,
        })),
        hours: b.hours,
      })),
    };
  }

  /** Approve a branch and verify brand if not already verified */
  async approveBranch(branchId: string, adminId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { brand: true },
    });

    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.status === BranchStatus.APPROVED) {
      throw new BadRequestException('Branch is already approved');
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.branch.update({
        where: { id: branch.id },
        data: {
          status: BranchStatus.APPROVED,
          reviewedAt: now,
          reviewedById: adminId,
          approvedAt: now,
          rejectionReason: null,
        },
      });

      // Verify Brand upon first approved branch
      if (!branch.brand.verifiedAt) {
        await tx.brand.update({
          where: { id: branch.brand.id },
          data: { verifiedAt: now },
        });
      }

      await tx.branchStatusHistory.create({
        data: {
          branchId: branch.id,
          fromStatus: branch.status,
          toStatus: BranchStatus.APPROVED,
          byUserId: adminId,
          reason: 'Approved by Platform Admin',
        },
      });
    });

    return { message: 'Branch approved successfully', branchId: branch.id };
  }

  /** Reject a branch with reason */
  async rejectBranch(branchId: string, adminId: string, reason: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });

    if (!branch) throw new NotFoundException('Branch not found');

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.branch.update({
        where: { id: branch.id },
        data: {
          status: BranchStatus.REJECTED,
          reviewedAt: now,
          reviewedById: adminId,
          rejectionReason: reason,
        },
      });

      await tx.branchStatusHistory.create({
        data: {
          branchId: branch.id,
          fromStatus: branch.status,
          toStatus: BranchStatus.REJECTED,
          byUserId: adminId,
          reason,
        },
      });
    });

    return { message: 'Branch rejected with feedback sent to salon owner', branchId: branch.id };
  }

  /** Mark brand as trusted and adjust branch limits */
  async setBrandTrust(brandId: string, isTrusted: boolean, branchLimit?: number) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');

    const updated = await this.prisma.brand.update({
      where: { id: brandId },
      data: {
        isTrusted,
        ...(branchLimit ? { branchLimit } : {}),
      },
    });

    return {
      message: `Brand ${isTrusted ? 'marked as Trusted' : 'removed from Trusted'} successfully`,
      brandId: updated.id,
      isTrusted: updated.isTrusted,
      branchLimit: updated.branchLimit,
    };
  }
}

