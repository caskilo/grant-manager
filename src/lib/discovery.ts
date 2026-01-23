import api from './api';

export interface CatalogueEntry {
  id: string;
  name: string;
  type: string;
  websiteUrl: string;
  description?: string;
  geographies?: string[];
  focusAreas?: string[];
  currency?: string;
  openData?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogueResponse {
  data: CatalogueEntry[];
  meta: {
    total: number;
  };
}

export interface IntegrationResult {
  success: boolean;
  fundersCreated: number;
  opportunitiesCreated: number;
  opportunitiesScored: number;
  warnings: string[];
  dryRun: boolean;
}

export const discoveryApi = {
  // Get all catalogue entries
  getCatalogue: async (): Promise<CatalogueResponse> => {
    const response = await api.get('/catalogue');
    return response.data;
  },

  // Run catalogue discovery and integration (import catalogue entries as funders)
  runCatalogue: async (): Promise<IntegrationResult> => {
    // Step 1: Run discovery
    const runResponse = await api.post('/discovery/runs/catalogue', {});
    const runDate = runResponse.data.runDate;
    
    // Step 2: Integrate the run immediately
    const integrateResponse = await api.post(`/discovery/runs/${runDate}/integrate`, { dryRun: false });
    return integrateResponse.data.result;
  },

  // Import catalogue entry from HTML
  importFromHtml: async (html: string): Promise<CatalogueEntry> => {
    const response = await api.post('/catalogue/import', { html });
    return response.data;
  },

  // Scrape URL to create catalogue entry
  scrapeUrl: async (url: string): Promise<CatalogueEntry> => {
    const response = await api.post('/catalogue/scrape', { url });
    return response.data;
  },

  // CRUD operations for catalogue
  createEntry: async (entry: Partial<CatalogueEntry>): Promise<CatalogueEntry> => {
    const response = await api.post('/catalogue', entry);
    return response.data;
  },

  updateEntry: async (id: string, entry: Partial<CatalogueEntry>): Promise<CatalogueEntry> => {
    const response = await api.patch(`/catalogue/${id}`, entry);
    return response.data;
  },

  deleteEntry: async (id: string): Promise<void> => {
    await api.delete(`/catalogue/${id}`);
  },

  getEnums: async (): Promise<any> => {
    const response = await api.get('/catalogue/enums');
    return response.data;
  },
};
