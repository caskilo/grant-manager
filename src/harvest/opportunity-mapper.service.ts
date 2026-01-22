import { Injectable, Logger } from '@nestjs/common';
import { ScrapedOpportunity } from './scraper.service';
import { NormalizedOpportunity } from './types';

/**
 * OpportunityMapperService - Normalizes scraped opportunities into DB-ready format
 * 
 * Responsibilities:
 * - Convert ScrapedOpportunity to NormalizedOpportunity
 * - Apply field-level transforms and validation
 * - Extract structured data from free text where possible
 */
@Injectable()
export class OpportunityMapperService {
  private readonly logger = new Logger(OpportunityMapperService.name);

  /**
   * Normalize a scraped opportunity for DB integration
   */
  normalize(
    scraped: ScrapedOpportunity,
    funderId: string,
    runId: string,
  ): NormalizedOpportunity {
    const now = new Date().toISOString();

    // Generate external ID from source URL if not provided
    const externalId = this.generateExternalId(scraped.sourceUrl, scraped.programName);

    // Normalize geographies
    const geographies = this.normalizeGeographies(scraped.geographies || []);

    // Parse award amounts if present
    const { minAward, maxAward, currency } = this.parseAwardInfo(scraped);

    // Determine status (default to OPEN)
    const status = this.determineStatus(scraped.deadline);

    // Create tags
    const tags = ['HARVEST', `RUN_${runId}`];

    // Create concise description from scraped description (first 200 chars)
    const description = scraped.description
      ? scraped.description.trim().substring(0, 200)
      : undefined;

    // Convert single deadline to deadlines array format
    const deadlines = scraped.deadline
      ? [{ date: this.normalizeDate(scraped.deadline) || scraped.deadline, type: 'application' }]
      : undefined;

    const normalized: NormalizedOpportunity = {
      externalId,
      programName: scraped.programName.trim(),
      sourceUrl: scraped.sourceUrl,
      description, // Concise summary for UI display
      rawDescription: scraped.description?.trim(), // Full unedited text for reference
      geographies,
      deadlines, // Array of deadline objects
      minAward,
      maxAward,
      currency: currency || 'GBP',
      status,
      tags,
      scrapedAt: now,
    };

    return normalized;
  }

  /**
   * Normalize multiple opportunities
   */
  normalizeMany(
    scraped: ScrapedOpportunity[],
    funderId: string,
    runId: string,
  ): NormalizedOpportunity[] {
    return scraped.map((opp) => this.normalize(opp, funderId, runId));
  }

  /**
   * Generate a consistent external ID from URL and program name
   */
  private generateExternalId(sourceUrl: string, programName: string): string {
    try {
      const url = new URL(sourceUrl);
      const pathSlug = url.pathname
        .split('/')
        .filter(Boolean)
        .join('-')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '');

      const nameSlug = programName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .substring(0, 50);

      return `${pathSlug}-${nameSlug}`;
    } catch {
      // Fallback to just the program name slug
      return programName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .substring(0, 100);
    }
  }

  /**
   * Normalize geography strings (standardize common variations)
   */
  private normalizeGeographies(geographies: string[]): string[] {
    const normalized = new Set<string>();

    const normalizationMap: Record<string, string> = {
      'uk': 'UK',
      'united kingdom': 'UK',
      'england': 'England',
      'scotland': 'Scotland',
      'wales': 'Wales',
      'northern ireland': 'Northern Ireland',
      'europe': 'Europe',
      'eu': 'Europe',
      'global': 'Global',
      'worldwide': 'Global',
      'international': 'Global',
    };

    for (const geo of geographies) {
      const lower = geo.trim().toLowerCase();
      const standardized = normalizationMap[lower] || geo.trim();
      if (standardized) {
        normalized.add(standardized);
      }
    }

    return Array.from(normalized);
  }

  /**
   * Parse award information from scraped data
   */
  private parseAwardInfo(scraped: ScrapedOpportunity): {
    minAward?: number;
    maxAward?: number;
    currency?: string;
  } {
    // If awards are already parsed, use them
    if (scraped.minAward !== undefined || scraped.maxAward !== undefined) {
      return {
        minAward: scraped.minAward,
        maxAward: scraped.maxAward,
        currency: this.detectCurrency(scraped.rawData),
      };
    }

    // Otherwise, try to extract from description or raw data
    // This is basic; can be enhanced with more sophisticated parsing
    return {
      minAward: undefined,
      maxAward: undefined,
      currency: undefined,
    };
  }

  /**
   * Detect currency from text
   */
  private detectCurrency(text: any): string | undefined {
    if (!text) return undefined;

    const textStr = JSON.stringify(text).toLowerCase();

    if (textStr.includes('£') || textStr.includes('gbp')) return 'GBP';
    if (textStr.includes('$') || textStr.includes('usd')) return 'USD';
    if (textStr.includes('€') || textStr.includes('eur')) return 'EUR';

    return undefined;
  }

  /**
   * Normalize date string to ISO format
   */
  private normalizeDate(dateStr?: string): string | undefined {
    if (!dateStr) return undefined;

    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch {
      // Invalid date
    }

    return dateStr; // Return as-is if can't parse
  }

  /**
   * Determine opportunity status based on deadline
   */
  private determineStatus(deadline?: string): 'OPEN' | 'CLOSED' | 'UNKNOWN' {
    if (!deadline) return 'OPEN';

    try {
      const deadlineDate = new Date(deadline);
      const now = new Date();

      if (isNaN(deadlineDate.getTime())) {
        return 'UNKNOWN';
      }

      if (deadlineDate < now) {
        return 'CLOSED';
      }

      // If deadline is more than 6 months away, mark as UNKNOWN (future opportunity)
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

      if (deadlineDate > sixMonthsFromNow) {
        return 'UNKNOWN';
      }

      return 'OPEN';
    } catch {
      return 'UNKNOWN'; // If we can't parse the deadline, mark as UNKNOWN
    }
  }
}
