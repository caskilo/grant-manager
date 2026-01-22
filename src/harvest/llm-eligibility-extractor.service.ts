import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

/**
 * LLMEligibilityExtractorService - Multi-step eligibility extraction with layered reasoning
 * 
 * This service implements a sophisticated approach to eligibility extraction:
 * 1. Initial extraction pass - tries to find explicit eligibility criteria
 * 2. Uncertainty detection - identifies when information is missing or unclear
 * 3. Reasoning pass - attempts to infer or locate missing information
 * 4. Confidence scoring - provides granular confidence for each finding
 * 
 * Philosophy:
 * - Embrace "I don't know" as a valid response
 * - Use second-order reasoning when first-order extraction fails
 * - Maintain rigour while allowing intelligent flexibility
 * - Acknowledge unknowns rather than hallucinating
 */

export interface EligibilityExtraction {
  // Core eligibility fields
  organizationTypes?: string[];
  geographicRestrictions?: string[];
  careerStage?: string[];
  disciplineRestrictions?: string[];
  fundingHistory?: string;
  collaborationRequirements?: string;
  otherCriteria?: string[];
  
  // Meta-information
  confidence: number; // 0-1
  completeness: number; // 0-1, how complete is the information
  uncertainties: string[]; // What is unclear or missing
  reasoning: string; // Why this was extracted
  extractionMethod: 'explicit' | 'inferred' | 'unknown';
}

export interface EligibilityResult {
  eligibility: EligibilityExtraction;
  requiresSecondPass: boolean;
  tokensUsed: number;
}

