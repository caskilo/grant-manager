import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateContactDto, UpdateContactDto } from './dto';

@Injectable()
export class ContactService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /**
   * Find all contacts with optional filtering
   */
  async findAll(params?: {
    funderId?: string;
    opportunityId?: string;
    page?: number;
    limit?: number;
  }) {
    const { funderId, opportunityId, page = 1, limit = 50 } = params || {};

    const where: any = {};
    if (funderId) where.funderId = funderId;
    if (opportunityId) where.opportunityId = opportunityId;

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        include: {
          funder: { select: { id: true, name: true } },
          opportunity: { select: { id: true, programName: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.contact.count({ where }),
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
   * Find contact by ID
   */
  async findOne(id: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
      include: {
        funder: { select: { id: true, name: true } },
        opportunity: { select: { id: true, programName: true } },
        interactions: {
          select: {
            id: true,
            interactionType: true,
            summary: true,
            occurredAt: true,
          },
          orderBy: { occurredAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    return contact;
  }

  /**
   * Create new contact
   */
  async create(data: CreateContactDto, userId: string) {
    // Validate that at least one of funderId or opportunityId is provided
    if (!data.funderId && !data.opportunityId) {
      throw new Error('Contact must be associated with either a funder or an opportunity');
    }

    // If setting as primary, unset other primary contacts for the same entity
    if (data.isPrimary) {
      if (data.funderId) {
        await this.prisma.contact.updateMany({
          where: { funderId: data.funderId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      if (data.opportunityId) {
        await this.prisma.contact.updateMany({
          where: { opportunityId: data.opportunityId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
    }

    const contact = await this.prisma.contact.create({
      data,
      include: {
        funder: { select: { id: true, name: true } },
        opportunity: { select: { id: true, programName: true } },
      },
    });

    await this.audit.log('CREATE', 'contact', contact.id, userId, {
      funderId: contact.funderId,
      opportunityId: contact.opportunityId,
    });

    return contact;
  }

  /**
   * Update contact
   */
  async update(id: string, data: UpdateContactDto, userId: string) {
    // Check if contact exists
    await this.findOne(id);

    // If setting as primary, unset other primary contacts
    if (data.isPrimary) {
      const existing = await this.prisma.contact.findUnique({
        where: { id },
        select: { funderId: true, opportunityId: true },
      });

      if (existing?.funderId) {
        await this.prisma.contact.updateMany({
          where: { funderId: existing.funderId, isPrimary: true, id: { not: id } },
          data: { isPrimary: false },
        });
      }
      if (existing?.opportunityId) {
        await this.prisma.contact.updateMany({
          where: { opportunityId: existing.opportunityId, isPrimary: true, id: { not: id } },
          data: { isPrimary: false },
        });
      }
    }

    const contact = await this.prisma.contact.update({
      where: { id },
      data,
      include: {
        funder: { select: { id: true, name: true } },
        opportunity: { select: { id: true, programName: true } },
      },
    });

    await this.audit.log('UPDATE', 'contact', contact.id, userId, {
      changes: data,
    });

    return contact;
  }

  /**
   * Delete contact
   */
  async remove(id: string, userId: string) {
    // Check if contact exists
    const contact = await this.findOne(id);

    await this.prisma.contact.delete({
      where: { id },
    });

    await this.audit.log('DELETE', 'contact', id, userId, {
      contactName: contact.name,
    });

    return { message: 'Contact deleted successfully' };
  }

  /**
   * Get primary contact for a funder
   */
  async getPrimaryForFunder(funderId: string) {
    return this.prisma.contact.findFirst({
      where: { funderId, isPrimary: true },
      include: {
        funder: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Get primary contact for an opportunity
   */
  async getPrimaryForOpportunity(opportunityId: string) {
    return this.prisma.contact.findFirst({
      where: { opportunityId, isPrimary: true },
      include: {
        opportunity: { select: { id: true, programName: true } },
      },
    });
  }
}
