import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

/**
 * NavigationAnalyzer - Specialized service for analyzing website navigation structures
 * 
 * Uses multiple strategies to reliably find funding/grant pages across diverse websites:
 * 1. Navigation structure analysis (menus, dropdowns)
 * 2. Full-page link scanning with keyword matching
 * 3. URL pattern recognition
 * 4. Scoring and ranking of all candidates
 */

export interface NavigationItem {
  text: string;
  url: string;
  level: number;
  parent?: string;
  children: NavigationItem[];
  score: number;
  keywords: string[];
}

export interface NavigationStructure {
  mainNav: NavigationItem[];
  dropdowns: Map<string, NavigationItem[]>;
  fundingSection?: NavigationItem;
  allLinks: string[];
}

@Injectable()
export class NavigationAnalyzerService {
  private readonly logger = new Logger(NavigationAnalyzerService.name);

  // Expanded keyword list for comprehensive grant page detection
  private readonly FUNDING_KEYWORDS = [
    // Primary grant terms
    'grant', 'grants', 'funding', 'fund', 'funds',
    // Fellowship/scholarship terms
    'fellowship', 'fellowships', 'scholarship', 'scholarships',
    // Award terms
    'award', 'awards', 'prize', 'prizes',
    // Program terms
    'scheme', 'schemes', 'programme', 'programmes', 'program', 'programs',
    // Opportunity terms
    'opportunity', 'opportunities', 'open call', 'call for',
    // Application terms
    'apply', 'application', 'applications', 'applicant', 'applicants',
    // Support terms
    'support', 'supporting', 'we support', 'what we fund',
    // Research funding specific
    'research funding', 'research grants',
  ];

  // URL patterns that strongly indicate grant/funding pages
  private readonly FUNDING_URL_PATTERNS = [
    /\/grants?\/?/i,
    /\/funding\/?/i,
    /\/fellowship/i,
    /\/schemes?\/?/i,
    /\/programmes?\/?/i,
    /\/programs?\/?/i,
    /\/awards?\/?/i,
    /\/opportunities?\/?/i,
    /\/apply\/?/i,
    /\/what-we-fund/i,
    /\/what-we-do/i,
    /\/our-work/i,
    /\/our-grants/i,
    /\/research-funding/i,
  ];

  // Negative patterns - URLs to exclude
  private readonly EXCLUDE_URL_PATTERNS = [
    /\/news/i,
    /\/blog/i,
    /\/press/i,
    /\/media/i,
    /\/about/i,
    /\/contact/i,
    /\/careers?/i,
    /\/jobs?/i,
    /\/login/i,
    /\/sign-in/i,
    /\/account/i,
    /\/privacy/i,
    /\/terms/i,
    /\/cookie/i,
    /\/accessibility/i,
    /\/search/i,
    /\/subscribe/i,
    /\/newsletter/i,
    /\/donate/i,
    /\/giving/i,
    /\/shop/i,
    /\/store/i,
    /\/events?\/?$/i,
    /\/calendar/i,
    /\/faq/i,
    /\/help\/?$/i,
  ];

  /**
   * Analyze navigation structure of a page
   * Uses multiple strategies for robust grant page detection
   */
  async analyzeNavigation(html: string, baseUrl: string): Promise<NavigationStructure> {
    const $ = cheerio.load(html);
    const structure: NavigationStructure = {
      mainNav: [],
      dropdowns: new Map(),
      allLinks: [],
    };

    this.logger.log(`Analyzing navigation for: ${baseUrl}`);

    // STRATEGY 1: Scan ALL links on the page and score them
    // This is the most reliable approach as it doesn't depend on nav structure
    const allPageLinks = this.scanAllLinks($, baseUrl);
    this.logger.log(`Found ${allPageLinks.length} scoreable links on page`);

    // Add all scored links to mainNav
    structure.mainNav = allPageLinks;
    structure.allLinks = allPageLinks.map(l => l.url);

    // Find the best funding section
    const bestCandidate = this.findBestFundingCandidate(allPageLinks, baseUrl);
    if (bestCandidate) {
      structure.fundingSection = bestCandidate;
      this.logger.log(`✓ Best funding candidate: "${bestCandidate.text}" (score: ${bestCandidate.score.toFixed(2)})`);
      this.logger.log(`  URL: ${bestCandidate.url}`);
      this.logger.log(`  Keywords: ${bestCandidate.keywords.join(', ')}`);
    } else {
      this.logger.warn('No funding section identified');
    }

    // STRATEGY 2: Try to parse hierarchical navigation for dropdowns
    // This provides additional context and child pages
    await this.parseNavigationStructure($, baseUrl, structure);

    return structure;
  }

