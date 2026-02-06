import * as cheerio from 'cheerio';
import { ParsedCatalogueEntry, ParsedFunder } from './types';

/**
 * CatalogueParser - Parses the Odyssean Funder Catalogue HTML
 * 
 * This parser extracts funder information from the catalogue table.
 * Real opportunities are created via the harvest/inspection pipeline.
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

        entries.push({
          funder,
          opportunities: [], // Real opportunities are created via the harvest/inspection pipeline
        });
      } catch (error) {
        console.warn(`Failed to parse row ${index}:`, error);
      }
    });

    return entries;
  }

}
