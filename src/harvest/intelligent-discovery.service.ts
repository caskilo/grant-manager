import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { NavigationAnalyzerService } from './navigation-analyzer.service';
import { GrantPageExtractorService } from './grant-page-extractor.service';

/**
 * IntelligentDiscoveryService - Human-like website analysis for grant opportunity discovery
 * 
 * Strategy:
 * 1. Analyze navigation structure (menus, dropdowns)
 * 2. Identify funding sections and scheme links
 * 3. Explore scheme pages and extract grant data
 * 4. Score and rank discovered opportunities
 */

export interface SiteSection {
  id: string;
  heading: string;
  level: number;
  content: string;
  links: Array<{ url: string; text: string; context: string }>;
  indicators: {
    hasDeadlines: boolean;
    hasAmounts: boolean;
    hasEligibility: boolean;
    hasApplicationInfo: boolean;
    hasStructuredContent: boolean;
  };
}

export interface ScoredSection {
  section: SiteSection;
  score: number;
  reasoning: string[];
  suggestedAction: 'explore' | 'harvest' | 'skip';
}

export interface DiscoveredSource {
  url: string;
  type: 'hub' | 'list' | 'detail';
  score: number;
  confidence: number;
  reasoning: string[];
  pageTitle?: string;
  opportunityIndicators: number;
  grantData?: any; // Extracted grant data if available
}

@Injectable()
export class IntelligentDiscoveryService {
  private readonly logger = new Logger(IntelligentDiscoveryService.name);

  constructor(
    private navigationAnalyzer: NavigationAnalyzerService,
    private grantExtractor: GrantPageExtractorService,
  ) {}

  // Keywords indicating grant/funding content
  private readonly FUNDING_KEYWORDS = [
    'funding', 'grant', 'grants', 'opportunity', 'opportunities',
    'programme', 'programs', 'scheme', 'schemes', 'award', 'awards',
    'fellowship', 'fellowships', 'call', 'calls', 'apply', 'application',
  ];

  // Keywords indicating non-content pages
  private readonly NEGATIVE_KEYWORDS = [
    'about', 'contact', 'privacy', 'terms', 'cookie', 'legal',
    'sitemap', 'search', 'login', 'register', 'news', 'blog',
  ];

  // Indicators of opportunity content
  private readonly OPPORTUNITY_INDICATORS = {
    deadlines: ['deadline', 'closing date', 'closes', 'due date', 'submit by'],
    amounts: ['£', '$', '€', 'funding available', 'award amount', 'up to'],
    eligibility: ['eligible', 'eligibility', 'who can apply', 'applicant', 'criteria'],
    application: ['apply', 'application', 'how to apply', 'submit', 'guidelines'],
  };

  /**
   * Rate limiting helper - adds polite delay between requests
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Analyze a website and discover potential harvest sources
   * Enhanced with navigation menu analysis and robust fallbacks
   */
  async discoverSources(seedUrl: string, maxDepth: number = 2): Promise<DiscoveredSource[]> {
    this.logger.log(`Starting intelligent discovery for: ${seedUrl} (depth: ${maxDepth})`);

    // Validate URL first
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(seedUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error(`Invalid protocol: ${parsedUrl.protocol}`);
      }
    } catch (urlError: any) {
      throw new Error(`Invalid URL "${seedUrl}": ${urlError.message}`);
    }

    let html: string;
    
    try {
      // Phase 1: Fetch page with timeout and retry
      const response = await this.fetchWithRetry(seedUrl, 2);
      html = await response.text();
      
      if (!html || html.trim().length < 100) {
        throw new Error('Page returned empty or minimal content');
      }
    } catch (fetchError: any) {
      // Provide user-friendly error messages
      const friendlyError = this.getFriendlyHttpError(fetchError, seedUrl);
      throw new Error(friendlyError);
    }

