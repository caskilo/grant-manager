import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  // Stub implementation - to be expanded
  async findAll() {
    return this.prisma.applicationReview.findMany();
  }
}
