import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto';
import { TemplateType } from '@prisma/client';

@Injectable()
export class TemplateService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /**
   * Find all templates with optional filtering
   */
  async findAll(params?: {
    type?: TemplateType;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { type, isActive = true, page = 1, limit = 50 } = params || {};

    const where: any = { isActive };
    if (type) where.type = type;

    const [data, total] = await Promise.all([
      this.prisma.template.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          _count: { select: { usages: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.template.count({ where }),
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
   * Find template by ID
   */
  async findOne(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        usages: {
          select: {
            id: true,
            application: {
              select: {
                id: true,
                title: true,
                stage: true,
              },
            },
            usedAt: true,
          },
          orderBy: { usedAt: 'desc' },
          take: 20,
        },
        _count: { select: { usages: true } },
      },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return template;
  }

  /**
   * Create new template
   */
  async create(data: CreateTemplateDto, userId: string) {
    const template = await this.prisma.template.create({
      data: {
        ...data,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await this.audit.log('CREATE', 'template', template.id, userId, {
      templateName: template.name,
      type: template.type,
    });

    return template;
  }

  /**
   * Update template
   */
  async update(id: string, data: UpdateTemplateDto, userId: string) {
    // Check if template exists
    await this.findOne(id);

    const template = await this.prisma.template.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await this.audit.log('UPDATE', 'template', template.id, userId, {
      changes: data,
    });

    return template;
  }

  /**
   * Soft delete template (set isActive to false)
   */
  async remove(id: string, userId: string) {
    // Check if template exists
    const template = await this.findOne(id);

    await this.prisma.template.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.log('DELETE', 'template', id, userId, {
      templateName: template.name,
    });

    return { message: 'Template deactivated successfully' };
  }

  /**
   * Duplicate a template
   */
  async duplicate(id: string, userId: string) {
    const original = await this.findOne(id);

    const template = await this.prisma.template.create({
      data: {
        name: `${original.name} (Copy)`,
        type: original.type,
        content: original.content,
        tags: original.tags,
        isActive: true,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await this.audit.log('CREATE', 'template', template.id, userId, {
      originalTemplateId: id,
    });

    return template;
  }

  /**
   * Get templates by type
   */
  async findByType(type: TemplateType) {
    return this.prisma.template.findMany({
      where: { type, isActive: true },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Track template usage
   */
  async recordUsage(templateId: string, applicationId: string, userId: string) {
    const usage = await this.prisma.templateUsage.create({
      data: {
        templateId,
        applicationId,
        usedById: userId,
        usedAt: new Date(),
      },
    });

    await this.audit.log('CREATE', 'template_usage', usage.id, userId, {
      templateId,
      applicationId,
    });

    return usage;
  }
}
