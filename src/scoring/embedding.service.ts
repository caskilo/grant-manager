import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly openaiApiKey: string;
  private readonly embeddingModel: string;

  constructor(private nestConfigService: NestConfigService) {
    this.openaiApiKey = this.nestConfigService.get('OPENAI_API_KEY') || '';
    this.embeddingModel = this.nestConfigService.get('EMBEDDING_MODEL') || 'text-embedding-3-small';
  }

  /**
   * Generate embedding vector for text using OpenAI API
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.openaiApiKey) {
      this.logger.warn('OpenAI API key not configured, skipping embedding generation');
      return null;
    }

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          input: text,
          model: this.embeddingModel,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      return response.data.data[0].embedding;
    } catch (error: any) {
      this.logger.error(`Failed to generate embedding: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Prepare text for embedding by combining relevant fields
   */
  prepareOpportunityText(opportunity: any): string {
    const parts: string[] = [];

    if (opportunity.programName) parts.push(opportunity.programName);
    if (opportunity.rawDescription) parts.push(opportunity.rawDescription);
    if (opportunity.declaredFocus && opportunity.declaredFocus.length > 0) {
      parts.push(`Focus areas: ${opportunity.declaredFocus.join(', ')}`);
    }
    if (opportunity.geographies && opportunity.geographies.length > 0) {
      parts.push(`Geography: ${opportunity.geographies.join(', ')}`);
    }
    if (opportunity.eligibleApplicantTypes && opportunity.eligibleApplicantTypes.length > 0) {
      parts.push(`Applicant types: ${opportunity.eligibleApplicantTypes.join(', ')}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Prepare organization mission text for embedding
   */
  prepareOrganizationText(templates: any[]): string {
    // Combine organization mission templates
    const missionTexts = templates
      .filter(t => t.type === 'BOILERPLATE_1PARA' || t.type === 'BOILERPLATE_1PAGE')
      .map(t => t.content);

    return missionTexts.join('\n\n');
  }
}
