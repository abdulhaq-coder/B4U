import { Injectable } from '@nestjs/common';
import { Gender, Role, User, UserStatus } from '@prisma/client';
import { CURRENT_TERMS_VERSION } from '../../common/constants/legal';
import { PrismaService } from '../../prisma/prisma.service';

export const MAX_FAILED_LOGINS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

interface PendingData {
  fullName: string;
  passwordHash: string;
  role: Role;
}

interface ProfileData {
  dateOfBirth: Date;
  phone: string;
  gender: Gender;
  countryCode: string;
  cityId: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createPending(data: PendingData & { email: string }): Promise<User> {
    return this.prisma.user.create({
      data: { ...data, termsAcceptedAt: new Date(), termsVersion: CURRENT_TERMS_VERSION },
    });
  }

  updatePending(id: string, data: PendingData): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { ...data, termsAcceptedAt: new Date(), termsVersion: CURRENT_TERMS_VERSION },
    });
  }

  markVerified(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
    });
  }

  completeProfile(id: string, data: ProfileData): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { ...data, profileCompletedAt: new Date() },
    });
  }

  async registerFailedLogin(id: string): Promise<void> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    if (user.failedLoginCount >= MAX_FAILED_LOGINS) {
      await this.prisma.user.update({
        where: { id },
        data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) },
      });
    }
  }

  async resetLoginFailures(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }
}