  /**
   * Scan all links on the page and score them for funding relevance
   */
  private scanAllLinks($: cheerio.CheerioAPI, baseUrl: string): NavigationItem[] {
    const links: NavigationItem[] = [];
    const seenUrls = new Set<string>();

    $('a[href]').each((_, element) => {
      const $el = $(element);
      const href = $el.attr('href');
      if (!href) return;

      const url = this.resolveUrl(baseUrl, href);
      if (!url) return;

      // Skip if already seen
      if (seenUrls.has(url)) return;
      seenUrls.add(url);

      // Skip external links
      if (!this.isSameOrigin(baseUrl, url)) return;

      // Skip excluded patterns
      if (this.isExcludedUrl(url)) return;

      // Skip homepage
      if (this.isHomepage(url, baseUrl)) return;

      // Get link text (clean up whitespace)
      let text = $el.text().trim().replace(/\s+/g, ' ');
      if (!text || text.length < 2 || text.length > 100) return;

      // Calculate score
      const { score, keywords } = this.scoreLink(text, url);

      // Only include links with some relevance or interesting URL patterns
      if (score > 0 || this.hasFundingUrlPattern(url)) {
        links.push({
          text,
          url,
          level: 0,
          children: [],
          score,
          keywords,
        });
      }
    });

    // Sort by score descending
    links.sort((a, b) => b.score - a.score);

    return links;
  }

