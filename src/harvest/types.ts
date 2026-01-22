/**
 * Types for harvest source discovery and opportunity extraction
 */

export interface SuggestedSource {
  url: string;
  title?: string;
  anchorText?: string;
  score: number;
  discoveredAt: string;
  pageTitle?: string;
  keywords: string[];
  grantData?: any; // Extracted grant data if available
  alignmentScore?: any; // Odyssean Institute alignment score
}

export interface SourceDiscoveryResult {
  funderId: string;
  funderName: string;
  seedUrl: string;
  discoveredAt: string;
  sources: SuggestedSource[];
  stats: {
    totalLinksFound: number;
    linksScored: number;
    topSourcesReturned: number;
    manualLinksProvided?: number;
    manualLinksProcessed?: number;
    seedUrlProcessed?: boolean;
    newSourcesDiscovered?: number;
  };
  warnings?: string[];
}

export interface SourceDiscoveryRun {
  runId: string;
  funderId: string;
  seedUrl: string | null;
  timestamp: string;
  status: 'running' | 'completed' | 'failed';
  result?: SourceDiscoveryResult | Partial<SourceDiscoveryResult>;
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * Normalized opportunity ready for DB integration
 */
export interface NormalizedOpportunity {
  externalId?: string;
  programName: string;
  sourceUrl: string;
  description?: string; // Concise summary (1-2 sentences) from scraper
  rawDescription?: string; // Full unedited description from source page
  declaredFocus?: string[];
  geographies?: string[];
  eligibleApplicantTypes?: string[];
  deadlines?: Array<{ date: string; type?: string }>; // Array of deadline objects (matches Prisma JSON field)
  minAward?: number;
  maxAward?: number;
  currency?: string;
  durationMonths?: number;
  status: 'OPEN' | 'CLOSED' | 'UNKNOWN';
  tags: string[];
  scrapedAt: string;
}

/**
 * Harvest run plan containing normalized opportunities
 */
export interface HarvestRunPlan {
  runId: string;
  sourceType: 'web_scrape' | 'llm_extraction';
  sourceName: string;
  sourceUrl: string;
  funderId: string;
  funderName: string;
  config: any;
  timestamp: string;
  stats: {
    totalOpportunities: number;
    newOpportunities: number;
    updatedOpportunities: number;
    unchangedOpportunities: number;
  };
  opportunities: NormalizedOpportunity[] | any[];
}

/**
 * Harvest run summary
 */
export interface HarvestRunSummary {
  runId: string;
  source: {
    id: string;
    name: string;
    baseUrl: string;
  };
  funder: {
    id: string;
    name: string;
  };
  executedAt: string;
  status: 'completed' | 'failed';
  stats: {
    opportunitiesFound: number;
    newOpportunities: number;
    updatedOpportunities: number;
  };
  error?: string;
}
