import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ScoringService } from '../../scoring/scoring.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface ScoringJobData {
  opportunityId: string;
  userId?: string;
}

export interface BatchScoringJobData {
  opportunityIds: string[];
  userId?: string;
}

@Processor('scoring')
export class ScoringProcessor extends WorkerHost {
  private readonly logger = new Logger(ScoringProcessor.name);

  constructor(
    private scoringService: ScoringService,
    private prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<ScoringJobData | BatchScoringJobData>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    try {
      switch (job.name) {
        case 'calculate-score':
          return await this.handleCalculateScore(job.data as ScoringJobData);
        
        case 'batch-calculate-scores':
          return await this.handleBatchCalculateScores(job.data as BatchScoringJobData);
        
        case 'recalculate-all-scores':
          return await this.handleRecalculateAllScores();
        
        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
          return { success: false, error: 'Unknown job type' };
      }
    } catch (error: any) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleCalculateScore(data: ScoringJobData) {
    const { opportunityId } = data;
    
    this.logger.log(`Calculating score for opportunity ${opportunityId}`);
    
    const score = await this.scoringService.calculateFitScore(opportunityId);
    await this.scoringService.updateOpportunityScore(opportunityId);
    
    return {
      success: true,
      opportunityId,
      score: score.totalScore,
      fitLevel: score.fitLevel,
    };
  }

  private async handleBatchCalculateScores(data: BatchScoringJobData) {
    const { opportunityIds } = data;
    
    this.logger.log(`Batch calculating scores for ${opportunityIds.length} opportunities`);
    
    const results = await this.scoringService.batchCalculateScores(opportunityIds);
    
    return {
      success: true,
      processed: opportunityIds.length,
      results: Object.fromEntries(results),
    };
  }

  private async handleRecalculateAllScores() {
    this.logger.log('Recalculating scores for all active opportunities');
    
    const opportunities = await this.prisma.opportunity.findMany({
      where: { status: 'OPEN' },
      select: { id: true },
    });

    const opportunityIds = opportunities.map(o => o.id);
    const results = await this.scoringService.batchCalculateScores(opportunityIds);
    
    return {
      success: true,
      processed: opportunityIds.length,
      results: Object.fromEntries(results),
    };
  }
}
