import { MantineColorsTuple } from '@mantine/core';

export const theme = {
  colors: {
    // Odyssean Institute Brand Colors (Extracted from Logo Assets)
    odyssean: ['#1e3a5f', '#1e3a5f', '#2874A6', '#3498DB', '#5DADE2', '#85C1E2', '#AED6F1', '#D6EAF8', '#EBF5FB', '#F8F9FA'] as MantineColorsTuple,
    grain: ['#0c3a29', '#0c3a29', '#27AE60', '#7D8A2E', '#87A96B', '#ABEBC6', '#D5F4E6', '#E8F8F5', '#F1FBF9', '#F8FEF9'] as MantineColorsTuple,
    authority: ['#1e3a5f', '#1e3a5f', '#2874A6', '#2C3E50', '#34495E', '#5D6D7E', '#85929E', '#AEB6BF', '#D5D8DC', '#EAEDED'] as MantineColorsTuple,
    flourishing: ['#0c3a29', '#0c3a29', '#27AE60', '#7D8A2E', '#229954', '#1E8449', '#52BE80', '#76D7C4', '#A9DFBF', '#D5F4E6'] as MantineColorsTuple,
    strategic: ['#2874A6', '#2874A6', '#3498DB', '#5DADE2', '#1B4F72', '#154360', '#1A5276', '#21618C', '#2874A6', '#3498DB'] as MantineColorsTuple,
    neutral: ['#95A5A6', '#95A5A6', '#BDC3C7', '#D5DBDB', '#E5E7E9', '#F8F9FA', '#FDFEFE', '#F8F9FA', '#F4F6F7', '#F0F3F4'] as MantineColorsTuple,
    // Include default Mantine colors to satisfy type requirements
    dark: ['#d1d5db', '#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937', '#111827', '#030712', '#020617', '#030712'] as MantineColorsTuple,
    gray: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'] as MantineColorsTuple,
    red: ['#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'] as MantineColorsTuple,
    orange: ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12'] as MantineColorsTuple,
    yellow: ['#fefce8', '#fef9c3', '#fef08a', '#fde047', '#facc15', '#eab308', '#ca8a04', '#92400e', '#713f12', '#422006'] as MantineColorsTuple,
    lime: ['#f7fee7', '#ecfccb', '#d9f99d', '#bef264', '#a3e635', '#84cc16', '#65a30d', '#4d7c0f', '#365314', '#1a2e05'] as MantineColorsTuple,
    green: ['#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d'] as MantineColorsTuple,
    emerald: ['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#022c22'] as MantineColorsTuple,
    teal: ['#f0fdfa', '#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#115e59', '#134e4a'] as MantineColorsTuple,
    cyan: ['#ecfeff', '#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63'] as MantineColorsTuple,
    sky: ['#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e'] as MantineColorsTuple,
    blue: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a'] as MantineColorsTuple,
    indigo: ['#eef2ff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81'] as MantineColorsTuple,
    violet: ['#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95'] as MantineColorsTuple,
    purple: ['#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#7c3aed', '#6b21a8', '#581c87'] as MantineColorsTuple,
    fuchsia: ['#fdf4ff', '#fae8ff', '#f5d0fe', '#f0abfc', '#e879f9', '#d946ef', '#c026d3', '#a21caf', '#86198f', '#701a75'] as MantineColorsTuple,
    pink: ['#fdf2f8', '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d', '#9d174d', '#831843'] as MantineColorsTuple,
    rose: ['#fff1f2', '#ffe4e6', '#fecdd3', '#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239', '#881337'] as MantineColorsTuple,
    grape: ['#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#7c3aed', '#6b21a8', '#581c87'] as MantineColorsTuple,
  },
  fontFamily: 'Inter, system-ui, sans-serif',
  fontFamilyMonospace: 'JetBrains Mono, monospace',
  primaryColor: 'odyssean',
  defaultRadius: 'md',
};

export default theme;
