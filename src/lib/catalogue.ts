import api from './api';

export interface CatalogueEntry {
  id: string;
  name: string;
  description?: string;
  type: string;
  focus: string[];
  geographies: string[];
  websiteUrl: string;
  typicalAwardMin?: number;
  typicalAwardMax?: number;
  currency: string;
  openData: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCatalogueEntryDto {
  name: string;
  description?: string;
  type: string;
  focus: string[];
  geographies: string[];
  websiteUrl: string;
  typicalAwardMin?: number;
  typicalAwardMax?: number;
  currency: string;
  openData: string;
  notes: string;
}

export interface CatalogueEnums {
  funderTypes: string[];
  currencies: string[];
  openDataOptions: string[];
  commonGeographies: string[];
  commonFocusAreas: string[];
}

export const catalogueApi = {
  getAll: async () => {
    const response = await api.get<{ data: CatalogueEntry[]; meta: { total: number } }>('/catalogue');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get<CatalogueEntry>(`/catalogue/${id}`);
    return response.data;
  },

  create: async (entry: CreateCatalogueEntryDto) => {
    const response = await api.post<CatalogueEntry>('/catalogue', entry);
    return response.data;
  },

  update: async (id: string, entry: Partial<CreateCatalogueEntryDto>) => {
    const response = await api.patch<CatalogueEntry>(`/catalogue/${id}`, entry);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/catalogue/${id}`);
  },

  getEnums: async () => {
    const response = await api.get<CatalogueEnums>('/catalogue/enums');
    return response.data;
  },

  importFromHtml: async (html: string) => {
    const response = await api.post<{ imported: number; skipped: number }>('/catalogue/import', { html });
    return response.data;
  },
};
