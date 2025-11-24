import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateFunderDto, UpdateFunderDto, FunderQueryDto } from './dto/funder.dto';
import { AuditActionType } from '@prisma/client';

@Injectable()
export class FunderService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(query: FunderQueryDto) {
    const { search, tags, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    const [funders, total] = await Promise.all([
      this.prisma.funder.findMany({
        where,
        include: {
          _count: {
            select: {
              opportunities: true,
              contacts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.funder.count({ where }),
    ]);

    return {
      data: funders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const funder = await this.prisma.funder.findUnique({
      where: { id },
      include: {
        opportunities: {
          select: {
            id: true,
            programName: true,
            status: true,
            aiFitScore: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        contacts: true,
        _count: {
          select: {
            opportunities: true,
            contacts: true,
            attachments: true,
          },
        },
      },
    });

    if (!funder) {
      throw new NotFoundException('Funder not found');
    }

    return funder;
  }

  async create(createFunderDto: CreateFunderDto, userId: string) {
    const funder = await this.prisma.funder.create({
      data: {
        ...createFunderDto,
        createdById: userId,
      },
    });

    await this.auditService.log(
      AuditActionType.CREATE,
      'FUNDER',
      funder.id,
      userId,
      { name: funder.name, type: funder.type },
    );

    return funder;
  }

  async update(id: string, updateFunderDto: UpdateFunderDto, userId: string) {
    await this.findOne(id);

    const funder = await this.prisma.funder.update({
      where: { id },
      data: updateFunderDto,
    });

    await this.auditService.log(
      AuditActionType.UPDATE,
      'FUNDER',
      funder.id,
      userId,
      { changes: updateFunderDto },
    );

    return funder;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);

    const funder = await this.prisma.funder.delete({
      where: { id },
    });

    await this.auditService.log(
      AuditActionType.DELETE,
      'FUNDER',
      funder.id,
      userId,
      { name: funder.name },
    );

    return funder;
  }
}