  /**
   * Score a link based on text content and URL patterns
   */
  private scoreLink(text: string, url: string): { score: number; keywords: string[] } {
    const textLower = text.toLowerCase();
    const urlLower = url.toLowerCase();
    let score = 0;
    const keywords: string[] = [];

    // Score based on text keywords
    for (const keyword of this.FUNDING_KEYWORDS) {
      if (textLower.includes(keyword)) {
        keywords.push(keyword);
        // Different weights for different keyword types
        if (['grant', 'grants', 'funding'].includes(keyword)) {
          score += 0.4; // Primary terms
        } else if (['fellowship', 'scholarship', 'award', 'scheme'].includes(keyword)) {
          score += 0.35; // Secondary terms
        } else {
          score += 0.2; // Tertiary terms
        }
      }
    }

    // Bonus for URL patterns
    if (this.hasFundingUrlPattern(url)) {
      score += 0.3;
      // Extract pattern name for keywords
      for (const pattern of this.FUNDING_URL_PATTERNS) {
        if (pattern.test(urlLower)) {
          const match = urlLower.match(pattern);
          if (match) {
            const patternKeyword = match[0].replace(/\//g, '').replace(/-/g, ' ');
            if (!keywords.includes(patternKeyword)) {
              keywords.push(`url:${patternKeyword}`);
            }
          }
        }
      }
    }

    // Bonus for prominent placement indicators
    if (textLower.includes('our ') || textLower.includes('view ') || textLower.includes('find ')) {
      score += 0.1;
    }

    // Cap score at 1.0
    score = Math.min(1.0, score);

    return { score, keywords };
  }

  /**
   * Find the best funding candidate from scored links
   */
  private findBestFundingCandidate(links: NavigationItem[], baseUrl: string): NavigationItem | undefined {
    if (links.length === 0) return undefined;

    // Already sorted by score, but apply additional heuristics
    const candidates = links.filter(l => l.score > 0.2);
    
    if (candidates.length === 0) {
      // Fall back to URL pattern matching only
      const urlMatches = links.filter(l => this.hasFundingUrlPattern(l.url));
      if (urlMatches.length > 0) {
        return urlMatches[0];
      }
      return undefined;
    }

    // Prefer links with both keyword AND URL pattern matches
    const dualMatch = candidates.find(l => 
      l.keywords.length > 0 && this.hasFundingUrlPattern(l.url)
    );
    if (dualMatch) return dualMatch;

    // Return highest scoring candidate
    return candidates[0];
  }

  /**
   * Parse hierarchical navigation structure for dropdowns
   */
  private async parseNavigationStructure(
    $: cheerio.CheerioAPI, 
    baseUrl: string, 
    structure: NavigationStructure
  ): Promise<void> {
    const navSelectors = [
      'nav', 'header nav', '[role="navigation"]', 
      '.navigation', '.main-nav', '.primary-nav',
      'ul.menu', 'ul.nav', '.navbar'
    ];

    let navElement = null;
    for (const selector of navSelectors) {
      const found = $(selector).first();
      if (found.length > 0) {
        navElement = found;
        this.logger.debug(`Found navigation using selector: ${selector}`);
        break;
      }
    }

    if (!navElement) {
      this.logger.debug('No navigation element found');
      return;
    }

    // Find all links within navigation and their structure
    const navLinks = navElement.find('a').toArray();
    this.logger.debug(`Found ${navLinks.length} links in navigation element`);

    // Try to build dropdown structure from nested lists
    const topLevelLists = navElement.find('> ul, > ol').first();
    if (topLevelLists.length > 0) {
      const topItems = topLevelLists.find('> li').toArray();
      
      for (const item of topItems) {
        const $item = $(item);
        const link = $item.find('a').first();
        const subList = $item.find('ul, ol').first();

        if (link.length > 0 && subList.length > 0) {
          const text = link.text().trim();
          const href = link.attr('href');
          const url = href ? this.resolveUrl(baseUrl, href) : null;

          const children: NavigationItem[] = [];
          subList.find('> li > a').each((_, childEl) => {
            const $child = $(childEl);
            const childText = $child.text().trim();
            const childHref = $child.attr('href');
            const childUrl = childHref ? this.resolveUrl(baseUrl, childHref) : null;

            if (childUrl && childText) {
              const { score, keywords } = this.scoreLink(childText, childUrl);
              children.push({
                text: childText,
                url: childUrl,
                level: 1,
                parent: text,
                children: [],
                score,
                keywords,
              });
            }
          });

          if (children.length > 0) {
            structure.dropdowns.set(text, children);
            
            // Add children to funding section if this is the funding section
            if (structure.fundingSection && url === structure.fundingSection.url) {
              structure.fundingSection.children = children;
            }
          }
        }
      }
    }
  }

  /**
   * Check if URL matches funding patterns
   */
  private hasFundingUrlPattern(url: string): boolean {
    return this.FUNDING_URL_PATTERNS.some(pattern => pattern.test(url));
  }

  /**
   * Check if URL matches exclusion patterns
   */
  private isExcludedUrl(url: string): boolean {
    return this.EXCLUDE_URL_PATTERNS.some(pattern => pattern.test(url));
  }

  /**
   * Check if URL is the homepage
   */
  private isHomepage(url: string, baseUrl: string): boolean {
    try {
      const urlObj = new URL(url);
      const baseObj = new URL(baseUrl);
      // Homepage if path is empty or just /
      return urlObj.pathname === '/' || urlObj.pathname === '';
    } catch {
      return false;
    }
  }


  /**
   * Extract all scheme links from a funding section
   */
  extractSchemeLinks(fundingSection: NavigationItem): Array<{ name: string; url: string; score: number }> {
    const schemes: Array<{ name: string; url: string; score: number }> = [];
    
    // Always add the main section URL (it's the primary funding page)
    schemes.push({
      name: fundingSection.text,
      url: fundingSection.url,
      score: fundingSection.score,
    });

    // Add all children (individual schemes)
    for (const child of fundingSection.children) {
      schemes.push({
        name: child.text,
        url: child.url,
        score: child.score || fundingSection.score * 0.7,
      });
      
      // Add grandchildren if any
      for (const grandchild of child.children) {
        schemes.push({
          name: grandchild.text,
          url: grandchild.url,
          score: grandchild.score || child.score * 0.7,
        });
      }
    }

    return schemes;
  }

  /**
   * Resolve relative URL to absolute
   */
  private resolveUrl(baseUrl: string, href: string): string | null {
    try {
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return null;
      }
      const resolved = new URL(href, baseUrl);
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
        return resolved.toString();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if URLs are from same origin
   */
  private isSameOrigin(url1: string, url2: string): boolean {
    try {
      const u1 = new URL(url1);
      const u2 = new URL(url2);
      return u1.origin === u2.origin;
    } catch {
      return false;
    }
  }
}