    try {
      // Analyze navigation menus and dropdowns
      const navigation = await this.navigationAnalyzer.analyzeNavigation(html, seedUrl);
      
      this.logger.log(`Navigation analysis: found ${navigation.mainNav.length} top-level items, ${navigation.dropdowns.size} dropdowns`);
      
      const sources: DiscoveredSource[] = [];
      
      // Phase 2: Extract scheme links from funding section
      if (navigation.fundingSection) {
        this.logger.log(`Found funding section: "${navigation.fundingSection.text}"`);
        
        const schemeLinks = this.navigationAnalyzer.extractSchemeLinks(navigation.fundingSection);
        this.logger.log(`Extracted ${schemeLinks.length} scheme links from navigation`);
        
        // Phase 3: Analyze each scheme page
        for (const scheme of schemeLinks.slice(0, 20)) {
          try {
            this.logger.log(`Analyzing scheme: ${scheme.name}`);
            
            // Polite crawling: 1 second delay between requests
            await this.delay(1000);
            
            const schemeResponse = await fetch(scheme.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
            });
            
            if (!schemeResponse.ok) {
              this.logger.warn(`Failed to fetch ${scheme.url}: ${schemeResponse.status}`);
              continue;
            }
            
            const schemeHtml = await schemeResponse.text();
            
            // Extract grant details using heuristic extraction
            // NOTE: LLM extraction is NOT done during discovery - it happens during harvest
            // Discovery only identifies potential sources and extracts basic metadata
            
            let grantData: any = null;
            let extractionMethod = 'none';
            
            // Strategy: Heuristic extraction only (fast, no API cost)
            if (!grantData) {
              grantData = await this.grantExtractor.extractGrantData(schemeHtml, scheme.url);
              if (grantData) {
                extractionMethod = 'heuristic';
                this.logger.log(`  ✓ Heuristic extracted: ${grantData.programName}`);
              }
            }
            
            if (grantData) {
              sources.push({
                url: scheme.url,
                type: 'detail',
                score: scheme.score,
                confidence: extractionMethod === 'llm' ? 0.95 : 0.8,
                reasoning: [
                  `Found in "${navigation.fundingSection.text}" menu`,
                  `Extraction: ${extractionMethod}`,
                  `Program: ${grantData.programName}`,
                  grantData.deadline ? `Deadline: ${grantData.deadline}` : 'No deadline found',
                  grantData.maxAward ? `Max award: ${grantData.currency || ''}${grantData.maxAward}` : 'No award info',
                ],
                pageTitle: grantData.programName,
                opportunityIndicators: this.countIndicators(grantData),
                grantData,
              });
            } else {
              // Strategy 3: Basic page analysis (last resort)
              const pageStructure = await this.analyzePage(scheme.url);
              const pageScore = this.calculatePageScore(pageStructure);
              
              sources.push({
                url: scheme.url,
                type: this.classifyPageType(pageStructure),
                score: Math.max(scheme.score, pageScore.score),
                confidence: pageScore.confidence,
                reasoning: [`Found in navigation menu`, `Extraction: basic analysis`, ...pageScore.reasoning],
                pageTitle: pageStructure.title,
                opportunityIndicators: pageScore.indicators,
              });
              this.logger.log(`  ⚠ Basic analysis only for: ${scheme.url}`);
            }
          } catch (error) {
            this.logger.warn(`Error analyzing ${scheme.name}: ${error.message}`);
          }
        }
      } else {
        // Fallback to old method if no funding section found
        this.logger.warn('No funding section found in navigation, using fallback analysis');
        const seedStructure = await this.analyzePage(seedUrl);
        const scoredSections = this.scoreSections(seedStructure.sections);
        
        const topSections = scoredSections
          .filter(s => s.score > 50 && s.suggestedAction === 'explore')
          .slice(0, 10);
        
        for (const scoredSection of topSections) {
          for (const link of scoredSection.section.links.slice(0, 3)) {
            try {
              const linkStructure = await this.analyzePage(link.url);
              const linkScore = this.calculatePageScore(linkStructure);
              
              if (linkScore.score > 0.4) {
                sources.push({
                  url: link.url,
                  type: this.classifyPageType(linkStructure),
                  score: linkScore.score,
                  confidence: linkScore.confidence,
                  reasoning: linkScore.reasoning,
                  pageTitle: linkStructure.title,
                  opportunityIndicators: linkScore.indicators,
                });
              }
            } catch (error) {
              this.logger.debug(`Failed to analyze ${link.url}: ${error.message}`);
            }
          }
        }
      }

      // Sort by score and return
      sources.sort((a, b) => b.score - a.score);
      
      this.logger.log(`Discovery complete: found ${sources.length} sources`);
      
