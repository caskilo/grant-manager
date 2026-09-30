import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export interface OrgBranding {
  primaryColour: string;
  secondaryColour: string;
  accentColour: string;
  primaryLogoUrl: string;
  name: string;
}

interface ApiOrgResponse {
  settings: {
    primaryColour?: string;
    secondaryColour?: string;
    accentColour?: string;
    primaryLogoUrl?: string;
    name?: string;
  };
}

const DEFAULT_BRANDING: OrgBranding = {
  primaryColour: '#2874A6',
  secondaryColour: '#1e3a5f',
  accentColour: '#5DADE2',
  primaryLogoUrl: '',
  name: 'Odyssean',
};

const DEFAULT_FAVICON = `${import.meta.env.BASE_URL}favicon.ico`;

/**
 * Fetches organisation branding settings for use in AppHeader, AppNavbar, etc.
 * Falls back to defaults when the API call fails (e.g. non-admin users on
 * endpoints that might restrict access).
 */
export function useOrgBranding() {
  const { data } = useQuery({
    queryKey: ['org-branding'],
    queryFn: async () => {
      const res = await api.get<ApiOrgResponse>('/organisation');
      const s = res.data.settings;
      return {
        primaryColour: s.primaryColour || DEFAULT_BRANDING.primaryColour,
        secondaryColour: s.secondaryColour || DEFAULT_BRANDING.secondaryColour,
        accentColour: s.accentColour || DEFAULT_BRANDING.accentColour,
        primaryLogoUrl: s.primaryLogoUrl || '',
        name: s.name || DEFAULT_BRANDING.name,
      } as OrgBranding;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const branding = data ?? DEFAULT_BRANDING;

  // Reflect the org logo in the browser tab icon (falls back to favicon.ico)
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link) link.href = branding.primaryLogoUrl || DEFAULT_FAVICON;
  }, [branding.primaryLogoUrl]);

  return branding;
}

/**
 * Darken a hex colour by a given percentage (0-1).
 * Used to derive gradient endpoints from the primary brand colour.
 */
export function darkenHex(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const factor = 1 - amount;
  const dr = Math.round(r * factor);
  const dg = Math.round(g * factor);
  const db = Math.round(b * factor);
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}
