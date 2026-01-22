import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

/**
 * GrantPageExtractor - Specialized service for extracting grant opportunity data
 * from detail pages using intelligent content analysis
 */

export interface ExtractedGrantData {
  programName: string;
  description: string;
  rawDescription: string;
  deadline?: string;
  openDate?: string;
  decisionDate?: string;
  minAward?: number;
  maxAward?: number;
  currency?: string;
  durationMonths?: number;
  eligibility: string[];
  applicationInfo: string[];
  researchExpenses?: number;
  keyDates: Array<{ type: string; date: string }>;
  contactInfo?: { name?: string; email?: string; phone?: string };
}

@Injectable()
export class GrantPageExtractorService {
  private readonly logger = new Logger(GrantPageExtractorService.name);

  /**
   * Extract grant data from a detail page
   */
  async extractGrantData(html: string, url: string): Promise<ExtractedGrantData | null> {
    const $ = cheerio.load(html);

    // Extract program name from H1 or title
    const programName = this.extractProgramName($);
    if (!programName) {
      this.logger.warn(`No program name found at ${url}`);
      return null;
    }

    // Extract main content
    const mainContent = this.extractMainContent($);
    
    // Extract structured data
    const deadlineInfo = this.extractDeadlines($, mainContent);
    const awardInfo = this.extractAwardAmounts($, mainContent);
    const eligibility = this.extractEligibility($, mainContent);
    const applicationInfo = this.extractApplicationInfo($, mainContent);
    const contactInfo = this.extractContactInfo($, mainContent);

    // Create description (first substantial paragraph)
    const description = this.createDescription($, mainContent);
    const rawDescription = mainContent.substring(0, 2000); // First 2000 chars

    const extractedData: ExtractedGrantData = {
      programName,
      description,
      rawDescription,
      deadline: deadlineInfo.closingDate,
      openDate: deadlineInfo.openingDate,
      decisionDate: deadlineInfo.decisionDate,
      minAward: awardInfo.min,
      maxAward: awardInfo.max,
      currency: awardInfo.currency,
      durationMonths: this.extractDuration($, mainContent),
      eligibility,
      applicationInfo,
      researchExpenses: this.extractResearchExpenses($, mainContent),
      keyDates: deadlineInfo.allDates,
      contactInfo,
    };

    this.logger.log(`Extracted data for: ${programName}`);
    return extractedData;
  }

  /**
   * Extract program name from page
   */
  private extractProgramName($: cheerio.CheerioAPI): string | null {
    // Try H1 first
    let name = $('h1').first().text().trim();
    if (name) return name;

    // Try title
    name = $('title').text().trim();
    if (name) {
      // Remove site suffix (e.g. "| The Leverhulme Trust")
      return name.split('|')[0].trim();
    }

    return null;
  }

  /**
   * Extract main content area
   */
  private extractMainContent($: cheerio.CheerioAPI): string {
    // Try common content selectors
    const contentSelectors = [
      'main', '[role="main"]', '.main-content', 
      '#content', '.content', 'article'
    ];

    for (const selector of contentSelectors) {
      const content = $(selector).first();
      if (content.length > 0) {
        return content.text().trim();
      }
    }

    // Fallback: get body text
    return $('body').text().trim();
  }

