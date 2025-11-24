import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateInteractionDto, UpdateInteractionDto } from './dto';

@Injectable()
export class InteractionService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /**
   * Find all interactions with optional filtering
   */
  async findAll(params?: {
    interactionType?: string;
    contactId?: string;
    applicationId?: string;
    page?: number;
    limit?: number;
  }) {
    const { interactionType, contactId, applicationId, page = 1, limit = 50 } = params || {};

    const where: any = {};
    if (interactionType) where.interactionType = interactionType;
    if (contactId) where.contactId = contactId;
    if (applicationId) where.applicationId = applicationId;

    const [data, total] = await Promise.all([
      this.prisma.interaction.findMany({
        where,
        include: {
          contact: { select: { id: true, name: true, email: true } },
          application: {
            select: {
              id: true,
              title: true,
              stage: true,
              opportunity: { select: { id: true, programName: true } },
            },
          },
          createdBy: { select: { id: true, name: true, email: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.interaction.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find interaction by ID
   */
  async findOne(id: string) {
    const interaction = await this.prisma.interaction.findUnique({
      where: { id },
      include: {
        contact: { select: { id: true, name: true, email: true, roleTitle: true } },
        application: {
          select: {
            id: true,
            title: true,
            stage: true,
            opportunity: {
              select: {
                id: true,
                programName: true,
                funder: { select: { id: true, name: true } },
              },
            },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!interaction) {
      throw new NotFoundException(`Interaction with ID ${id} not found`);
    }

    return interaction;
  }

  /**
   * Create new interaction (CRM note)
   */
  async create(data: CreateInteractionDto, userId: string) {
    const interaction = await this.prisma.interaction.create({
      data: {
        ...data,
        occurredAt: new Date(data.occurredAt),
        createdById: userId,
      },
      include: {
        contact: { select: { id: true, name: true } },
        application: { select: { id: true, title: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await this.audit.log('CREATE', 'interaction', interaction.id, userId, {
      interactionType: interaction.interactionType,
      contactId: interaction.contactId,
      applicationId: interaction.applicationId,
    });

    return interaction;
  }

  /**
   * Update interaction
   */
  async update(id: string, data: UpdateInteractionDto, userId: string) {
    // Check if interaction exists
    await this.findOne(id);

    const updateData: any = { ...data };
    if (data.occurredAt) {
      updateData.occurredAt = new Date(data.occurredAt);
    }

    const interaction = await this.prisma.interaction.update({
      where: { id },
      data: updateData,
      include: {
        contact: { select: { id: true, name: true } },
        application: { select: { id: true, title: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await this.audit.log('UPDATE', 'interaction', interaction.id, userId, {
      changes: data,
    });

    return interaction;
  }

  /**
   * Delete interaction
   */
  async remove(id: string, userId: string) {
    // Check if interaction exists
    const interaction = await this.findOne(id);

    await this.prisma.interaction.delete({
      where: { id },
    });

    await this.audit.log('DELETE', 'interaction', id, userId, {
      interactionType: interaction.interactionType,
      summary: interaction.summary,
    });

    return { message: 'Interaction deleted successfully' };
  }

  /**
   * Get recent interactions for a contact
   */
  async getRecentForContact(contactId: string, limit = 10) {
    return this.prisma.interaction.findMany({
      where: { contactId },
      include: {
        application: {
          select: {
            id: true,
            title: true,
            opportunity: { select: { programName: true } },
          },
        },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get recent interactions for an application
   */
  async getRecentForApplication(applicationId: string, limit = 10) {
    return this.prisma.interaction.findMany({
      where: { applicationId },
      include: {
        contact: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get interaction statistics by type
   */
  async getStatsByType(params?: { startDate?: Date; endDate?: Date }) {
    const where: any = {};
    if (params?.startDate || params?.endDate) {
      where.occurredAt = {};
      if (params.startDate) where.occurredAt.gte = params.startDate;
      if (params.endDate) where.occurredAt.lte = params.endDate;
    }

    const stats = await this.prisma.interaction.groupBy({
      by: ['interactionType'],
      where,
      _count: { _all: true },
    });

    return stats.map(stat => ({
      interactionType: stat.interactionType,
      count: stat._count._all,
    }));
  }
}
