import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  listCities(countryCode: string) {
    return this.prisma.city.findMany({
      where: { countryCode, isActive: true },
      select: { id: true, name: true, province: true },
      orderBy: { name: 'asc' },
    });
  }

  findCity(id: string) {
    return this.prisma.city.findUnique({ where: { id } });
  }
}

