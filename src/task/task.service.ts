import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TaskService {
  constructor(private prisma: PrismaService) {}

  // Stub implementation - to be expanded
  async findAll() {
    return this.prisma.applicationTask.findMany();
  }
}
