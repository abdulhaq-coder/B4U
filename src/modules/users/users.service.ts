import { Injectable } from '@nestjs/common';
import { Gender, Role, SocialProvider, User, UserStatus } from '@prisma/client';
import { CURRENT_TERMS_VERSION } from '../../common/constants/legal';
import { PrismaService } from '../../prisma/prisma.service';

export const MAX_FAILED_LOGINS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

export type UserWithAvatar = User & { avatar: { key: string } | null };
const WITH_AVATAR = { avatar: { select: { key: true } } } as const;

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

  findByEmail(email: string): Promise<UserWithAvatar | null> {
    return this.prisma.user.findUnique({ where: { email }, include: WITH_AVATAR });
  }

  findById(id: string): Promise<UserWithAvatar | null> {
    return this.prisma.user.findUnique({ where: { id }, include: WITH_AVATAR });
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

  completeProfile(id: string, data: ProfileData): Promise<UserWithAvatar> {
    return this.prisma.user.update({
      where: { id },
      data: { ...data, profileCompletedAt: new Date() },
      include: WITH_AVATAR,
    });
  }

  updateProfile(
    id: string,
    data: Partial<{
      fullName: string;
      phone: string;
      dateOfBirth: Date;
      gender: Gender;
      countryCode: string;
      cityId: string;
      avatarId: string | null;
    }>,
  ): Promise<UserWithAvatar> {
    return this.prisma.user.update({
      where: { id },
      data,
      include: WITH_AVATAR,
    });
  }

  deleteAccount(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async findBySocial(provider: SocialProvider, providerUserId: string): Promise<UserWithAvatar | null> {
    const link = await this.prisma.socialAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
      include: { user: { include: WITH_AVATAR } },
    });
    return link?.user ?? null;
  }

  createFromSocial(input: {
    email: string;
    fullName: string;
    role: Role;
    provider: SocialProvider;
    providerUserId: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: CURRENT_TERMS_VERSION,
        socialAccounts: {
          create: { provider: input.provider, providerUserId: input.providerUserId, email: input.email },
        },
      },
    });
  }

  /**
   * Maujooda email ke account se social login jodta hai.
   * Pending (unverified) account ho to provider ne email verify ki hai, isliye activate kar dete hain
   * aur pending signup wala password hata dete hain (kisi ne pehle se us email se signup kiya ho to uska password nahi chalega).
   */
  linkSocial(
    user: User,
    input: { provider: SocialProvider; providerUserId: string; email: string; fullName: string; role: Role },
  ): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      await tx.socialAccount.create({
        data: { userId: user.id, provider: input.provider, providerUserId: input.providerUserId, email: input.email },
      });
      if (user.status !== UserStatus.PENDING_VERIFICATION) return user;

      return tx.user.update({
        where: { id: user.id },
        data: {
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
          passwordHash: null,
          fullName: input.fullName,
          role: input.role,
          termsAcceptedAt: new Date(),
          termsVersion: CURRENT_TERMS_VERSION,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
    });
  }

  updatePassword(id: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });
  }

  /** Sirf tab set hota hai jab abhi tak password na ho (race-safe). */
  async setInitialPassword(id: string, passwordHash: string): Promise<User | null> {
    const res = await this.prisma.user.updateMany({
      where: { id, passwordHash: null },
      data: { passwordHash },
    });
    return res.count === 0 ? null : this.findById(id);
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
