import api from './api';

export interface ApplicationSection {
  id: string;
  applicationId: string;
  title: string;
  guidance: string | null;
  content: string;
  sortOrder: number;
  wordLimit: number | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DRAFT' | 'FINAL';
  aiSuggestion: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  title: string;
  opportunityId: string;
  leadOwnerId: string;
  stage: 'TRIAGE' | 'PREP' | 'DRAFTING' | 'REVIEW' | 'SUBMIT' | 'AWARDED' | 'REJECTED';
  outcome: 'UNKNOWN' | 'AWARDED' | 'REJECTED';
  expectedAwardAmount: number | null;
  expectedCurrency: string | null;
  awardAmount: number | null;
  awardCurrency: string | null;
  aiFitScoreSnapshot: number | null;
  aiFitReasonsSnapshot: string[];
  notes: string | null;
  generatedFrom: string | null;
  sourceContent: any;
  sectionSchema: any;
  createdAt: string;
  updatedAt: string;
  opportunity: {
    id: string;
    programName: string;
    sourceUrl: string;
    opportunityUrl: string | null;
    status: string;
    funder: {
      id: string;
      name: string;
      type: string;
      websiteUrl?: string | null;
    } | null;
  };
  leadOwner: {
    id: string;
    name: string;
    email: string;
  };
  sections: ApplicationSection[];
  _count?: {
    tasks: number;
    reviews: number;
    attachments: number;
    templateUsages: number;
    sections: number;
  };
}

export interface ApplicationProgress {
  applicationId: string;
  stage: string;
  sections: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
  };
  completionPercent: number;
}

export const applicationsApi = {
  list: (params?: {
    stage?: string;
    opportunityId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => api.get('/applications', { params }),

  get: (id: string) => api.get<Application>(`/applications/${id}`),

  getProgress: (id: string) => api.get<ApplicationProgress>(`/applications/${id}/progress`),

  create: (data: {
    opportunityId: string;
    title: string;
    stage?: string;
    notes?: string;
    sections?: Array<{
      title: string;
      guidance?: string;
      content?: string;
      sortOrder?: number;
      wordLimit?: number;
    }>;
  }) => api.post<Application>('/applications', data),

  generateFromOpportunity: (
    opportunityId: string,
    options?: {
      manualContent?: string;
      useDefaults?: boolean;
      pageContent?: string;
    },
  ) => api.post<Application>(`/applications/from-opportunity/${opportunityId}`, options || {}),

  update: (id: string, data: {
    title?: string;
    stage?: string;
    outcome?: string;
    notes?: string;
    expectedAwardAmount?: number;
    expectedCurrency?: string;
    leadOwnerId?: string;
    generatedFrom?: string;
  }) => api.patch<Application>(`/applications/${id}`, data),

  delete: (id: string) => api.delete(`/applications/${id}`),

  // Section endpoints
  addSection: (applicationId: string, data: {
    title: string;
    guidance?: string;
    content?: string;
    sortOrder?: number;
    wordLimit?: number;
  }) => api.post<ApplicationSection>(`/applications/${applicationId}/sections`, data),

  updateSection: (sectionId: string, data: {
    title?: string;
    guidance?: string;
    content?: string;
    sortOrder?: number;
    wordLimit?: number;
    status?: string;
    aiSuggestion?: string;
  }) => api.patch<ApplicationSection>(`/applications/sections/${sectionId}`, data),

  deleteSection: (sectionId: string) => api.delete(`/applications/sections/${sectionId}`),

  reorderSections: (applicationId: string, sectionIds: string[]) =>
    api.post(`/applications/${applicationId}/sections/reorder`, { sectionIds }),

  regenerateSections: (applicationId: string, options?: {
    manualContent?: string;
    pageContent?: string;
    llmProvider?: 'gemini' | 'anthropic';
    noFallback?: boolean;
    expectedSections?: number;
    keepExistingSections?: boolean;
    contextFiles?: Array<{ name: string; content: string }>;
  }) => api.post<Application>(`/applications/${applicationId}/regenerate`, options || {}),

  suggestSection: (sectionId: string, options?: { llmProvider?: 'gemini' | 'anthropic'; noFallback?: boolean }) =>
    api.post<{ suggestion: string }>(
      `/applications/sections/${sectionId}/suggest`,
      options || {},
    ),

  scrapePage: (url: string, waitForSelector?: string) =>
    api.post('/applications/scrape-page', { url, waitForSelector }),
};

export default applicationsApi;
