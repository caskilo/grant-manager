import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';
import { LLMEligibilityExtractorService, EligibilityExtraction } from './llm-eligibility-extractor.service';

/**
 * LLMGrantExtractorService - Uses Claude to extract grant data from HTML
 * 
 * Advantages over CSS selectors:
 * - Works across diverse website structures
 * - Understands context and semantics
 * - No manual configuration needed
 * - Adapts to layout changes
 * 
 * Strategy:
 * 1. Preprocess HTML (remove scripts, styles, nav)
 * 2. Extract text content with structure
 * 3. Send to Claude with structured output schema
 * 4. Parse and validate response
 */

export interface ExtractedGrant {
  programName: string;
  description: string;
  url?: string; // Direct URL to the specific opportunity page (if different from source URL)
  eligibility?: string; // Simple string for backward compatibility
  eligibilityDetailed?: EligibilityExtraction; // Detailed multi-step extraction
  fundingAmount?: {
    min?: number;
    max?: number;
    currency?: string;
    description?: string;
  };
  deadline?: {
    date?: string;
    description?: string;
    isRolling?: boolean;
  };
  duration?: {
    months?: number;
    description?: string;
  };
  geographies?: string[];
  focusAreas?: string[];
  applicantTypes?: string[];
  applicationProcess?: string;
  contactInfo?: string;
  confidence: number; // 0-1, how confident the LLM is
  reasoning: string; // Why it extracted this data
}

export interface ExtractionResult {
  grants: ExtractedGrant[];
  pageType: 'single_grant' | 'grant_list' | 'general_info' | 'unknown';
  confidence: number;
  tokensUsed: number;
}

