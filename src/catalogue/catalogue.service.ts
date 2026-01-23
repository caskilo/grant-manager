import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as cheerio from 'cheerio';
import {
  CatalogueDatabase,
  CatalogueEntry,
  FUNDER_TYPES,
  CURRENCIES,
  OPEN_DATA_OPTIONS,
  COMMON_GEOGRAPHIES,
  COMMON_FOCUS_AREAS,
} from './types';
import { CreateCatalogueEntryDto, UpdateCatalogueEntryDto } from './dto/catalogue-entry.dto';

@Injectable()
export class CatalogueService {
  private readonly logger = new Logger(CatalogueService.name);
  private readonly cataloguePath: string;
  private llmExtractor: any = null;
  private scraper: any = null;

  constructor() {
    // Use /tmp on Heroku (ephemeral but writable), local path for development
    const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
    
    if (isProduction) {
      // Heroku: use /tmp directory (ephemeral but writable)
      this.cataloguePath = '/tmp/catalogue.json';
    } else {
      // Local development: use frontend directory
      this.cataloguePath = path.join(
        __dirname,
        '../../../..',
        'frontend',
        'discovery',
        'catalogue.json'
      );
    }
    
    this.logger.log(`Catalogue path: ${this.cataloguePath}`);
    
    // Lazy load harvest services to avoid circular dependencies
    this.initializeHarvestServices();
  }

  private async initializeHarvestServices() {
    try {
      const { LLMGrantExtractorService } = await import('../harvest/llm-grant-extractor.service');
      const { ScraperService } = await import('../harvest/scraper.service');
      this.llmExtractor = new LLMGrantExtractorService();
      this.scraper = new ScraperService();
      this.logger.log('Harvest services initialized for URL scraping');
    } catch (error: any) {
      this.logger.warn(`Failed to initialize harvest services: ${error.message} - URL scraping will use basic extraction only`);
    }
  }

  private async ensureServicesReady(): Promise<void> {
    // If services not initialized yet, wait a moment and try again
    if (!this.llmExtractor && !this.scraper) {
      this.logger.debug('Services not yet initialized, attempting initialization...');
      await this.initializeHarvestServices();
    }
  }

  async getCatalogue(): Promise<CatalogueDatabase> {
    try {
      const content = await fs.readFile(this.cataloguePath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        const emptyDb: CatalogueDatabase = {
          version: '2.0',
          lastModified: new Date().toISOString(),
          funders: [],
        };
        await this.saveCatalogue(emptyDb);
        return emptyDb;
      }
      throw error;
    }
  }

  async getAll(): Promise<CatalogueEntry[]> {
    const catalogue = await this.getCatalogue();
    return catalogue.funders;
  }

  async getById(id: string): Promise<CatalogueEntry> {
    const catalogue = await this.getCatalogue();
    const entry = catalogue.funders.find(f => f.id === id);
    
    if (!entry) {
      throw new NotFoundException(`Catalogue entry with id ${id} not found`);
    }
    
    return entry;
  }

  async create(dto: CreateCatalogueEntryDto): Promise<CatalogueEntry> {
    const catalogue = await this.getCatalogue();
    
    const now = new Date().toISOString();
    const newEntry: CatalogueEntry = {
      id: uuidv4(),
      ...dto,
      createdAt: now,
      updatedAt: now,
    };
    
    catalogue.funders.push(newEntry);
    catalogue.lastModified = now;
    
    await this.saveCatalogue(catalogue);
    
    this.logger.log(`Created catalogue entry: ${newEntry.name} (${newEntry.id})`);
    return newEntry;
  }

  async update(id: string, dto: UpdateCatalogueEntryDto): Promise<CatalogueEntry> {
    const catalogue = await this.getCatalogue();
    const index = catalogue.funders.findIndex(f => f.id === id);
    
    if (index === -1) {
      throw new NotFoundException(`Catalogue entry with id ${id} not found`);
    }
    
    const now = new Date().toISOString();
    catalogue.funders[index] = {
      ...catalogue.funders[index],
      ...dto,
      updatedAt: now,
    };
    
    catalogue.lastModified = now;
    await this.saveCatalogue(catalogue);
    
    this.logger.log(`Updated catalogue entry: ${catalogue.funders[index].name} (${id})`);
    return catalogue.funders[index];
  }

  async delete(id: string): Promise<void> {
    const catalogue = await this.getCatalogue();
    const index = catalogue.funders.findIndex(f => f.id === id);
    
    if (index === -1) {
      throw new NotFoundException(`Catalogue entry with id ${id} not found`);
    }
    
    const deletedEntry = catalogue.funders[index];
    catalogue.funders.splice(index, 1);
    catalogue.lastModified = new Date().toISOString();
    
    await this.saveCatalogue(catalogue);
    
    this.logger.log(`Deleted catalogue entry: ${deletedEntry.name} (${id})`);
  }

