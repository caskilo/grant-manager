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

export interface CatalogueDatabase {
  version: string;
  lastModified: string;
  funders: CatalogueEntry[];
}

export const FUNDER_TYPES = [
  'Foundation',
  'Trust',
  'Public Research Funder',
  'Innovation Foundation',
  'Learned Society',
  'Lottery Fund',
  'Philanthropic Network',
  'Family Foundation',
  'Charitable Organization',
  'Research Council',
  'Government Agency',
  'Private Funder',
  'Other',
];

export const CURRENCIES = ['GBP', 'USD', 'EUR'];

export const OPEN_DATA_OPTIONS = ['Yes', 'Partial', 'No'];

export const COMMON_GEOGRAPHIES = [
  'UK',
  'US',
  'EU',
  'Global',
  'Europe',
  'North America',
  'Asia',
  'Africa',
  'Latin America',
  'Oceania',
  'International',
];

export const COMMON_FOCUS_AREAS = [
  'Research',
  'Science',
  'Arts',
  'Education',
  'Social Justice',
  'Environment',
  'Health',
  'Innovation',
  'Technology',
  'Community',
  'Heritage',
  'Policy',
  'Climate',
  'Biomedical Research',
  'Humanities',
  'Engineering',
  'Natural Sciences',
  'Social Sciences',
];
