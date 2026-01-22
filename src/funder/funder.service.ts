import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateFunderDto, UpdateFunderDto, FunderQueryDto } from './dto/funder.dto';
import { AuditActionType } from '@prisma/client';

@Injectable()
export class FunderService {
  private readonly logger = new Logger(FunderService.name);

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
          opportunities: {
            select: {
              aiFitScore: true,
              tags: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.funder.count({ where }),
    ]);

    // Compute statistics for each funder
    const fundersWithStats = funders.map(funder => {
      const opportunities = funder.opportunities || [];
      
      // Calculate fit score statistics
      const scoresWithValues = opportunities
        .map(opp => opp.aiFitScore ? Number(opp.aiFitScore) : null)
        .filter((score): score is number => score !== null);
      
      const avgFitScore = scoresWithValues.length > 0
        ? scoresWithValues.reduce((sum, score) => sum + score, 0) / scoresWithValues.length
        : null;
      
      const highFitCount = scoresWithValues.filter(score => score >= 7).length;
      
      // Extract alignment scores from tags
      const alignmentScores = opportunities
        .flatMap(opp => opp.tags || [])
        .filter(tag => tag.startsWith('alignment:'))
        .map(tag => {
          const match = tag.match(/alignment:(\d+)%/);
          return match ? parseInt(match[1], 10) : null;
        })
        .filter((score): score is number => score !== null);
      
      const avgAlignment = alignmentScores.length > 0
        ? alignmentScores.reduce((sum, score) => sum + score, 0) / alignmentScores.length
        : null;
      
      const highAlignmentCount = alignmentScores.filter(score => score >= 70).length;
      
      // Remove opportunities array from response, keep only stats
      const { opportunities: _, ...funderWithoutOpps } = funder;
      
      return {
        ...funderWithoutOpps,
        stats: {
          avgFitScore,
          highFitCount,
          avgAlignment,
          highAlignmentCount,
        },
      };
    });

    return {
      data: fundersWithStats,
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
      select: {
        id: true,
        name: true,
        type: true,
        websiteUrl: true,
        description: true,
        geographies: true,
        tags: true,
        notes: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        opportunities: {
          select: {
            id: true,
            programName: true,
            status: true,
            aiFitScore: true,
            tags: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        contacts: true,
        harvestSources: {
          select: {
            id: true,
            name: true,
            baseUrl: true,
            enabled: true,
            lastRunAt: true,
            lastSuccessAt: true,
          },
        },
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