  /**
   * Extract deadlines and key dates
   */
  private extractDeadlines($: cheerio.CheerioAPI, content: string): {
    closingDate?: string;
    openingDate?: string;
    decisionDate?: string;
    allDates: Array<{ type: string; date: string }>;
  } {
    const result: {
      closingDate?: string;
      openingDate?: string;
      decisionDate?: string;
      allDates: Array<{ type: string; date: string }>;
    } = {
      allDates: [],
    };

    // Look for "Key dates" section
    const keyDatesSection = $('h2, h3').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('key date') || text.includes('deadline') || text.includes('closing date');
    }).first();

    if (keyDatesSection.length > 0) {
      // Extract dates from the section following this heading
      let currentElement = keyDatesSection.next();
      let sectionText = '';
      
      while (currentElement.length > 0) {
        const tagName = currentElement.prop('tagName')?.toLowerCase();
        if (tagName && ['h1', 'h2', 'h3'].includes(tagName)) break;
        sectionText += currentElement.text() + '\n';
        currentElement = currentElement.next();
      }

      // Parse dates from section
      const datePatterns = [
        { regex: /Opens?:\s*([0-9]{1,2}\s+\w+\s+[0-9]{4})/gi, type: 'opens' },
        { regex: /Closes?:\s*([0-9]{1,2}\s+\w+\s+[0-9]{4})/gi, type: 'closes' },
        { regex: /Closing\s+date:\s*([0-9]{1,2}\s+\w+\s+[0-9]{4})/gi, type: 'closes' },
        { regex: /Decision:\s*(\w+\s+[0-9]{4})/gi, type: 'decision' },
        { regex: /Deadline:\s*([0-9]{1,2}\s+\w+\s+[0-9]{4})/gi, type: 'closes' },
      ];

      for (const pattern of datePatterns) {
        const matches = sectionText.matchAll(pattern.regex);
        for (const match of matches) {
          const dateStr = match[1].trim();
          result.allDates.push({ type: pattern.type, date: dateStr });
          
          if (pattern.type === 'opens' && !result.openingDate) {
            result.openingDate = dateStr;
          } else if (pattern.type === 'closes' && !result.closingDate) {
            result.closingDate = dateStr;
          } else if (pattern.type === 'decision' && !result.decisionDate) {
            result.decisionDate = dateStr;
          }
        }
      }
    }

    return result;
  }

  /**
   * Extract award amounts and currency
   */
  private extractAwardAmounts($: cheerio.CheerioAPI, content: string): {
    min?: number;
    max?: number;
    currency?: string;
  } {
    const result: { min?: number; max?: number; currency?: string } = {};

    // Look for currency symbols and amounts
    const currencyPatterns = [
      { symbol: '£', currency: 'GBP' },
      { symbol: '$', currency: 'USD' },
      { symbol: '€', currency: 'EUR' },
    ];

    for (const { symbol, currency } of currencyPatterns) {
      if (content.includes(symbol)) {
        result.currency = currency;
        break;
      }
    }

    // Extract amounts (e.g. "£56,000", "up to £6,000")
    const amountPattern = /[£$€]\s*([0-9,]+(?:\.[0-9]{2})?)\s*(?:k|thousand|million)?/gi;
    const amounts: number[] = [];
    
    const matches = content.matchAll(amountPattern);
    for (const match of matches) {
      let amount = parseFloat(match[1].replace(/,/g, ''));
      
      // Check for k/thousand/million multipliers in surrounding text
      const context = content.substring(Math.max(0, match.index! - 20), match.index! + 50);
      if (/\d+k\b/i.test(context)) {
        amount *= 1000;
      } else if (/thousand/i.test(context)) {
        amount *= 1000;
      } else if (/million/i.test(context)) {
        amount *= 1000000;
      }
      
      amounts.push(amount);
    }

    if (amounts.length > 0) {
      amounts.sort((a, b) => a - b);
      result.min = amounts[0];
      result.max = amounts[amounts.length - 1];
    }

    return result;
  }

  /**
   * Extract eligibility criteria
   */
  private extractEligibility($: cheerio.CheerioAPI, content: string): string[] {
    const eligibility: string[] = [];

    // Look for eligibility section
    const eligibilitySection = $('h2, h3').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('eligib') || text.includes('who can apply');
    }).first();

    if (eligibilitySection.length > 0) {
      let currentElement = eligibilitySection.next();
      
      while (currentElement.length > 0) {
        const tagName = currentElement.prop('tagName')?.toLowerCase();
        if (tagName && ['h1', 'h2', 'h3'].includes(tagName)) break;
        
        if (tagName === 'ul' || tagName === 'ol') {
          currentElement.find('li').each((_, li) => {
            const text = $(li).text().trim();
            if (text && text.length > 10) {
              eligibility.push(text);
            }
          });
        } else if (tagName === 'p') {
          const text = currentElement.text().trim();
          if (text && text.length > 20) {
            eligibility.push(text);
          }
        }
        
        currentElement = currentElement.next();
      }
    }

    return eligibility.slice(0, 10); // Limit to 10 criteria
  }

  /**
   * Extract application information
   */
  private extractApplicationInfo($: cheerio.CheerioAPI, content: string): string[] {
    const appInfo: string[] = [];

    // Look for application section
    const appSection = $('h2, h3').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('application') || text.includes('how to apply') || text.includes('applying');
    }).first();

    if (appSection.length > 0) {
      let currentElement = appSection.next();
      
      while (currentElement.length > 0 && appInfo.length < 5) {
        const tagName = currentElement.prop('tagName')?.toLowerCase();
        if (tagName && ['h1', 'h2', 'h3'].includes(tagName)) break;
        
        const text = currentElement.text().trim();
        if (text && text.length > 20) {
          appInfo.push(text);
        }
        
        currentElement = currentElement.next();
      }
    }

    return appInfo;
  }

  /**
   * Extract contact information
   */
  private extractContactInfo($: cheerio.CheerioAPI, content: string): { name?: string; email?: string; phone?: string } {
    const contact: { name?: string; email?: string; phone?: string } = {};

    // Look for email
    const emailMatch = content.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      contact.email = emailMatch[0];
    }

    // Look for phone
    const phoneMatch = content.match(/(?:\+44|0)\s*\d{2,4}\s*\d{3,4}\s*\d{4}/);
    if (phoneMatch) {
      contact.phone = phoneMatch[0];
    }

    return contact;
  }

  /**
   * Extract duration in months
   */
  private extractDuration($: cheerio.CheerioAPI, content: string): number | undefined {
    // Look for patterns like "3 years", "36 months"
    const yearMatch = content.match(/(\d+)\s*years?/i);
    if (yearMatch) {
      return parseInt(yearMatch[1]) * 12;
    }

    const monthMatch = content.match(/(\d+)\s*months?/i);
    if (monthMatch) {
      return parseInt(monthMatch[1]);
    }

    return undefined;
  }

  /**
   * Extract research expenses budget
   */
  private extractResearchExpenses($: cheerio.CheerioAPI, content: string): number | undefined {
    // Look for "research expenses" mentions with amounts
    const expensePattern = /research\s+expenses[^\d]*[£$€]\s*([0-9,]+)/gi;
    const match = content.match(expensePattern);
    
    if (match) {
      const amountMatch = match[0].match(/[£$€]\s*([0-9,]+)/);
      if (amountMatch) {
        return parseFloat(amountMatch[1].replace(/,/g, ''));
      }
    }

    return undefined;
  }

  /**
   * Create concise description from first substantial paragraph
   */
  private createDescription($: cheerio.CheerioAPI, content: string): string {
    // Find the first H1, then get the paragraph after it
    const h1 = $('h1').first();
    if (h1.length > 0) {
      let next = h1.next();
      while (next.length > 0) {
        const tagName = next.prop('tagName')?.toLowerCase();
        if (tagName === 'p') {
          const text = next.text().trim();
          if (text.length > 50) {
            return text.substring(0, 300);
          }
        }
        next = next.next();
      }
    }

    // Fallback: first paragraph in main content
    const firstPara = $('main p, article p, .content p').first().text().trim();
    return firstPara.substring(0, 300);
  }
}
