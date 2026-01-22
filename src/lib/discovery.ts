import api from './api';

export interface DiscoveryStats {
  totalFundersInSource: number;
  newFunders: number;
  existingFunders: number;
  totalOpportunities: number;
  newOpportunities: number;
  updatedOpportunities: number;
  unchangedOpportunities: number;
}

export interface DiscoveryMetadata {
  runDate: string;
  sourceId: string;
  sourceName: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'failed';
  error?: string;
}

export interface DiscoveryRunResult {
  message: string;
  runDate: string;
  sourceId: string;
  stats: DiscoveryStats;
  metadata: DiscoveryMetadata;
  recommendations: string[];
}

export interface IntegrationResult {
  success: boolean;
  fundersCreated: number;
  opportunitiesCreated: number;
  opportunitiesScored: number;
  warnings: string[];
  dryRun: boolean;
}

export interface IntegrateRunResponse {
  message: string;
  result: IntegrationResult;
}

export const discoveryApi = {
  runCatalogue: async (params?: { sourceId?: string; runDate?: string }): Promise<DiscoveryRunResult> => {
    const response = await api.post('/discovery/runs/catalogue', params || {});
    return response.data;
  },

  getSummary: async (runDate: string): Promise<any> => {
    const response = await api.get(`/discovery/runs/${runDate}/summary`);
    return response.data;
  },

  integrateRun: async (runDate: string, dryRun = false): Promise<IntegrateRunResponse> => {
    const response = await api.post(`/discovery/runs/${runDate}/integrate`, { dryRun });
    return response.data;
  },
};