  async getEnums() {
    return {
      funderTypes: FUNDER_TYPES,
      currencies: CURRENCIES,
      openDataOptions: OPEN_DATA_OPTIONS,
      commonGeographies: COMMON_GEOGRAPHIES,
      commonFocusAreas: COMMON_FOCUS_AREAS,
    };
  }

  async importFromHtml(html: string): Promise<{ imported: number; skipped: number }> {
    const CatalogueParser = (await import('../discovery/catalogue-parser')).CatalogueParser;
    const parser = new CatalogueParser();
    
    const entries = parser.parse(html);
    const catalogue = await this.getCatalogue();
    
    let imported = 0;
    let skipped = 0;
    
    for (const entry of entries) {
      const exists = catalogue.funders.some(
        f => f.name.toLowerCase() === entry.funder.funderName.toLowerCase()
      );
      
      if (exists) {
        skipped++;
        continue;
      }
      
      const now = new Date().toISOString();
      const newEntry: CatalogueEntry = {
        id: uuidv4(),
        name: entry.funder.funderName,
        type: entry.funder.type || 'Other',
        focus: entry.funder.focus ? entry.funder.focus.split(',').map(f => f.trim()) : [],
        geographies: entry.funder.geography 
          ? entry.funder.geography.split(/[,\/]/).map(g => g.trim()).filter(Boolean)
          : [],
        websiteUrl: entry.funder.website || '',
        typicalAwardMin: entry.opportunities[0]?.minAward,
        typicalAwardMax: entry.opportunities[0]?.maxAward,
        currency: entry.opportunities[0]?.currency || 'GBP',
        openData: entry.funder.notes?.includes('Yes') ? 'Yes' : 
                  entry.funder.notes?.includes('Partial') ? 'Partial' : 'No',
        notes: entry.funder.notes || '',
        createdAt: now,
        updatedAt: now,
      };
      
      catalogue.funders.push(newEntry);
      imported++;
    }
    
    if (imported > 0) {
      catalogue.lastModified = new Date().toISOString();
      await this.saveCatalogue(catalogue);
    }
    
    this.logger.log(`Imported ${imported} entries, skipped ${skipped} duplicates`);
    return { imported, skipped };
  }

