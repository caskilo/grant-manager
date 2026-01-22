import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  ODYSSEAN_RESEARCH_STRANDS,
  CROSS_CUTTING_THEMES,
  METHODOLOGICAL_PREFERENCES,
  ALIGNMENT_WEIGHTS,
  CONFIDENCE_THRESHOLDS,
  getOdysseanContextPrompt,
} from './odyssean-criteria';

/**
 * OdysseanAlignmentService - Scores grants for alignment with Odyssean Institute agenda
 * 
 * Multi-dimensional scoring:
 * 1. Research strand match (Process/GRAIN/Aeonic)
 * 2. Methodological fit
 * 3. Thematic alignment
 * 4. Impact potential
 * 5. Practical feasibility
 * 
 * Uses Claude for semantic understanding and reasoning
 */

export interface AlignmentScore {
  overall: number; // 0-1, weighted combination
  dimensions: {
    researchStrandMatch: number; // 0-1
    methodologicalFit: number; // 0-1
    thematicAlignment: number; // 0-1
    impactPotential: number; // 0-1
    practicalFeasibility: number; // 0-1
  };
  matchedStrands: Array<{
    strand: string;
    relevance: number; // 0-1
    reasoning: string;
  }>;
  strengths: string[]; // What makes this grant a good fit
  concerns: string[]; // Potential issues or mismatches
  recommendation: 'highly_relevant' | 'relevant' | 'somewhat_relevant' | 'not_relevant';
  confidence: number; // 0-1, how confident the analysis is
  reasoning: string; // Overall explanation
  tokensUsed?: number;
}

export interface GrantForScoring {
  programName: string;
  description: string;
  funderName?: string;
  eligibility?: string;
  fundingAmount?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  deadline?: string;
  duration?: string;
  geographies?: string[];
  focusAreas?: string[];
  applicantTypes?: string[];
  sourceUrl: string;
}

