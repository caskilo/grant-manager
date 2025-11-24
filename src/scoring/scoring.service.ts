import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { EmbeddingService } from './embedding.service';

export interface FitScore {
  totalScore: number;
  fitLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  components: {
    alignmentScore: number;
    geographyScore: number;
    applicantTypeScore: number;
    awardSizeScore: number;
  };
  details: {
    alignmentMethod: 'embedding' | 'keyword' | 'none';
    reasoning: string[];
  };
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private embeddingService: EmbeddingService,
  ) {}

  /**
   * Calculate fit score for an opportunity
   */
  async calculateFitScore(opportunityId: string): Promise<FitScore> {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opportunity) {
      throw new Error('Opportunity not found');
    }

    const config = await this.configService.getFitScoringConfig();
    const templates = await this.prisma.template.findMany({
      where: {
        type: {
          in: ['BOILERPLATE_1PARA', 'BOILERPLATE_1PAGE'],
        },
        isActive: true,
      },
    });

    // Calculate component scores
    const alignmentScore = await this.calculateAlignmentScore(opportunity, templates);
    const geographyScore = this.calculateGeographyScore(opportunity);
    const applicantTypeScore = this.calculateApplicantTypeScore(opportunity);
    const awardSizeScore = this.calculateAwardSizeScore(opportunity);

    // Weighted total (convert Decimal to number)
    const totalScore = 
      alignmentScore * Number(config.weightAlignment) +
      geographyScore * Number(config.weightGeography) +
      applicantTypeScore * Number(config.weightApplicantType) +
      awardSizeScore * Number(config.weightAwardSize);

    // Determine fit level
    let fitLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    const thresholdHigh = Number(config.thresholdHigh);
    const thresholdMedium = Number(config.thresholdMedium);
    
    if (totalScore >= thresholdHigh) {
      fitLevel = 'HIGH';
    } else if (totalScore >= thresholdMedium) {
      fitLevel = 'MEDIUM';
    } else {
      fitLevel = 'LOW';
    }

    return {
      totalScore: Math.round(totalScore * 100) / 100,
      fitLevel,
      components: {
        alignmentScore: Math.round(alignmentScore * 100) / 100,
        geographyScore: Math.round(geographyScore * 100) / 100,
        applicantTypeScore: Math.round(applicantTypeScore * 100) / 100,
        awardSizeScore: Math.round(awardSizeScore * 100) / 100,
      },
      details: {
        alignmentMethod: 'keyword', // Will be 'embedding' when API key is configured
        reasoning: this.generateReasoning(opportunity, {
          alignmentScore,
          geographyScore,
          applicantTypeScore,
          awardSizeScore,
        }),
      },
    };
  }

  /**
   * Calculate alignment score using embeddings or keyword matching
   */
  private async calculateAlignmentScore(opportunity: any, templates: any[]): Promise<number> {
    // Try embedding-based scoring first
    const embeddingScore = await this.calculateEmbeddingAlignment(opportunity, templates);
    if (embeddingScore !== null) {
      return embeddingScore;
    }

    // Fallback to keyword-based scoring
    return this.calculateKeywordAlignment(opportunity);
  }

  /**
   * Calculate alignment using embedding similarity
   */
  private async calculateEmbeddingAlignment(opportunity: any, templates: any[]): Promise<number | null> {
    try {
      // Get or generate opportunity embedding
      let oppEmbedding = await this.getOpportunityEmbedding(opportunity.id);
      
      if (!oppEmbedding) {
        const oppText = this.embeddingService.prepareOpportunityText(opportunity);
        const embedding = await this.embeddingService.generateEmbedding(oppText);
        
        if (!embedding) {
          return null;
        }

        // Store embedding for future use
        await this.storeOpportunityEmbedding(opportunity.id, embedding);
        oppEmbedding = embedding;
      }

      // Get organization mission embedding
      const orgText = this.embeddingService.prepareOrganizationText(templates);
      const orgEmbedding = await this.embeddingService.generateEmbedding(orgText);

      if (!orgEmbedding) {
        return null;
      }

      // Calculate cosine similarity
      const similarity = this.embeddingService.cosineSimilarity(oppEmbedding, orgEmbedding);
      
      // Convert similarity (-1 to 1) to score (0 to 10)
      return ((similarity + 1) / 2) * 10;
    } catch (error: any) {
      this.logger.error(`Embedding alignment calculation failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate alignment using keyword matching (fallback)
   */
  private calculateKeywordAlignment(opportunity: any): number {
    const keywords = [
      'flourishing', 'odyssean', 'grain', 'agriculture', 'resilience',
      'innovation', 'research', 'sustainability', 'development', 'impact'
    ];

    const text = `${opportunity.programName || ''} ${opportunity.rawDescription || ''} ${opportunity.declaredFocus?.join(' ') || ''}`.toLowerCase();
    
    const matchCount = keywords.filter(keyword => text.includes(keyword)).length;
    const score = (matchCount / keywords.length) * 10;

    return Math.min(score + 3, 10); // Add baseline score, cap at 10
  }

  /**
   * Calculate geography match score
   */
  private calculateGeographyScore(opportunity: any): number {
    const preferredGeographies = ['UK', 'United Kingdom', 'England', 'Scotland', 'Wales', 'Europe'];
    
    if (!opportunity.geographies || opportunity.geographies.length === 0) {
      return 5; // Neutral score if not specified
    }

    const isPreferred = opportunity.geographies.some((geo: string) =>
      preferredGeographies.some(pref => 
        geo.toLowerCase().includes(pref.toLowerCase())
      )
    );

    return isPreferred ? 10 : 6;
  }

  /**
   * Calculate applicant type match score
   */
  private calculateApplicantTypeScore(opportunity: any): number {
    const preferredTypes = ['CHARITY', 'RESEARCH_INSTITUTE', 'UNIVERSITY', 'NONPROFIT'];
    
    if (!opportunity.eligibleApplicantTypes || opportunity.eligibleApplicantTypes.length === 0) {
      return 5; // Neutral score if not specified
    }

    const isPreferred = opportunity.eligibleApplicantTypes.some((type: string) =>
      preferredTypes.includes(type.toUpperCase())
    );

    return isPreferred ? 10 : 6;
  }

  /**
   * Calculate award size match score
   */
  private calculateAwardSizeScore(opportunity: any): number {
    const idealMin = 10000; // £10k
    const idealMax = 500000; // £500k

    if (!opportunity.minAward && !opportunity.maxAward) {
      return 5; // Neutral score if not specified
    }

    const oppMin = opportunity.minAward ? Number(opportunity.minAward) : 0;
    const oppMax = opportunity.maxAward ? Number(opportunity.maxAward) : Infinity;

    // Check if ideal range overlaps with opportunity range
    const hasOverlap = oppMin <= idealMax && oppMax >= idealMin;

    if (hasOverlap) {
      // Calculate overlap percentage
      const overlapMin = Math.max(oppMin, idealMin);
      const overlapMax = Math.min(oppMax, idealMax);
      const overlapSize = overlapMax - overlapMin;
      const idealSize = idealMax - idealMin;
      const overlapRatio = overlapSize / idealSize;

      return 5 + (overlapRatio * 5); // 5-10 based on overlap
    }

    return 3; // Low score if no overlap
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(opportunity: any, scores: any): string[] {
    const reasoning: string[] = [];

    if (scores.alignmentScore >= 7) {
      reasoning.push('Strong thematic alignment with organizational mission');
    } else if (scores.alignmentScore >= 5) {
      reasoning.push('Moderate thematic alignment');
    } else {
      reasoning.push('Limited thematic alignment');
    }

    if (scores.geographyScore >= 8) {
      reasoning.push('Excellent geographic match');
    }

    if (scores.applicantTypeScore >= 8) {
      reasoning.push('Ideal applicant type');
    }

    if (scores.awardSizeScore >= 7) {
      reasoning.push('Award size within preferred range');
    }

    return reasoning;
  }

  /**
   * Get stored embedding for opportunity
   */
  private async getOpportunityEmbedding(opportunityId: string): Promise<number[] | null> {
    const embedding = await this.prisma.embedding.findFirst({
      where: { opportunityId },
      orderBy: { createdAt: 'desc' },
    });

    if (!embedding) {
      return null;
    }

    // Parse vector from database (pgvector format)
    // This is a placeholder - actual implementation depends on pgvector driver
    return null;
  }

  /**
   * Store embedding for opportunity
   */
  private async storeOpportunityEmbedding(opportunityId: string, embedding: number[]): Promise<void> {
    try {
      // Store embedding in database
      // This is a placeholder - actual implementation depends on pgvector driver
      await this.prisma.embedding.create({
        data: {
          opportunityId,
          modelName: 'text-embedding-3-small',
          // embedding: embedding, // Would need proper pgvector format
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to store embedding: ${error.message}`);
    }
  }

  /**
   * Update opportunity with calculated score
   */
  async updateOpportunityScore(opportunityId: string): Promise<void> {
    const fitScore = await this.calculateFitScore(opportunityId);

    await this.prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        aiFitScore: fitScore.totalScore,
        aiFitReasons: fitScore.details.reasoning,
      },
    });

    this.logger.log(`Updated opportunity ${opportunityId} with fit score: ${fitScore.totalScore} (${fitScore.fitLevel})`);
  }

  /**
   * Batch calculate scores for multiple opportunities
   */
  async batchCalculateScores(opportunityIds: string[]): Promise<Map<string, FitScore>> {
    const scores = new Map<string, FitScore>();

    for (const id of opportunityIds) {
      try {
        const score = await this.calculateFitScore(id);
        scores.set(id, score);
        await this.updateOpportunityScore(id);
      } catch (error: any) {
        this.logger.error(`Failed to calculate score for ${id}: ${error.message}`);
      }
    }

    return scores;
  }
}
