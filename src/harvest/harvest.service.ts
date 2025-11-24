import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateHarvestSourceDto, UpdateHarvestSourceDto } from './dto';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class HarvestService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    @InjectQueue('harvest') private harvestQueue: Queue,
  ) {}

  /**
   * Find all harvest sources with pagination
   */
  async findAll(params?: {
    enabled?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { enabled, page = 1, limit = 50 } = params || {};

    const where: any = {};
    if (enabled !== undefined) where.enabled = enabled;

    const [data, total] = await Promise.all([
      this.prisma.harvestSource.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.harvestSource.count({ where }),
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
   * Find harvest source by ID
   */
  async findOne(id: string) {
    const source = await this.prisma.harvestSource.findUnique({
      where: { id },
    });

    if (!source) {
      throw new NotFoundException(`Harvest source with ID ${id} not found`);
    }

    return source;
  }

  /**
   * Create new harvest source
   */
  async create(data: CreateHarvestSourceDto, userId: string) {
    const source = await this.prisma.harvestSource.create({
      data: {
        ...data,
        enabled: data.enabled ?? false,
        cronSchedule: data.cronSchedule ?? '0 3 * * *',
        config: data.config ?? {},
      },
    });

    await this.audit.log('CREATE', 'harvest_source', source.id, userId, {
      name: source.name,
      baseUrl: source.baseUrl,
    });

    return source;
  }

  /**
   * Update harvest source
   */
  async update(id: string, data: UpdateHarvestSourceDto, userId: string) {
    await this.findOne(id);

    const source = await this.prisma.harvestSource.update({
      where: { id },
      data,
    });

    await this.audit.log('UPDATE', 'harvest_source', source.id, userId, {
      changes: data,
    });

    return source;
  }

  /**
   * Delete harvest source
   */
  async remove(id: string, userId: string) {
    const source = await this.findOne(id);

    await this.prisma.harvestSource.delete({
      where: { id },
    });

    await this.audit.log('DELETE', 'harvest_source', id, userId, {
      name: source.name,
    });

    return { message: 'Harvest source deleted successfully' };
  }

  /**
   * Trigger harvest for a specific source
   */
  async triggerHarvest(id: string, userId: string) {
    const source = await this.findOne(id);

    if (!source.enabled) {
      throw new Error('Cannot trigger harvest for disabled source');
    }

    // Enqueue harvest job
    const job = await this.harvestQueue.add('process-harvest', {
      sourceId: source.id,
      userId,
    });

    await this.audit.log('CREATE', 'harvest_job', source.id, userId, {
      sourceName: source.name,
      jobId: job.id,
    });

    return {
      message: 'Harvest job enqueued',
      jobId: job.id,
      source: {
        id: source.id,
        name: source.name,
      },
    };
  }

  /**
   * Get enabled sources for scheduled harvesting
   */
  async getEnabledSources() {
    return this.prisma.harvestSource.findMany({
      where: { enabled: true },
      orderBy: { name: 'asc' },
    });
  }
}
