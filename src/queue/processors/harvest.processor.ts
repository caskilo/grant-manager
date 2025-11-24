import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { ScraperService, ScraperConfig } from '../../harvest/scraper.service';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * HarvestProcessor - Executes web scraping jobs
 * 
 * Protocol:
 * 1. Load HarvestSource configuration
 * 2. Execute scraper with configured selectors
 * 3. Save results to discovery folder
 * 4. Update harvest source metadata
 */
@Processor('harvest')
export class HarvestProcessor extends WorkerHost {
  private readonly logger = new Logger(HarvestProcessor.name);

  constructor(
    private prisma: PrismaService,
    private scraper: ScraperService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { sourceId, userId } = job.data;
    this.logger.log(`Processing harvest job ${job.id} for source ${sourceId}`);

    try {
      // Load harvest source
      const source = await this.prisma.harvestSource.findUnique({
        where: { id: sourceId },
      });

      if (!source) {
        throw new Error(`Harvest source ${sourceId} not found`);
      }

      if (!source.enabled) {
        throw new Error(`Harvest source ${source.name} is disabled`);
      }

      // Update lastRunAt
      await this.prisma.harvestSource.update({
        where: { id: sourceId },
        data: { lastRunAt: new Date() },
      });

      // Execute scraper
      this.logger.log(`Scraping ${source.baseUrl} with config`, source.config);
      const opportunities = await this.scraper.scrape(
        source.baseUrl,
        source.config as unknown as ScraperConfig,
      );

      this.logger.log(`Scraped ${opportunities.length} opportunities`);

      // Save results to discovery folder
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const runId = `${source.name.toLowerCase().replace(/\s+/g, '-')}_${timestamp}`;
      const discoveryDir = path.join(process.cwd(), '.project', 'discovery', 'runs', runId);
      
      await fs.mkdir(discoveryDir, { recursive: true });

      // Create discovery plan
      const plan = {
        runId,
        sourceType: 'web_scrape',
        sourceName: source.name,
        sourceUrl: source.baseUrl,
        config: source.config,
        timestamp: new Date().toISOString(),
        totalOpportunities: opportunities.length,
        opportunities: opportunities.map((opp, index) => ({
          id: `${runId}_opp_${index + 1}`,
          ...opp,
        })),
      };

      await fs.writeFile(
        path.join(discoveryDir, 'plan.json'),
        JSON.stringify(plan, null, 2),
      );

      // Create summary
      const summary = {
        runId,
        source: {
          id: source.id,
          name: source.name,
          baseUrl: source.baseUrl,
        },
        executedAt: new Date().toISOString(),
        status: 'completed',
        stats: {
          opportunitiesFound: opportunities.length,
          newFunders: new Set(opportunities.map(o => o.funderName).filter(Boolean)).size,
        },
      };

      await fs.writeFile(
        path.join(discoveryDir, 'summary.json'),
        JSON.stringify(summary, null, 2),
      );

      // Update harvest source success metadata
      await this.prisma.harvestSource.update({
        where: { id: sourceId },
        data: { lastSuccessAt: new Date() },
      });

      this.logger.log(`Harvest job ${job.id} completed successfully`);

      return {
        success: true,
        runId,
        opportunitiesFound: opportunities.length,
        discoveryPath: discoveryDir,
      };
    } catch (error) {
      this.logger.error(`Harvest job ${job.id} failed:`, error);
      throw error;
    }
  }
}