      return sources.slice(0, 25);
    } catch (error) {
      this.logger.error(`Discovery failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Count opportunity indicators in extracted grant data
   */
  private countIndicators(grantData: any): number {
    let count = 0;
    if (grantData.deadline) count++;
    if (grantData.maxAward) count++;
    if (grantData.eligibility?.length > 0) count++;
    if (grantData.applicationInfo?.length > 0) count++;
    if (grantData.keyDates?.length > 0) count++;
    return count;
  }

  /**
   * Analyze page structure and extract sections
   */
  private async analyzePage(url: string): Promise<{
    url: string;
    title: string;
    sections: SiteSection[];
    linkCount: number;
  }> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract page title
    const title = $('title').text().trim() || $('h1').first().text().trim();

    // Extract sections based on headings
    const sections: SiteSection[] = [];
    let sectionId = 0;

    $('h1, h2, h3').each((_, element) => {
      const heading = $(element).text().trim();
      const level = parseInt(element.tagName.substring(1));
      
      // Get content until next heading of same or higher level
      let content = '';
      let currentElement = $(element).next();
      
      while (currentElement.length > 0) {
        const tagName = currentElement.prop('tagName')?.toLowerCase();
        if (tagName && ['h1', 'h2', 'h3'].includes(tagName)) {
          const nextLevel = parseInt(tagName.substring(1));
          if (nextLevel <= level) break;
        }
        content += currentElement.text() + ' ';
        currentElement = currentElement.next();
      }

      // Extract links in this section
      const links: Array<{ url: string; text: string; context: string }> = [];
      $(element).nextUntil(`h${level}, h${level - 1}`).find('a[href]').each((_, link) => {
        const href = $(link).attr('href');
        const text = $(link).text().trim();
        if (href && text) {
          const resolved = this.resolveUrl(url, href);
          if (resolved) {
            links.push({
              url: resolved,
              text,
              context: $(link).parent().text().substring(0, 100),
            });
          }
        }
      });

      // Detect indicators
      const contentLower = content.toLowerCase();
      const indicators = {
        hasDeadlines: this.OPPORTUNITY_INDICATORS.deadlines.some(kw => contentLower.includes(kw)),
        hasAmounts: this.OPPORTUNITY_INDICATORS.amounts.some(kw => contentLower.includes(kw)),
        hasEligibility: this.OPPORTUNITY_INDICATORS.eligibility.some(kw => contentLower.includes(kw)),
        hasApplicationInfo: this.OPPORTUNITY_INDICATORS.application.some(kw => contentLower.includes(kw)),
        hasStructuredContent: content.includes('•') || content.includes('–') || links.length > 3,
      };

      sections.push({
        id: `section-${sectionId++}`,
        heading,
        level,
        content: content.trim().substring(0, 500),
        links,
        indicators,
      });
    });

    return {
      url,
      title,
      sections,
      linkCount: $('a[href]').length,
    };
  }

  /**
   * Score sections by relevance to grant opportunities
   */
  private scoreSections(sections: SiteSection[]): ScoredSection[] {
    return sections.map(section => {
      let score = 0;
      const reasoning: string[] = [];

      // Heading analysis (40 points)
      const headingLower = section.heading.toLowerCase();
      const fundingMatches = this.FUNDING_KEYWORDS.filter(kw => headingLower.includes(kw));
      if (fundingMatches.length > 0) {
        const headingScore = Math.min(40, fundingMatches.length * 15);
        score += headingScore;
        reasoning.push(`Heading contains funding keywords: ${fundingMatches.join(', ')}`);
      }

      // Negative keywords penalty
      const negativeMatches = this.NEGATIVE_KEYWORDS.filter(kw => headingLower.includes(kw));
      if (negativeMatches.length > 0) {
        score = Math.max(0, score - 30);
        reasoning.push(`Contains negative keywords: ${negativeMatches.join(', ')}`);
      }

      // Content indicators (30 points)
      let indicatorScore = 0;
      if (section.indicators.hasDeadlines) {
        indicatorScore += 10;
        reasoning.push('Contains deadline information');
      }
      if (section.indicators.hasAmounts) {
        indicatorScore += 10;
        reasoning.push('Contains funding amounts');
      }
      if (section.indicators.hasEligibility) {
        indicatorScore += 5;
        reasoning.push('Contains eligibility criteria');
      }
      if (section.indicators.hasApplicationInfo) {
        indicatorScore += 5;
        reasoning.push('Contains application information');
      }
      score += indicatorScore;

      // Link patterns (20 points)
      const relevantLinks = section.links.filter(link => {
        const linkLower = link.text.toLowerCase() + link.url.toLowerCase();
        return this.FUNDING_KEYWORDS.some(kw => linkLower.includes(kw));
      });
      if (relevantLinks.length > 0) {
        const linkScore = Math.min(20, relevantLinks.length * 5);
        score += linkScore;
        reasoning.push(`${relevantLinks.length} relevant links found`);
      }

      // Structured content (10 points)
      if (section.indicators.hasStructuredContent) {
        score += 10;
        reasoning.push('Has structured content (lists/tables)');
      }

      // Determine action
      let suggestedAction: 'explore' | 'harvest' | 'skip';
      if (score >= 60) {
        suggestedAction = 'explore';
      } else if (score >= 30) {
        suggestedAction = 'harvest';
      } else {
        suggestedAction = 'skip';
      }

      return {
        section,
        score,
        reasoning,
        suggestedAction,
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate overall page score
   */
  private calculatePageScore(structure: { title: string; sections: SiteSection[]; linkCount: number }): {
    score: number;
    confidence: number;
    reasoning: string[];
    indicators: number;
  } {
    const reasoning: string[] = [];
    let indicatorCount = 0;

    // Title analysis
    const titleLower = structure.title.toLowerCase();
    const titleHasFunding = this.FUNDING_KEYWORDS.some(kw => titleLower.includes(kw));
    
    // Count sections with indicators
    const sectionsWithIndicators = structure.sections.filter(s => 
      s.indicators.hasDeadlines || 
      s.indicators.hasAmounts || 
      s.indicators.hasEligibility ||
      s.indicators.hasApplicationInfo
    );

    indicatorCount = sectionsWithIndicators.length;

    // Calculate base score
    let score = 0;
    
    if (titleHasFunding) {
      score += 0.3;
      reasoning.push('Title contains funding keywords');
    }

    if (sectionsWithIndicators.length > 0) {
      score += Math.min(0.4, sectionsWithIndicators.length * 0.1);
      reasoning.push(`${sectionsWithIndicators.length} sections with opportunity indicators`);
    }

    if (structure.linkCount > 10) {
      score += 0.2;
      reasoning.push('Rich link structure');
    }

    // Confidence based on indicator diversity
    const confidence = Math.min(1, indicatorCount / 3);

    return {
      score: Math.min(1, score),
      confidence,
      reasoning,
      indicators: indicatorCount,
    };
  }

  /**
   * Classify page type based on structure
   */
  private classifyPageType(structure: { sections: SiteSection[]; linkCount: number }): 'hub' | 'list' | 'detail' {
    const sectionsWithManyLinks = structure.sections.filter(s => s.links.length > 5).length;
    
    if (sectionsWithManyLinks > 2) {
      return 'hub'; // Navigation/directory page
    } else if (structure.linkCount > 20) {
      return 'list'; // List of opportunities
    } else {
      return 'detail'; // Individual opportunity page
    }
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

  /**
   * Fetch URL with retry logic and timeout
   */
  private async fetchWithRetry(url: string, maxRetries: number = 2): Promise<Response> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on 4xx errors (client errors like 404, 403)
        if (error.message?.includes('HTTP 4')) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          this.logger.warn(`Fetch attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Fetch failed after retries');
  }

  /**
   * Convert HTTP errors to user-friendly messages
   */
  private getFriendlyHttpError(error: any, url: string): string {
    const errorMsg = error.message || String(error);
    
    if (errorMsg.includes('HTTP 404')) {
      return `Page not found (404). The URL "${url}" does not exist. Please check the funder's website URL is correct.`;
    }
    if (errorMsg.includes('HTTP 403')) {
      return `Access forbidden (403). The website "${new URL(url).hostname}" is blocking automated access. Try adding a different page URL manually.`;
    }
    if (errorMsg.includes('HTTP 401')) {
      return `Authentication required (401). The page "${url}" requires login credentials.`;
    }
    if (errorMsg.includes('HTTP 5')) {
      return `Server error. The website "${new URL(url).hostname}" is experiencing issues. Try again later.`;
    }
    if (errorMsg.includes('abort') || errorMsg.includes('timeout')) {
      return `Request timed out. The website "${new URL(url).hostname}" took too long to respond.`;
    }
    if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
      return `Domain not found. The website "${new URL(url).hostname}" does not exist or DNS lookup failed.`;
    }
    if (errorMsg.includes('ECONNREFUSED')) {
      return `Connection refused. The website "${new URL(url).hostname}" is not accepting connections.`;
    }
    if (errorMsg.includes('certificate') || errorMsg.includes('SSL') || errorMsg.includes('TLS')) {
      return `SSL/TLS error. The website "${new URL(url).hostname}" has certificate issues.`;
    }
    
    return `Failed to fetch "${url}": ${errorMsg}`;
  }
}
