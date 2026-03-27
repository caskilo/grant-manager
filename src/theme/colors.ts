// Odyssean Institute Brand Colors
export const BRAND_COLORS = {
  // Primary brand colors (extracted from logo assets)
  odyssean: '#1e3a5f', // Core blue from logo text
  grain: '#0c3a29',    // GRAIN green from brand assets
  white: '#FFFFFF',    // Pure white
  
  // Extended palette derived from brand colors
  strategic: '#2874A6', // Medium blue
  flourishing: '#27AE60', // Light green
  neutral: '#95A5A6', // Neutral gray
  authority: '#2C3E50', // Dark gray for text
} as const;

// Color families for Mantine theme
export const COLOR_FAMILIES = {
  odyssean: ['#1e3a5f', '#2874A6', '#3498DB', '#5DADE2', '#85C1E2'],
  grain: ['#0c3a29', '#27AE60', '#7D8A2E', '#87A96B', '#ABEBC6'],
  authority: ['#1e3a5f', '#2874A6', '#2C3E50', '#34495E', '#17202A'],
  flourishing: ['#0c3a29', '#27AE60', '#7D8A2E', '#229954', '#1E8449'],
  strategic: ['#2874A6', '#3498DB', '#5DADE2', '#1B4F72', '#154360'],
  neutral: ['#95A5A6', '#BDC3C7', '#D5DBDB', '#E5E7E9', '#F8F9FA'],
} as const;

// Semantic color mappings
export const SEMANTIC_COLORS = {
  primary: 'odyssean',
  success: 'grain',
  warning: 'strategic',
  error: 'authority',
  info: 'odyssean',
} as const;

export default BRAND_COLORS;