@Injectable()
export class LLMEligibilityExtractorService {
  private readonly logger = new Logger(LLMEligibilityExtractorService.name);
  private anthropic: Anthropic | null = null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
      this.logger.log('Eligibility extractor initialized');
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set - eligibility extraction disabled');
    }
  }

  private getModel(): string {
    return process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20240620';
  }

  /**
   * Extract eligibility with multi-step reasoning
   */
  async extractEligibility(
    content: string,
    programName: string,
    url: string,
  ): Promise<EligibilityResult | null> {
    if (!this.anthropic) {
      this.logger.warn('Eligibility extraction skipped - no API key');
      return null;
    }

    try {
      // Step 1: Initial extraction pass
      this.logger.log(`[Step 1/2] Initial eligibility extraction for: ${programName}`);
      const firstPass = await this.firstPassExtraction(content, programName, url);

      // Check if second pass is needed
      if (firstPass.requiresSecondPass && firstPass.eligibility.uncertainties.length > 0) {
        this.logger.log(`[Step 2/2] Reasoning pass for ${firstPass.eligibility.uncertainties.length} uncertainties`);
        const secondPass = await this.reasoningPassExtraction(
          content,
          programName,
          url,
          firstPass.eligibility,
        );

        return {
          eligibility: secondPass.eligibility,
          requiresSecondPass: false,
          tokensUsed: firstPass.tokensUsed + secondPass.tokensUsed,
        };
      }

      return firstPass;
    } catch (error: any) {
      this.logger.error(`Eligibility extraction failed: ${error.message}`);
      return null;
    }
  }

  /**
   * First pass: Extract explicit eligibility criteria
   */
  private async firstPassExtraction(
    content: string,
    programName: string,
    url: string,
  ): Promise<EligibilityResult> {
    const prompt = this.buildFirstPassPrompt(content, programName, url);

    const response = await this.anthropic!.messages.create({
      model: this.getModel(),
      max_tokens: 2048,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const result = this.parseEligibilityResponse(text);

    return {
      eligibility: result,
      requiresSecondPass: result.uncertainties.length > 0 && result.completeness < 0.7,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    };
  }

  /**
   * Second pass: Reasoning to find missing information
   */
  private async reasoningPassExtraction(
    content: string,
    programName: string,
    url: string,
    firstPassResult: EligibilityExtraction,
  ): Promise<EligibilityResult> {
    const prompt = this.buildReasoningPassPrompt(
      content,
      programName,
      url,
      firstPassResult,
    );

    const response = await this.anthropic!.messages.create({
      model: this.getModel(),
      max_tokens: 2048,
      temperature: 0.3, // Slightly higher for reasoning
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const result = this.parseEligibilityResponse(text);

    // Merge with first pass results
    const merged = this.mergeEligibilityResults(firstPassResult, result);

    return {
      eligibility: merged,
      requiresSecondPass: false,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    };
  }

  /**
   * Build first pass prompt - focus on explicit criteria
   */
  private buildFirstPassPrompt(content: string, programName: string, url: string): string {
    return `You are analyzing eligibility criteria for a grant/funding opportunity.

**Program:** ${programName}
**URL:** ${url}

**Your task:**
Extract ONLY explicitly stated eligibility criteria. Be rigorous and honest about what you can and cannot determine.

**Extract the following if explicitly stated:**
1. **Organization types** - Who can apply (universities, charities, SMEs, individuals, etc.)
2. **Geographic restrictions** - Where applicants must be based
3. **Career stage** - Early career, established, any level, etc.
4. **Discipline restrictions** - Required or excluded research areas
5. **Funding history** - Requirements about previous grants
6. **Collaboration requirements** - Must be collaborative, solo, either, etc.
7. **Other criteria** - Any other eligibility requirements

**CRITICAL RULES:**
- If a criterion is NOT explicitly mentioned, mark it as uncertain
- Do NOT infer or guess - only extract what is clearly stated
- It is BETTER to say "I don't know" than to hallucinate
- List specific uncertainties you have
- Provide confidence (0-1) based on clarity of information
- Provide completeness (0-1) based on how much information is available

**Return ONLY valid JSON in this format:**
{
  "organizationTypes": ["university", "research_institute"] or null,
  "geographicRestrictions": ["UK only"] or null,
  "careerStage": ["any"] or null,
  "disciplineRestrictions": ["STEM fields"] or null,
  "fundingHistory": "No previous EPSRC funding required" or null,
  "collaborationRequirements": "Must be collaborative" or null,
  "otherCriteria": ["Other requirement"] or null,
  "confidence": 0.8,
  "completeness": 0.6,
  "uncertainties": ["Career stage not mentioned", "Collaboration requirements unclear"],
  "reasoning": "Brief explanation of what was found and what is missing",
  "extractionMethod": "explicit"
}

**Page content:**
${content}`;
  }

  /**
   * Build reasoning pass prompt - attempt to infer missing information
   */
  private buildReasoningPassPrompt(
    content: string,
    programName: string,
    url: string,
    firstPass: EligibilityExtraction,
  ): string {
    return `You are performing a second-pass analysis to resolve eligibility uncertainties.

**Program:** ${programName}
**URL:** ${url}

**First pass identified these uncertainties:**
${firstPass.uncertainties.map((u, i) => `${i + 1}. ${u}`).join('\n')}

**First pass findings:**
${JSON.stringify(firstPass, null, 2)}

**Your task:**
Use reasoning and contextual understanding to address the uncertainties. You may:
1. Look for implicit information that suggests eligibility criteria
2. Infer from program type, funder type, or context
3. Use domain knowledge about typical grant structures
4. Still mark as "unknown" if you genuinely cannot determine

**IMPORTANT:**
- Be transparent about when you're inferring vs. finding explicit info
- Mark extraction method as "inferred" for reasoned conclusions
- Maintain high standards - don't force answers that aren't there
- Update confidence and completeness scores appropriately
- Reduce uncertainties list only for items you've resolved

**Return ONLY valid JSON in the same format as first pass:**
{
  "organizationTypes": [...] or null,
  "geographicRestrictions": [...] or null,
  "careerStage": [...] or null,
  "disciplineRestrictions": [...] or null,
  "fundingHistory": "..." or null,
  "collaborationRequirements": "..." or null,
  "otherCriteria": [...] or null,
  "confidence": 0.7,
  "completeness": 0.8,
  "uncertainties": ["Remaining uncertainties"],
  "reasoning": "Explain what you inferred and why",
  "extractionMethod": "inferred"
}

**Page content:**
${content}`;
  }

  /**
   * Parse eligibility JSON response
   */
  private parseEligibilityResponse(text: string): EligibilityExtraction {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        organizationTypes: parsed.organizationTypes || null,
        geographicRestrictions: parsed.geographicRestrictions || null,
        careerStage: parsed.careerStage || null,
        disciplineRestrictions: parsed.disciplineRestrictions || null,
        fundingHistory: parsed.fundingHistory || null,
        collaborationRequirements: parsed.collaborationRequirements || null,
        otherCriteria: parsed.otherCriteria || null,
        confidence: parsed.confidence || 0.5,
        completeness: parsed.completeness || 0.5,
        uncertainties: parsed.uncertainties || [],
        reasoning: parsed.reasoning || 'No reasoning provided',
        extractionMethod: parsed.extractionMethod || 'unknown',
      };
    } catch (error: any) {
      this.logger.error(`Failed to parse eligibility response: ${error.message}`);
      
      // Return minimal result
      return {
        confidence: 0,
        completeness: 0,
        uncertainties: ['Failed to parse LLM response'],
        reasoning: 'Parsing error',
        extractionMethod: 'unknown',
      };
    }
  }

  /**
   * Merge first and second pass results intelligently
   */
  private mergeEligibilityResults(
    first: EligibilityExtraction,
    second: EligibilityExtraction,
  ): EligibilityExtraction {
    return {
      // Prefer second pass for fields that were uncertain in first pass
      organizationTypes: second.organizationTypes || first.organizationTypes,
      geographicRestrictions: second.geographicRestrictions || first.geographicRestrictions,
      careerStage: second.careerStage || first.careerStage,
      disciplineRestrictions: second.disciplineRestrictions || first.disciplineRestrictions,
      fundingHistory: second.fundingHistory || first.fundingHistory,
      collaborationRequirements: second.collaborationRequirements || first.collaborationRequirements,
      otherCriteria: second.otherCriteria || first.otherCriteria,
      
      // Take higher confidence if second pass improved things
      confidence: Math.max(first.confidence, second.confidence),
      completeness: Math.max(first.completeness, second.completeness),
      
      // Keep only unresolved uncertainties
      uncertainties: second.uncertainties,
      
      // Combine reasoning
      reasoning: `First pass: ${first.reasoning}\n\nSecond pass: ${second.reasoning}`,
      
      // Mark as inferred if second pass was used
      extractionMethod: second.extractionMethod === 'inferred' ? 'inferred' : first.extractionMethod,
    };
  }

  /**
   * Format eligibility for display/storage
   */
  formatEligibilityForDisplay(eligibility: EligibilityExtraction): string {
    const parts: string[] = [];

    if (eligibility.organizationTypes && eligibility.organizationTypes.length > 0) {
      parts.push(`**Eligible organizations:** ${eligibility.organizationTypes.join(', ')}`);
    }

    if (eligibility.geographicRestrictions && eligibility.geographicRestrictions.length > 0) {
      parts.push(`**Geographic restrictions:** ${eligibility.geographicRestrictions.join(', ')}`);
    }

    if (eligibility.careerStage && eligibility.careerStage.length > 0) {
      parts.push(`**Career stage:** ${eligibility.careerStage.join(', ')}`);
    }

    if (eligibility.disciplineRestrictions && eligibility.disciplineRestrictions.length > 0) {
      parts.push(`**Discipline restrictions:** ${eligibility.disciplineRestrictions.join(', ')}`);
    }

    if (eligibility.fundingHistory) {
      parts.push(`**Funding history:** ${eligibility.fundingHistory}`);
    }

    if (eligibility.collaborationRequirements) {
      parts.push(`**Collaboration:** ${eligibility.collaborationRequirements}`);
    }

    if (eligibility.otherCriteria && eligibility.otherCriteria.length > 0) {
      parts.push(`**Other criteria:** ${eligibility.otherCriteria.join('; ')}`);
    }

    if (eligibility.uncertainties.length > 0) {
      parts.push(`\n**Note:** Some information could not be determined: ${eligibility.uncertainties.join(', ')}`);
    }

    parts.push(`\n*Confidence: ${(eligibility.confidence * 100).toFixed(0)}% | Completeness: ${(eligibility.completeness * 100).toFixed(0)}% | Method: ${eligibility.extractionMethod}*`);

    return parts.join('\n\n');
  }
}
