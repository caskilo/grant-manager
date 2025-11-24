import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

/**
 * ScraperService - Protocol-based web scraping for grant opportunities
 * 
 * Execution model:
 * 1. Load page (static or dynamic)
 * 2. Extract data using configured selectors
 * 3. Follow pagination if configured
 * 4. Return structured opportunity data
 */

export interface ScraperConfig {
  // Scraping mode
  mode: 'static' | 'dynamic'; // static = cheerio, dynamic = puppeteer
  
  // Page selectors
  selectors: {
    // Container for opportunity items (list view)
    itemContainer?: string;
    
    // Individual opportunity fields
    programName: string;
    funderName?: string;
    description?: string;
    url?: string;
    geographies?: string;
    deadline?: string;
    awardAmount?: string;
    
    // Detail page link (if needed)
    detailLink?: string;
  };
  
  // Pagination
  pagination?: {
    enabled: boolean;
    nextButtonSelector?: string;
    maxPages?: number;
    urlPattern?: string; // e.g., "https://example.com/grants?page={page}"
  };
  
  // Wait conditions for dynamic pages
  waitFor?: {
    selector?: string;
    timeout?: number;
  };
  
  // Data transformation rules
  transforms?: {
    [field: string]: {
      type: 'trim' | 'split' | 'replace' | 'extract';
      params?: any;
    };
  };
}

export interface ScrapedOpportunity {
  programName: string;
  funderName?: string;
  description?: string;
  sourceUrl: string;
  geographies?: string[];
  deadline?: string;
  minAward?: number;
  maxAward?: number;
  rawData?: any;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  /**
   * Execute scraping protocol for a given URL and config
   */
  async scrape(baseUrl: string, config: ScraperConfig): Promise<ScrapedOpportunity[]> {
    this.logger.log(`Starting scrape: ${baseUrl} (mode: ${config.mode})`);

    try {
      if (config.mode === 'dynamic') {
        return await this.scrapeDynamic(baseUrl, config);
      } else {
        return await this.scrapeStatic(baseUrl, config);
      }
    } catch (error) {
      this.logger.error(`Scrape failed for ${baseUrl}:`, error);
      throw error;
    }
  }

  /**
   * Static scraping with cheerio
   */
  private async scrapeStatic(baseUrl: string, config: ScraperConfig): Promise<ScrapedOpportunity[]> {
    const opportunities: ScrapedOpportunity[] = [];
    let currentPage = 1;
    const maxPages = config.pagination?.maxPages || 1;

    while (currentPage <= maxPages) {
      const url = this.buildPageUrl(baseUrl, currentPage, config);
      this.logger.log(`Fetching page ${currentPage}: ${url}`);

      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract opportunities from this page
      const pageOpportunities = this.extractOpportunities($, url, config);
      opportunities.push(...pageOpportunities);

      // Check pagination
      if (!config.pagination?.enabled) break;
      
      if (config.pagination.nextButtonSelector) {
        const hasNext = $(config.pagination.nextButtonSelector).length > 0;
        if (!hasNext) break;
      }

      currentPage++;
    }

    this.logger.log(`Scraped ${opportunities.length} opportunities from ${currentPage} pages`);
    return opportunities;
  }

  /**
   * Dynamic scraping with puppeteer
   */
  private async scrapeDynamic(baseUrl: string, config: ScraperConfig): Promise<ScrapedOpportunity[]> {
    const opportunities: ScrapedOpportunity[] = [];
    
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      let currentPage = 1;
      const maxPages = config.pagination?.maxPages || 1;

      while (currentPage <= maxPages) {
        const url = this.buildPageUrl(baseUrl, currentPage, config);
        this.logger.log(`Loading page ${currentPage}: ${url}`);

        await page.goto(url, { waitUntil: 'networkidle2' });

        // Wait for specific element if configured
        if (config.waitFor?.selector) {
          await page.waitForSelector(config.waitFor.selector, {
            timeout: config.waitFor.timeout || 30000,
          });
        }

        // Get page content
        const html = await page.content();
        const $ = cheerio.load(html);

        // Extract opportunities
        const pageOpportunities = this.extractOpportunities($, url, config);
        opportunities.push(...pageOpportunities);

        // Check for next page
        if (!config.pagination?.enabled) break;
        
        if (config.pagination.nextButtonSelector) {
          const hasNext = await page.$(config.pagination.nextButtonSelector);
          if (!hasNext) break;
          
          await page.click(config.pagination.nextButtonSelector);
          await page.waitForNavigation({ waitUntil: 'networkidle2' });
        } else {
          break;
        }

        currentPage++;
      }

      this.logger.log(`Scraped ${opportunities.length} opportunities from ${currentPage} pages`);
    } finally {
      await browser.close();
    }

