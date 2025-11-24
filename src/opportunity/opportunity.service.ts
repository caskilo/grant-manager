import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateOpportunityDto,
  UpdateOpportunityDto,
  OpportunityQueryDto,
} from './dto/opportunity.dto';
import { AuditActionType } from '@prisma/client';

@Injectable()
export class OpportunityService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(query: OpportunityQueryDto) {
    const {
      funderId,
      minScore,
      maxScore,
      status,
      tags,
      search,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (funderId) where.funderId = funderId;
    if (status) where.status = status;
    if (tags && tags.length > 0) where.tags = { hasSome: tags };

    if (minScore !== undefined || maxScore !== undefined) {
      where.aiFitScore = {};
      if (minScore !== undefined) where.aiFitScore.gte = minScore;
      if (maxScore !== undefined) where.aiFitScore.lte = maxScore;
    }

    if (search) {
      where.OR = [
        { programName: { contains: search, mode: 'insensitive' } },
        { rawDescription: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [opportunities, total] = await Promise.all([
      this.prisma.opportunity.findMany({
        where,
        include: {
          funder: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          _count: {
            select: {
              applications: true,
              contacts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.opportunity.count({ where }),
    ]);

    return {
      data: opportunities,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id },
      include: {
        funder: true,
        contacts: true,
        applications: {
          select: {
            id: true,
            title: true,
            stage: true,
            outcome: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            applications: true,
            contacts: true,
            attachments: true,
          },
        },
      },
    });

    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }

    return opportunity;
  }

  async create(createOpportunityDto: CreateOpportunityDto, userId: string) {
    const opportunity = await this.prisma.opportunity.create({
      data: {
        ...createOpportunityDto,
        createdById: userId,
      },
      include: {
        funder: true,
      },
    });

    await this.auditService.log(
      AuditActionType.CREATE,
      'OPPORTUNITY',
      opportunity.id,
      userId,
      { programName: opportunity.programName, funderId: opportunity.funderId },
    );

    // TODO: Enqueue scoring job in Sprint 2

    return opportunity;
  }

  async update(id: string, updateOpportunityDto: UpdateOpportunityDto, userId: string) {
    await this.findOne(id);

    const opportunity = await this.prisma.opportunity.update({
      where: { id },
      data: updateOpportunityDto,
      include: {
        funder: true,
      },
    });

    await this.auditService.log(
      AuditActionType.UPDATE,
      'OPPORTUNITY',
      opportunity.id,
      userId,
      { changes: updateOpportunityDto },
    );

    // TODO: Enqueue scoring job if relevant fields changed

    return opportunity;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);

    const opportunity = await this.prisma.opportunity.delete({
      where: { id },
    });

    await this.auditService.log(
      AuditActionType.DELETE,
      'OPPORTUNITY',
      opportunity.id,
      userId,
      { programName: opportunity.programName },
    );

    return opportunity;
  }
}
