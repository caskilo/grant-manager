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
   * Get job status and progress from BullMQ
   */
  async getJobStatus(jobId: string) {
    const job = await this.harvestQueue.getJob(jobId);
    
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const state = await job.getState();
    const progress = job.progress;
    const failedReason = job.failedReason;

    return {
      id: job.id,
      name: job.name,
      state,
      progress,
      failedReason,
      data: job.data,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }

  /**
   * Find all harvest sources with pagination
   */
  async findAll(params?: {
    enabled?: boolean;
    funderId?: string;
    page?: number;
    limit?: number;
  }) {
    const { enabled, funderId, page = 1, limit = 50 } = params || {};

    const where: any = {};
    if (enabled !== undefined) where.enabled = enabled;
    if (funderId) where.funderId = funderId;

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
  async create(createHarvestSourceDto: CreateHarvestSourceDto, userId: string) {
    // Provide default scraper config if not specified
    const defaultConfig = {
      mode: 'static',
      selectors: {
        itemContainer: '.opportunity, .grant, .funding',
        programName: 'h2, h3, .title, .program-name',
        description: 'p, .description, .summary',
        url: 'a[href]',
        deadline: '.deadline, .closing-date, time',
        geographies: '.location, .geography, .region',
        awardAmount: '.amount, .funding, .award',
      },
      pagination: {
        enabled: false,
      },
    };

    const source = await this.prisma.harvestSource.create({
      data: {
        ...createHarvestSourceDto,
        config: createHarvestSourceDto.config || defaultConfig,
        enabled: createHarvestSourceDto.enabled ?? true, // Enable by default
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

  /**
   * Discover potential harvest sources from a funder's website
   * @param funderId - The funder to discover sources for
   * @param userId - The user initiating the discovery
   * @param options - Optional parameters including manual links to include
   */
  async discoverSourcesForFunder(
    funderId: string,
    userId: string,
    options?: { manualLinks?: string[]; searchDepth?: number },
  ) {
    // Load funder to validate and get website URL
    const funder = await this.prisma.funder.findUnique({
      where: { id: funderId },
      select: { id: true, name: true, websiteUrl: true },
    });

    if (!funder) {
      throw new Error(`Funder with ID ${funderId} not found`);
    }

    // Manual links can be provided even without a website URL
    const manualLinks = options?.manualLinks?.filter(link => {
      try {
        new URL(link);
        return true;
      } catch {
        return false;
      }
    }) || [];

    // Need at least website URL OR manual links
    if (!funder.websiteUrl && manualLinks.length === 0) {
      throw new Error(
        `Funder ${funder.name} does not have a website URL configured and no manual links were provided`,
      );
    }

    // Enqueue source discovery job with both seed URL and manual links
    const job = await this.harvestQueue.add('discover-sources', {
      funderId: funder.id,
      seedUrl: funder.websiteUrl || manualLinks[0], // Use first manual link if no website
      manualLinks,
      searchDepth: options?.searchDepth || 2, // Default to 2 levels
      userId,
    });

    await this.audit.log('CREATE', 'source_discovery_job', funder.id, userId, {
      funderName: funder.name,
      seedUrl: funder.websiteUrl,
      manualLinksCount: manualLinks.length,
      jobId: job.id,
    });

    return {
      message: 'Source discovery job enqueued',
      jobId: job.id,
      funder: {
        id: funder.id,
        name: funder.name,
      },
      manualLinksIncluded: manualLinks.length,
    };
  }

  /**
   * Get suggested sources for a funder from discovery runs
   */
  async getSuggestedSources(funderId: string) {
    const funder = await this.prisma.funder.findUnique({
      where: { id: funderId },
      select: { id: true, name: true },
    });

    if (!funder) {
      throw new Error(`Funder with ID ${funderId} not found`);
    }

    // Read from filesystem - find the most recent discovery run for this funder
    const fs = require('fs/promises');
    const path = require('path');
    
    const funderSlug = this.slugify(funder.name);
    const funderDiscoveryPath = path.join(
      process.cwd(),
      '..',
      'frontend',
      'discovery',
      funderSlug,
    );

    try {
      await fs.access(funderDiscoveryPath);
    } catch {
      // Directory doesn't exist yet
      return {
        sources: [],
        lastDiscoveryAt: null,
      };
    }

    // Read sources.json directly from funder directory
    const sourcesPath = path.join(funderDiscoveryPath, 'sources.json');

    try {
      const sourcesJson = await fs.readFile(sourcesPath, 'utf-8');
      const result = JSON.parse(sourcesJson);

      return {
        sources: result.sources || [],
        lastDiscoveryAt: result.discoveredAt,
        stats: result.stats,
        warnings: result.warnings,
      };
    } catch (error) {
      throw new Error(`Failed to read discovery results: ${error.message}`);
    }
  }

  /**
   * Helper to slugify funder name for directory matching
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