  async scrapeUrl(url: string): Promise<Partial<CatalogueEntry>> {
    if (!url || !url.startsWith('http')) {
      throw new BadRequestException('Invalid URL provided');
    }

    this.logger.log(`Scraping funder info from ${url}`);

    try {
      // Ensure services are initialized
      await this.ensureServicesReady();

      // Fetch the page HTML
      this.logger.debug(`Fetching HTML from ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const html = await response.text();
      this.logger.debug(`Fetched ${html.length} bytes from ${url}`);

      // Try LLM extraction if available
      if (this.llmExtractor) {
        try {
          this.logger.debug(`Attempting LLM extraction for ${url}`);
          const result = await this.llmExtractor.extractFromHtml(html, url);
          
          if (result && result.grants && result.grants.length > 0) {
            const grant = result.grants[0];
            this.logger.log(`LLM extracted grant: ${grant.programName}`);
            
            return {
              name: this.extractFunderName(html, url) || grant.programName,
              description: this.extractDescription(html, url) || grant.description,
              type: this.inferFunderType(html, url),
              focus: grant.focusAreas || [],
              geographies: grant.geographies || [],
              websiteUrl: url,
              typicalAwardMin: grant.fundingAmount?.min,
              typicalAwardMax: grant.fundingAmount?.max,
              currency: grant.fundingAmount?.currency || 'GBP',
              openData: 'Unknown',
              notes: grant.description || '',
            };
          }
        } catch (llmError: any) {
          this.logger.warn(`LLM extraction failed: ${llmError.message}, falling back to basic extraction`);
        }
      } else {
        this.logger.debug('LLM extractor not available, using basic extraction');
      }

      // Fallback: Basic extraction from HTML
      this.logger.debug(`Using basic HTML extraction for ${url}`);
      return this.extractBasicInfo(html, url);

    } catch (error: any) {
      this.logger.error(`Failed to scrape ${url}: ${error.message}`);
      throw new BadRequestException(`Failed to extract information from URL: ${error.message}`);
    }
  }

  private extractFunderName(html: string, url: string): string | null {
    const $ = cheerio.load(html);
    
    // Try to find funder name from common locations
    const orgName = $('[itemtype*="Organization"] [itemprop="name"]').first().text().trim();
    if (orgName && orgName.length > 0 && orgName.length < 100) {
      return orgName;
    }
    
    // Try h1 but only if it's short (likely a name, not a description)
    const h1 = $('h1').first().text().trim();
    if (h1 && h1.length > 0 && h1.length < 60) {
      return h1;
    }
    
    // Extract from title - take first part before separator
    const title = $('title').text().trim();
    if (title && title.length > 0) {
      const titleParts = title.split('|')[0].split('-')[0].split(':')[0].trim();
      if (titleParts && titleParts.length > 0 && titleParts.length < 60) {
        return titleParts;
      }
    }
    
    // Extract from URL domain
    try {
      const hostname = new URL(url).hostname.replace('www.', '');
      const domainName = hostname.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      if (domainName && domainName.length > 0) {
        return domainName;
      }
    } catch {
      // Ignore URL parsing errors
    }
    
    return null;
  }

  private extractDescription(html: string, url: string): string {
    const $ = cheerio.load(html);
    
    // Try meta description first
    const metaDesc = $('meta[name="description"]').attr('content');
    if (metaDesc && metaDesc.trim().length > 0) {
      return metaDesc.trim().substring(0, 300);
    }
    
    // Try og:description
    const ogDesc = $('meta[property="og:description"]').attr('content');
    if (ogDesc && ogDesc.trim().length > 0) {
      return ogDesc.trim().substring(0, 300);
    }
    
    // Try first paragraph
    const firstPara = $('p').first().text().trim();
    if (firstPara && firstPara.length > 0) {
      return firstPara.substring(0, 300);
    }
    
    // Try h2 or subtitle
    const h2 = $('h2').first().text().trim();
    if (h2 && h2.length > 0 && h2.length < 200) {
      return h2;
    }
    
    return '';
  }

  private inferFunderType(html: string, url: string): string {
    const $ = cheerio.load(html);
    const text = $.text().toLowerCase();
    
    if (text.includes('research council') || url.includes('.ac.uk') || url.includes('ukri.org')) {
      return 'Research council (UKRI)';
    }
    if (text.includes('foundation') || url.includes('foundation')) return 'Foundation';
    if (text.includes('trust')) return 'Trust';
    if (text.includes('government') || url.includes('.gov')) return 'Public funder';
    if (text.includes('lottery')) return 'Lottery fund';
    if (text.includes('charity') || text.includes('charitable')) return 'Charitable organization';
    
    return 'Other';
  }

  private extractBasicInfo(html: string, url: string): Partial<CatalogueEntry> {
    const $ = cheerio.load(html);
    const text = $.text().toLowerCase();
    
    // Extract focus areas from common keywords
    const focusKeywords = {
      'research': ['research', 'scientific', 'science'],
      'health': ['health', 'medical', 'biomedical', 'clinical'],
      'education': ['education', 'learning', 'training', 'university'],
      'environment': ['environment', 'climate', 'sustainability', 'green'],
      'social justice': ['social justice', 'equality', 'diversity', 'inclusion'],
      'arts': ['arts', 'culture', 'creative', 'music', 'theatre'],
      'technology': ['technology', 'digital', 'innovation', 'tech'],
      'community': ['community', 'local', 'grassroots', 'civic'],
    };
    
    const focus: string[] = [];
    for (const [area, keywords] of Object.entries(focusKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        focus.push(area);
      }
    }
    
    // Extract geographies from common patterns
    const geoKeywords = {
      'UK': ['uk', 'united kingdom', 'britain', 'england', 'scotland', 'wales', 'northern ireland'],
      'US': ['united states', 'usa', 'america', 'us-based'],
      'EU': ['european', 'europe', 'eu '],
      'Global': ['global', 'worldwide', 'international', 'all countries'],
    };
    
    const geographies: string[] = [];
    for (const [geo, keywords] of Object.entries(geoKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        geographies.push(geo);
      }
    }
    
    return {
      name: this.extractFunderName(html, url) || 'Unknown Funder',
      description: this.extractDescription(html, url),
      type: this.inferFunderType(html, url),
      focus: focus.length > 0 ? focus : [],
      geographies: geographies.length > 0 ? geographies : [],
      websiteUrl: url,
      currency: 'GBP',
      openData: 'Unknown',
      notes: 'Auto-extracted from URL. Please review and complete.',
    };
  }

  private async saveCatalogue(catalogue: CatalogueDatabase): Promise<void> {
    await fs.writeFile(
      this.cataloguePath,
      JSON.stringify(catalogue, null, 2),
      'utf-8'
    );
  }
}
