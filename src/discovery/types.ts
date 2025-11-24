/**
 * Type definitions for the Discovery workflow
 */

export interface DiscoverySource {
  id: string;
  type: 'catalogue' | 'web' | 'csv' | 'api';
  name: string;
  pathOrUrl: string;
  enabled: boolean;
  notes?: string;
  lastRun?: string | null;
}

export interface ParsedFunder {
  funderName: string;
  website?: string;
  type?: string;
  focus?: string;
  geography?: string;
  notes?: string;
}

export interface ParsedOpportunity {
  externalId?: string;
  programName: string;
  sourceUrl: string;
  declaredFocus: string[];
  geographies: string[];
  eligibleApplicantTypes: string[];
  minAward?: number;
  maxAward?: number;
  currency?: string;
  durationMonths?: number;
  rawDescription?: string;
  status?: string;
}

export interface ParsedCatalogueEntry {
  funder: ParsedFunder;
  opportunities: ParsedOpportunity[];
}

export interface DiscoveryRunMetadata {
  runDate: string;
  sourceId: string;
  sourceName: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'failed';
  error?: string;
}

export interface DiscoveryRunPlan {
  newFunders: Array<{
    funder: ParsedFunder;
    reason: string;
  }>;
  existingFunders: Array<{
    id: string;
    name: string;
    matched: ParsedFunder;
  }>;
  newOpportunities: Array<{
    opportunity: ParsedOpportunity;
    funderName: string;
    reason: string;
  }>;
  updatedOpportunities: Array<{
    id: string;
    programName: string;
    changes: Record<string, any>;
  }>;
  unchangedOpportunities: Array<{
    id: string;
    programName: string;
  }>;
}

export interface DiscoverySummary {
  metadata: DiscoveryRunMetadata;
  plan: DiscoveryRunPlan;
  stats: {
    totalFundersInSource: number;
    newFunders: number;
    existingFunders: number;
    totalOpportunities: number;
    newOpportunities: number;
    updatedOpportunities: number;
    unchangedOpportunities: number;
  };
  recommendations: string[];
  notes: string[];
}
