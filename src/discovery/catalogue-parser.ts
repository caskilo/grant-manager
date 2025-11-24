import * as cheerio from 'cheerio';
import { ParsedCatalogueEntry, ParsedFunder, ParsedOpportunity } from './types';

/**
 * CatalogueParser - Parses the Odyssean Funder Catalogue HTML
 * 
 * This parser extracts funder information from the catalogue table.
 * Since the catalogue doesn't contain specific opportunities yet,
 * it creates placeholder opportunity entries for each funder.
 */
export class CatalogueParser {
  /**
   * Parse HTML catalogue and extract funder/opportunity data
   */
  parse(html: string): ParsedCatalogueEntry[] {
    const $ = cheerio.load(html);
    const entries: ParsedCatalogueEntry[] = [];

    // Find all table rows (skip header)
    $('table tbody tr').each((index, row) => {
      try {
        const cells = $(row).find('td');
        
        if (cells.length < 8) {
          return; // Skip malformed rows
        }

        const funderName = $(cells[1]).text().trim();
        const type = $(cells[2]).text().trim();
        const focus = $(cells[3]).text().trim();
        const geography = $(cells[4]).text().trim();
        const awardRange = $(cells[5]).text().trim();
        const openData = $(cells[6]).text().trim();
        const url = $(cells[7]).find('a').attr('href') || '';

        // Parse funder
        const funder: ParsedFunder = {
          funderName,
          website: url,
          type,
          focus,
          geography,
          notes: `Open data: ${openData}`,
        };

        // Parse award range to extract min/max
        const { minAward, maxAward, currency } = this.parseAwardRange(awardRange);

        // Parse geographies from the geography field
        const geographies = this.parseGeographies(geography);

        // Parse focus areas into tags
        const declaredFocus = this.parseFocusAreas(focus);

        // Infer eligible applicant types from funder type and focus
        const eligibleApplicantTypes = this.inferApplicantTypes(type, focus);

        // Create a placeholder opportunity for this funder
        // In a real scenario, we'd scrape the funder's website for actual opportunities
        const opportunity: ParsedOpportunity = {
          externalId: `${this.slugify(funderName)}-general`,
          programName: `${funderName} - General Funding`,
          sourceUrl: url,
          declaredFocus,
          geographies,
          eligibleApplicantTypes,
          minAward,
          maxAward,
          currency,
          rawDescription: `${funderName} is a ${type} focused on ${focus}. Geography: ${geography}. Typical award range: ${awardRange}.`,
          status: 'OPEN',
        };

        entries.push({
          funder,
          opportunities: [opportunity],
        });
      } catch (error) {
        console.warn(`Failed to parse row ${index}:`, error);
      }
    });

    return entries;
  }

  /**
   * Parse award range string like "£10k - £100m" or "$50k - $m"
   */
  private parseAwardRange(range: string): { minAward?: number; maxAward?: number; currency?: string } {
    // Detect currency
    let currency = 'GBP';
    if (range.includes('$')) currency = 'USD';
    if (range.includes('€')) currency = 'EUR';

    // Extract numbers
    const parts = range.split('-').map(p => p.trim());
    
    const minAward = this.parseAmount(parts[0]);
    const maxAward = parts.length > 1 ? this.parseAmount(parts[1]) : undefined;

    return { minAward, maxAward, currency };
  }

  /**
   * Parse amount string like "£10k", "$1m", "€100k"
   */
  private parseAmount(str: string): number | undefined {
    if (!str) return undefined;

    // Remove currency symbols and whitespace
    const cleaned = str.replace(/[£$€,\s]/g, '');
    
    // Handle k/m multipliers
    let multiplier = 1;
    if (cleaned.toLowerCase().includes('m')) {
      multiplier = 1000000;
    } else if (cleaned.toLowerCase().includes('k')) {
      multiplier = 1000;
    }

    // Extract numeric part
    const numericPart = cleaned.replace(/[km]/gi, '');
    const num = parseFloat(numericPart);

    return isNaN(num) ? undefined : num * multiplier;
  }

  /**
   * Parse geography string into array of regions
   */
  private parseGeographies(geography: string): string[] {
    if (!geography) return [];

    // Split by common delimiters and clean
    return geography
      .split(/[,\/]/)
      .map(g => g.trim())
      .map(g => g.replace(/\(.*?\)/g, '').trim()) // Remove parenthetical notes
      .filter(g => g.length > 0);
  }

  /**
   * Parse focus areas into tags
   */
  private parseFocusAreas(focus: string): string[] {
    if (!focus) return [];

    return focus
      .split(',')
      .map(f => f.trim())
      .filter(f => f.length > 0);
  }

  /**
   * Infer eligible applicant types from funder type and focus
   */
  private inferApplicantTypes(type: string, focus: string): string[] {
    const types: string[] = [];
    const combined = `${type} ${focus}`.toLowerCase();

    // Research-focused funders
    if (combined.includes('research') || combined.includes('science')) {
      types.push('UNIVERSITY', 'RESEARCH_INSTITUTE');
    }

    // Charitable/social funders
    if (combined.includes('charity') || combined.includes('foundation') || 
        combined.includes('social') || combined.includes('community')) {
      types.push('CHARITY', 'NONPROFIT');
    }

    // Innovation/tech funders
    if (combined.includes('innovation') || combined.includes('tech')) {
      types.push('STARTUP', 'SMALL_BUSINESS');
    }

    // If no specific types inferred, allow broad categories
    if (types.length === 0) {
      types.push('CHARITY', 'UNIVERSITY', 'RESEARCH_INSTITUTE');
    }

    return types;
  }

  /**
   * Create URL-safe slug from funder name
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