@Injectable()
export class OdysseanAlignmentService {
  private readonly logger = new Logger(OdysseanAlignmentService.name);
  private anthropic: Anthropic | null = null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
      const model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20240620';
      this.logger.log(`Anthropic API initialized for alignment scoring with model: ${model}`);
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set - alignment scoring will use fallback heuristics');
    }
  }

  /**
   * Get the configured Claude model name
   */
  private getModel(): string {
    return process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20240620';
  }

  /**
   * Score a grant for alignment with Odyssean Institute agenda
   */
  async scoreGrant(grant: GrantForScoring): Promise<AlignmentScore> {
    if (this.anthropic) {
      try {
        return await this.scoreLLM(grant);
      } catch (error: any) {
        this.logger.error(`LLM scoring failed, falling back to heuristics: ${error.message}`);
        return this.scoreHeuristic(grant);
      }
    } else {
      return this.scoreHeuristic(grant);
    }
  }

  /**
   * Score multiple grants in batch (more efficient)
   */
  async scoreGrants(grants: GrantForScoring[]): Promise<AlignmentScore[]> {
    // For now, score sequentially
    // TODO: Implement batching for efficiency
    const scores: AlignmentScore[] = [];
    
    for (const grant of grants) {
      const score = await this.scoreGrant(grant);
      scores.push(score);
      
      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return scores;
  }

  /**
   * LLM-based scoring using Claude
   */
  private async scoreLLM(grant: GrantForScoring): Promise<AlignmentScore> {
    const response = await this.anthropic!.messages.create({
      model: this.getModel(),
      max_tokens: 2048,
      temperature: 0.3, // Slightly creative for reasoning
      messages: [
        {
          role: 'user',
          content: this.buildScoringPrompt(grant),
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const result = this.parseScoringResponse(content.text);
    
    return {
      ...result,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    };
  }

  /**
   * Build scoring prompt for Claude
   */
  private buildScoringPrompt(grant: GrantForScoring): string {
    const odysseanContext = getOdysseanContextPrompt();
    
    const grantInfo = `
# Grant to Analyze

**Program:** ${grant.programName}
**Funder:** ${grant.funderName || 'Unknown'}
**URL:** ${grant.sourceUrl}

**Description:**
${grant.description}

${grant.eligibility ? `**Eligibility:**\n${grant.eligibility}\n` : ''}
${grant.fundingAmount ? `**Funding:** ${this.formatFundingAmount(grant.fundingAmount)}\n` : ''}
${grant.deadline ? `**Deadline:** ${grant.deadline}\n` : ''}
${grant.duration ? `**Duration:** ${grant.duration}\n` : ''}
${grant.geographies?.length ? `**Geography:** ${grant.geographies.join(', ')}\n` : ''}
${grant.focusAreas?.length ? `**Focus Areas:** ${grant.focusAreas.join(', ')}\n` : ''}
${grant.applicantTypes?.length ? `**Eligible Applicants:** ${grant.applicantTypes.join(', ')}\n` : ''}
`;

    return `${odysseanContext}

${grantInfo}

# Your Task

Analyze this grant opportunity for alignment with the Odyssean Institute's research agenda. Provide a detailed assessment across five dimensions:

1. **Research Strand Match (0-1):** How well does this grant align with one or more of the three research strands (Odyssean Process, GRAIN, Aeonic Flourishing)?

2. **Methodological Fit (0-1):** Does the grant support methodologies the OI uses (futures methods, DMDU, citizen assemblies, participatory research, etc.)?

3. **Thematic Alignment (0-1):** Does it address OI's cross-cutting themes (systemic change, collapse/extinction risk, public engagement, etc.)?

4. **Impact Potential (0-1):** Could this grant lead to real-world impact, policy influence, or institutional change?

5. **Practical Feasibility (0-1):** Are the funding amount, timeline, eligibility, and requirements realistic for OI?

For each research strand, assess relevance (0-1) and explain why.

Identify:
- **Strengths:** What makes this grant a good fit (3-5 points)
- **Concerns:** Potential issues or mismatches (2-4 points)

Provide an overall recommendation:
- "highly_relevant" (overall score > 0.7)
- "relevant" (0.5-0.7)
- "somewhat_relevant" (0.3-0.5)
- "not_relevant" (< 0.3)

Return your analysis as JSON in this exact format:
{
  "dimensions": {
    "researchStrandMatch": 0.0-1.0,
    "methodologicalFit": 0.0-1.0,
    "thematicAlignment": 0.0-1.0,
    "impactPotential": 0.0-1.0,
    "practicalFeasibility": 0.0-1.0
  },
  "matchedStrands": [
    {
      "strand": "Odyssean Process" | "GRAIN" | "Aeonic Flourishing",
      "relevance": 0.0-1.0,
      "reasoning": "string"
    }
  ],
  "strengths": ["string", "string", ...],
  "concerns": ["string", "string", ...],
  "recommendation": "highly_relevant" | "relevant" | "somewhat_relevant" | "not_relevant",
  "confidence": 0.0-1.0,
  "reasoning": "string (2-3 sentences overall assessment)"
}`;
  }

  /**
   * Parse Claude's scoring response
   */
  private parseScoringResponse(text: string): Omit<AlignmentScore, 'tokensUsed'> {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Calculate weighted overall score
      const overall = 
        parsed.dimensions.researchStrandMatch * ALIGNMENT_WEIGHTS.researchStrandMatch +
        parsed.dimensions.methodologicalFit * ALIGNMENT_WEIGHTS.methodologicalFit +
        parsed.dimensions.thematicAlignment * ALIGNMENT_WEIGHTS.thematicAlignment +
        parsed.dimensions.impactPotential * ALIGNMENT_WEIGHTS.impactPotential +
        parsed.dimensions.practicalFeasibility * ALIGNMENT_WEIGHTS.practicalFeasibility;

      return {
        overall,
        dimensions: parsed.dimensions,
        matchedStrands: parsed.matchedStrands || [],
        strengths: parsed.strengths || [],
        concerns: parsed.concerns || [],
        recommendation: parsed.recommendation || 'not_relevant',
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || 'No reasoning provided',
      };
    } catch (error: any) {
      this.logger.error(`Failed to parse scoring response: ${error.message}`);
      this.logger.debug(`Response text: ${text.substring(0, 500)}`);
      
      // Return low-confidence neutral score
      return {
        overall: 0.3,
        dimensions: {
          researchStrandMatch: 0.3,
          methodologicalFit: 0.3,
          thematicAlignment: 0.3,
          impactPotential: 0.3,
          practicalFeasibility: 0.3,
        },
        matchedStrands: [],
        strengths: [],
        concerns: ['Failed to parse LLM response'],
        recommendation: 'not_relevant',
        confidence: 0.1,
        reasoning: 'Analysis failed - using default scores',
      };
    }
  }

  /**
   * Fallback heuristic scoring (keyword matching)
   */
  private scoreHeuristic(grant: GrantForScoring): AlignmentScore {
    const text = `${grant.programName} ${grant.description} ${grant.focusAreas?.join(' ') || ''}`.toLowerCase();
    
    // Score each dimension based on keyword matching
    const dimensions = {
      researchStrandMatch: this.scoreKeywordMatch(text, [
        ...ODYSSEAN_RESEARCH_STRANDS.flatMap(s => s.keywords),
      ]),
      methodologicalFit: this.scoreKeywordMatch(text, METHODOLOGICAL_PREFERENCES),
      thematicAlignment: this.scoreKeywordMatch(text, CROSS_CUTTING_THEMES),
      impactPotential: this.scoreKeywordMatch(text, [
        'impact', 'policy', 'change', 'transformation', 'innovation',
        'implementation', 'practice', 'real world', 'demonstration',
      ]),
      practicalFeasibility: this.scoreFeasibility(grant),
    };

    // Calculate weighted overall
    const overall = 
      dimensions.researchStrandMatch * ALIGNMENT_WEIGHTS.researchStrandMatch +
      dimensions.methodologicalFit * ALIGNMENT_WEIGHTS.methodologicalFit +
      dimensions.thematicAlignment * ALIGNMENT_WEIGHTS.thematicAlignment +
      dimensions.impactPotential * ALIGNMENT_WEIGHTS.impactPotential +
      dimensions.practicalFeasibility * ALIGNMENT_WEIGHTS.practicalFeasibility;

    // Determine recommendation
    let recommendation: AlignmentScore['recommendation'];
    if (overall > 0.7) recommendation = 'highly_relevant';
    else if (overall > 0.5) recommendation = 'relevant';
    else if (overall > 0.3) recommendation = 'somewhat_relevant';
    else recommendation = 'not_relevant';

    return {
      overall,
      dimensions,
      matchedStrands: this.identifyMatchedStrands(text),
      strengths: ['Heuristic scoring - review manually for accuracy'],
      concerns: ['No LLM analysis available'],
      recommendation,
      confidence: 0.4, // Lower confidence for heuristic
      reasoning: 'Scored using keyword matching heuristics (no LLM available)',
    };
  }

  /**
   * Score keyword match (0-1)
   */
  private scoreKeywordMatch(text: string, keywords: string[]): number {
    const matches = keywords.filter(kw => text.includes(kw.toLowerCase()));
    return Math.min(1.0, matches.length / Math.max(5, keywords.length * 0.2));
  }

  /**
   * Score practical feasibility
   */
  private scoreFeasibility(grant: GrantForScoring): number {
    let score = 0.5; // Neutral baseline

    // Check funding amount
    if (grant.fundingAmount) {
      const min = grant.fundingAmount.min || 0;
      const max = grant.fundingAmount.max || Infinity;
      
      if (min >= 10000 && max <= 2000000) {
        score += 0.3; // Good range
      } else if (min < 5000 || max > 5000000) {
        score -= 0.2; // Too small or too large
      }
    }

    // Check geography
    if (grant.geographies?.length) {
      const goodGeos = ['uk', 'united kingdom', 'europe', 'global', 'international'];
      if (grant.geographies.some(g => goodGeos.some(gg => g.toLowerCase().includes(gg)))) {
        score += 0.2;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Identify which research strands match
   */
  private identifyMatchedStrands(text: string): AlignmentScore['matchedStrands'] {
    return ODYSSEAN_RESEARCH_STRANDS.map(strand => {
      const matches = strand.keywords.filter(kw => text.includes(kw.toLowerCase()));
      const relevance = Math.min(1.0, matches.length / Math.max(3, strand.keywords.length * 0.15));
      
      return {
        strand: strand.name,
        relevance,
        reasoning: matches.length > 0 
          ? `Matched keywords: ${matches.slice(0, 5).join(', ')}`
          : 'No keyword matches',
      };
    }).filter(s => s.relevance > 0.1);
  }

  /**
   * Format funding amount for display
   */
  private formatFundingAmount(amount: GrantForScoring['fundingAmount']): string {
    if (!amount) return 'Not specified';
    
    const currency = amount.currency || 'GBP';
    const parts: string[] = [];
    
    if (amount.min && amount.max) {
      parts.push(`${currency} ${amount.min.toLocaleString()} - ${amount.max.toLocaleString()}`);
    } else if (amount.min) {
      parts.push(`${currency} ${amount.min.toLocaleString()}+`);
    } else if (amount.max) {
      parts.push(`Up to ${currency} ${amount.max.toLocaleString()}`);
    }
    
    return parts.join(', ') || 'Not specified';
  }
}