    return opportunities;
  }

  /**
   * Extract opportunities from loaded page
   */
  private extractOpportunities(
    $: cheerio.CheerioAPI,
    pageUrl: string,
    config: ScraperConfig,
  ): ScrapedOpportunity[] {
    const opportunities: ScrapedOpportunity[] = [];

    if (config.selectors.itemContainer) {
      // List view - extract multiple items
      $(config.selectors.itemContainer).each((_, element) => {
        const opportunity = this.extractOpportunityFromElement($, $(element), pageUrl, config);
        if (opportunity) {
          opportunities.push(opportunity);
        }
      });
    } else {
      // Single item view
      const opportunity = this.extractOpportunityFromElement($, $('body'), pageUrl, config);
      if (opportunity) {
        opportunities.push(opportunity);
      }
    }

    return opportunities;
  }

  /**
   * Extract single opportunity from element
   */
  private extractOpportunityFromElement(
    $: cheerio.CheerioAPI,
    element: cheerio.Cheerio<any>,
    pageUrl: string,
    config: ScraperConfig,
  ): ScrapedOpportunity | null {
    try {
      const programName = this.extractText(element, config.selectors.programName);
      if (!programName) return null;

      const funderName = config.selectors.funderName
        ? this.extractText(element, config.selectors.funderName)
        : undefined;

      const description = config.selectors.description
        ? this.extractText(element, config.selectors.description)
        : undefined;

      let sourceUrl = pageUrl;
      if (config.selectors.url) {
        const href = element.find(config.selectors.url).attr('href');
        if (href) {
          sourceUrl = this.resolveUrl(pageUrl, href);
        }
      }

      const geographies = config.selectors.geographies
        ? this.extractArray(element, config.selectors.geographies)
        : [];

      const opportunity: ScrapedOpportunity = {
        programName: programName.trim(),
        funderName: funderName?.trim(),
        description: description?.trim(),
        sourceUrl,
        geographies,
        rawData: {
          scrapedAt: new Date().toISOString(),
          sourceConfig: config.selectors,
        },
      };

      // Apply transforms if configured
      if (config.transforms) {
        this.applyTransforms(opportunity, config.transforms);
      }

      return opportunity;
    } catch (error) {
      this.logger.warn(`Failed to extract opportunity:`, error);
      return null;
    }
  }

  /**
   * Extract text from element using selector
   */
  private extractText(element: cheerio.Cheerio<any>, selector: string): string | undefined {
    const text = element.find(selector).first().text();
    return text ? text.trim() : undefined;
  }

  /**
   * Extract array from element (comma-separated or multiple elements)
   */
  private extractArray(element: cheerio.Cheerio<any>, selector: string): string[] {
    const text = this.extractText(element, selector);
    if (!text) return [];
    
    // Try splitting by comma first
    if (text.includes(',')) {
      return text.split(',').map(s => s.trim()).filter(Boolean);
    }
    
    return [text];
  }

  /**
   * Resolve relative URLs
   */
  private resolveUrl(baseUrl: string, href: string): string {
    if (href.startsWith('http')) return href;
    
    try {
      const base = new URL(baseUrl);
      return new URL(href, base.origin).toString();
    } catch {
      return href;
    }
  }

  /**
   * Build paginated URL
   */
  private buildPageUrl(baseUrl: string, page: number, config: ScraperConfig): string {
    if (!config.pagination?.enabled || page === 1) {
      return baseUrl;
    }

    if (config.pagination.urlPattern) {
      return config.pagination.urlPattern.replace('{page}', page.toString());
    }

    // Default: append ?page=N or &page=N
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}page=${page}`;
  }

  /**
   * Apply data transformations
   */
  private applyTransforms(opportunity: ScrapedOpportunity, transforms: any): void {
    for (const [field, transformDef] of Object.entries(transforms)) {
      const transform = transformDef as any;
      const value = (opportunity as any)[field];
      if (!value) continue;

      switch (transform.type) {
        case 'trim':
          (opportunity as any)[field] = value.trim();
          break;
        case 'split':
          if (typeof value === 'string') {
            (opportunity as any)[field] = value.split(transform.params?.delimiter || ',')
              .map((s: string) => s.trim());
          }
          break;
        case 'replace':
          if (typeof value === 'string') {
            (opportunity as any)[field] = value.replace(
              new RegExp(transform.params?.pattern, transform.params?.flags || ''),
              transform.params?.replacement || '',
            );
          }
          break;
      }
    }
  }
}
