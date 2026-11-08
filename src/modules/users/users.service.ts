import { Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  // OTP verified, safe to upsert
  findOrCreateVerified(email: string): Promise<User> {
    return this.prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, role: Role.CUSTOMER, emailVerifiedAt: new Date() },
    });
  }

  updateProfile(id: string, data: { name?: string; phone?: string }): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }
}

