import api from './api';

export interface HarvestSource {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  cronSchedule: string;
  config: any;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  funderId: string | null;
}

export interface CreateHarvestSourceDto {
  name: string;
  baseUrl: string;
  enabled?: boolean;
  cronSchedule?: string;
  config?: any;
  funderId?: string;
}

export interface TriggerHarvestResponse {
  message: string;
  jobId: string;
  source: {
    id: string;
    name: string;
  };
}

export interface SuggestedSource {
  url: string;
  title?: string;
  anchorText?: string;
  score: number;
  discoveredAt: string;
  pageTitle?: string;
  keywords: string[];
  grantData?: {
    programName?: string;
    deadline?: string;
    maxAward?: number;
    minAward?: number;
    currency?: string;
    eligibility?: string[];
    applicationInfo?: string[];
    keyDates?: Array<{ label: string; date: string }>;
  };
}

export interface DiscoverSourcesResponse {
  message: string;
  jobId: string;
  funder: {
    id: string;
    name: string;
  };
  manualLinksIncluded?: number;
}

export interface JobStatus {
  id: string;
  name: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress?: {
    phase: string;
    percent: number;
    currentUrl?: string;
  };
  failedReason?: string;
  data: any;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
}

export interface SuggestedSourcesResponse {
  sources: SuggestedSource[];
  lastDiscoveryAt: string | null;
  stats?: {
    totalLinksFound: number;
    linksScored: number;
    topSourcesReturned: number;
    manualLinksProvided?: number;
    manualLinksProcessed?: number;
    seedUrlProcessed?: boolean;
  };
  warnings?: string[];
}

export interface HarvestRun {
  runId: string;
  timestamp: string;
  sourceName: string;
  stats: {
    opportunitiesFound: number;
    newOpportunities: number;
    updatedOpportunities: number;
  };
}

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

export interface HarvestIntegrationResult {
  funderId: string;
  funderName: string;
  opportunitiesCreated: number;
  opportunitiesUpdated: number;
  opportunitiesScored: number;
  warnings: string[];
}

export const harvestApi = {
  getSources: async (params?: { funderId?: string; enabled?: boolean }): Promise<{ data: HarvestSource[] }> => {
    const response = await api.get('/harvest/sources', { params });
    return response.data;
  },

  getSource: async (id: string): Promise<HarvestSource> => {
    const response = await api.get(`/harvest/sources/${id}`);
    return response.data;
  },

  createSource: async (data: CreateHarvestSourceDto): Promise<HarvestSource> => {
    const response = await api.post('/harvest/sources', data);
    return response.data;
  },

  updateSource: async (id: string, data: Partial<CreateHarvestSourceDto>): Promise<HarvestSource> => {
    const response = await api.put(`/harvest/sources/${id}`, data);
    return response.data;
  },

  deleteSource: async (id: string): Promise<void> => {
    await api.delete(`/harvest/sources/${id}`);
  },

  triggerHarvest: async (id: string): Promise<TriggerHarvestResponse> => {
    const response = await api.post(`/harvest/sources/${id}/trigger`);
    return response.data;
  },

  discoverSources: async (funderId: string, manualLinks?: string[], searchDepth?: number): Promise<DiscoverSourcesResponse> => {
    const response = await api.post(`/harvest/funders/${funderId}/discover-sources`, {
      manualLinks,
      searchDepth,
    });
    return response.data;
  },

  getSuggestedSources: async (funderId: string): Promise<SuggestedSourcesResponse> => {
    const response = await api.get(`/harvest/funders/${funderId}/suggested-sources`);
    return response.data;
  },

  listRuns: async (funderId: string): Promise<HarvestRun[]> => {
    const response = await api.get(`/harvest/funders/${funderId}/runs`);
    return response.data;
  },

  getRunSummary: async (runId: string): Promise<HarvestRunSummary> => {
    const response = await api.get(`/harvest/runs/${runId}/summary`);
    return response.data;
  },

  integrateRun: async (runId: string, funderId: string, dryRun: boolean = false): Promise<HarvestIntegrationResult> => {
    const response = await api.post(`/harvest/runs/${runId}/integrate`, {
      funderId,
      dryRun,
    });
    return response.data;
  },

  getJobStatus: async (jobId: string): Promise<JobStatus> => {
    const response = await api.get(`/harvest/jobs/${jobId}/status`);
    return response.data;
  },
};
