import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApplicationService {
  constructor(private prisma: PrismaService) {}

  // Stub implementation - to be expanded
  async findAll() {
    return this.prisma.application.findMany({
      include: {
        opportunity: {
          include: {
            funder: true,
          },
        },
        leadOwner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