@Injectable()
export class LLMGrantExtractorService {
  private readonly logger = new Logger(LLMGrantExtractorService.name);
  private anthropic: Anthropic | null = null;
  private eligibilityExtractor: LLMEligibilityExtractorService;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
      const model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20240620';
      this.logger.log(`Anthropic API initialized with model: ${model}`);
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set - LLM extraction disabled');
    }
    
    // Initialize eligibility extractor
    this.eligibilityExtractor = new LLMEligibilityExtractorService();
  }

  /**
   * Get the configured Claude model name
   */
  private getModel(): string {
    return process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20240620';
  }

  /**
   * Extract grant data from HTML using Claude
   */
  async extractFromHtml(html: string, url: string): Promise<ExtractionResult | null> {
    if (!this.anthropic) {
      this.logger.warn('LLM extraction skipped - no API key');
      return null;
    }

    try {
      // Preprocess HTML to reduce tokens
      const processedContent = this.preprocessHtml(html);
      
      if (processedContent.length < 100) {
        this.logger.warn('Processed content too short, skipping LLM extraction');
        return null;
      }

      // Truncate if too long (Claude has 200k context but we want to be efficient)
      const maxLength = 50000; // ~12k tokens
      const truncated = processedContent.length > maxLength 
        ? processedContent.substring(0, maxLength) + '\n\n[Content truncated...]'
        : processedContent;

      this.logger.log(`Extracting grants from ${url} (${truncated.length} chars)`);

      const response = await this.anthropic.messages.create({
        model: this.getModel(),
        max_tokens: 4096,
        temperature: 0, // Deterministic for extraction
        messages: [
          {
            role: 'user',
            content: this.buildExtractionPrompt(truncated, url),
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      // Parse JSON response
      const result = this.parseExtractionResponse(content.text);
      
      let totalTokens = response.usage.input_tokens + response.usage.output_tokens;
      
      this.logger.log(`Extracted ${result.grants.length} grants (confidence: ${result.confidence.toFixed(2)})`);
      
      // Perform detailed eligibility extraction for each grant
      for (const grant of result.grants) {
        this.logger.log(`Performing multi-step eligibility extraction for: ${grant.programName}`);
        
        const eligibilityResult = await this.eligibilityExtractor.extractEligibility(
          truncated,
          grant.programName,
          url,
        );
        
        if (eligibilityResult) {
          grant.eligibilityDetailed = eligibilityResult.eligibility;
          totalTokens += eligibilityResult.tokensUsed;
          
          // Also update simple eligibility string for backward compatibility
          grant.eligibility = this.eligibilityExtractor.formatEligibilityForDisplay(
            eligibilityResult.eligibility,
          );
          
          this.logger.log(
            `Eligibility extracted (confidence: ${(eligibilityResult.eligibility.confidence * 100).toFixed(0)}%, ` +
            `completeness: ${(eligibilityResult.eligibility.completeness * 100).toFixed(0)}%, ` +
            `method: ${eligibilityResult.eligibility.extractionMethod})`,
          );
        }
      }
      
      return {
        ...result,
        tokensUsed: totalTokens,
      };

    } catch (error: any) {
      this.logger.error(`LLM extraction failed for ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Preprocess HTML to reduce tokens while preserving structure
   */
  private preprocessHtml(html: string): string {
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, noscript, iframe, svg, img').remove();
    $('nav, header, footer, .nav, .navigation, .menu, .sidebar').remove();
    $('.cookie, .gdpr, .banner, .advertisement, .ad').remove();

    // Extract main content area if identifiable
    const mainSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '.content',
      '#content',
      'article',
    ];

    let mainContent = null;
    for (const selector of mainSelectors) {
      const found = $(selector).first();
      if (found.length > 0 && found.text().trim().length > 500) {
        mainContent = found;
        break;
      }
    }

    const root = mainContent || $('body');

    // Convert to markdown-like text with structure
    // First, convert <a> tags to markdown links inline so URLs are preserved
    root.find('a[href]').each((_, el) => {
      const $a = $(el);
      const href = $a.attr('href');
      const text = $a.text().trim();
      if (href && text && text.length > 2) {
        // Resolve relative URLs
        const absoluteUrl = href.startsWith('http') ? href : (href.startsWith('/') ? href : '');
        if (absoluteUrl) {
          $a.replaceWith(`[${text}](${absoluteUrl})`);
        }
      }
    });

    const lines: string[] = [];
    
    root.find('h1, h2, h3, h4, h5, h6, p, li, dt, dd, th, td').each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim().replace(/\s+/g, ' ');
      
      if (text.length < 5) return; // Skip very short text
      
      const tag = el.tagName.toLowerCase();
      
      if (tag.startsWith('h')) {
        const level = parseInt(tag[1]);
        lines.push('\n' + '#'.repeat(level) + ' ' + text);
      } else if (tag === 'li') {
        lines.push('- ' + text);
      } else if (tag === 'dt') {
        lines.push('\n**' + text + '**');
      } else if (tag === 'dd') {
        lines.push('  ' + text);
      } else {
        lines.push(text);
      }
    });

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /**
   * Build extraction prompt for Claude with anti-hallucination measures
   */
  private buildExtractionPrompt(content: string, url: string): string {
    return `You are analyzing a webpage to extract grant/funding opportunity information.

URL: ${url}

**CRITICAL ANTI-HALLUCINATION RULES:**
1. ONLY extract information that is EXPLICITLY VISIBLE in the page content
2. If you cannot find a piece of information, set it to null - DO NOT GUESS
3. DO NOT use your general knowledge about grants or funders
4. DO NOT infer information from context unless it is clearly stated
5. If a number/date/name is not visible in the content, DO NOT include it
6. When uncertain, err on the side of omission rather than invention

**Your task:**
1. Determine the page type (single grant detail, list of grants, general info, or unknown)
2. Extract ONLY explicitly stated information about grants/funding opportunities
3. Provide confidence scores based on clarity and completeness of information
4. Explain your reasoning to demonstrate you found the information in the content

**For each grant found, extract ONLY if explicitly stated:**
- **Program name** (required) - The exact name as it appears
- **Description** (required) - Summary of what the grant is for
- **URL** - If the page contains a link to a dedicated page for this specific grant/opportunity (e.g. an "Apply" or "Learn more" link), extract that URL. If the current page IS the grant page, use the current URL. Set to null if no specific link is found.
- **Funding amount** - Specific numbers with currency (e.g., "£100,000 to £500,000")
- **Deadline** - Exact date or "rolling" if stated
- **Duration** - Number of months/years if specified
- **Geographic restrictions** - Where applicants must be based
- **Focus areas/themes** - Research areas or topics mentioned
- **Eligible applicant types** - Who can apply (universities, SMEs, etc.)
- **Application process** - How to apply
- **Contact information** - Email, phone, or contact details

**NOTE:** Eligibility will be extracted separately in a detailed second pass, so a brief mention here is sufficient.

**Confidence scoring:**
- 1.0 = All information clearly stated with specific details
- 0.8 = Most information present, some minor gaps
- 0.6 = Basic information present, significant gaps
- 0.4 = Minimal information, mostly unclear
- 0.2 = Very uncertain, may not be a real grant

**Return ONLY valid JSON in this exact format (no markdown, no extra text):**
{
  "pageType": "single_grant",
  "confidence": 0.8,
  "grants": [
    {
      "programName": "Exact Program Name From Page",
      "description": "Description as it appears on page",
      "url": "https://example.com/grants/specific-grant" or null,
      "fundingAmount": {
        "min": 100000,
        "max": 500000,
        "currency": "GBP",
        "description": "£100k to £500k"
      },
      "deadline": {
        "date": "2026-03-17",
        "description": "17 March 2026",
        "isRolling": false
      },
      "duration": {
        "months": 36,
        "description": "Up to 3 years"
      },
      "geographies": ["UK"],
      "focusAreas": ["AI", "Health"],
      "applicantTypes": ["University", "Research Institute"],
      "applicationProcess": "Brief process description if stated",
      "contactInfo": "Contact details if provided",
      "confidence": 0.8,
      "reasoning": "Found clear program name, detailed funding info, specific deadline. Missing some eligibility details."
    }
  ]
}

**REMINDER:** Return ONLY the JSON object. No markdown code blocks, no explanations before or after.

**Page content:**
${content}`;
  }

  /**
   * Parse Claude's JSON response
   */
  private parseExtractionResponse(text: string): Omit<ExtractionResult, 'tokensUsed'> {
    try {
      // Extract JSON from response (Claude sometimes adds explanation before/after)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!parsed.pageType || !Array.isArray(parsed.grants)) {
        throw new Error('Invalid response structure');
      }

      return {
        pageType: parsed.pageType,
        confidence: parsed.confidence || 0.5,
        grants: parsed.grants.map((g: any) => ({
          programName: g.programName || 'Unknown Program',
          description: g.description || '',
          url: g.url || undefined,
          eligibility: g.eligibility,
          fundingAmount: g.fundingAmount,
          deadline: g.deadline,
          duration: g.duration,
          geographies: g.geographies,
          focusAreas: g.focusAreas,
          applicantTypes: g.applicantTypes,
          applicationProcess: g.applicationProcess,
          contactInfo: g.contactInfo,
          confidence: g.confidence || 0.5,
          reasoning: g.reasoning || 'No reasoning provided',
        })),
      };
    } catch (error: any) {
      this.logger.error(`Failed to parse LLM response: ${error.message}`);
      this.logger.debug(`Response text: ${text.substring(0, 500)}`);
      
      // Return empty result rather than failing
      return {
        pageType: 'unknown',
        confidence: 0,
        grants: [],
      };
    }
  }

  /**
   * Convert extracted grant to ScrapedOpportunity format
   */
  convertToScrapedOpportunity(grant: ExtractedGrant, sourceUrl: string): any {
    return {
      programName: grant.programName,
      description: grant.description,
      url: grant.url,
      sourceUrl,
      geographies: grant.geographies,
      deadline: grant.deadline?.date || grant.deadline?.description,
      minAward: grant.fundingAmount?.min,
      maxAward: grant.fundingAmount?.max,
      currency: grant.fundingAmount?.currency,
      durationMonths: grant.duration?.months,
      eligibility: grant.eligibility,
      focusAreas: grant.focusAreas,
      applicantTypes: grant.applicantTypes,
      rawData: {
        llmExtracted: true,
        confidence: grant.confidence,
        reasoning: grant.reasoning,
        fundingAmountDescription: grant.fundingAmount?.description,
        deadlineDescription: grant.deadline?.description,
        isRollingDeadline: grant.deadline?.isRolling,
        durationDescription: grant.duration?.description,
        applicationProcess: grant.applicationProcess,
        contactInfo: grant.contactInfo,
      },
    };
  }
}
