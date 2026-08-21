export const INDUSTRY_OPTIONS = ['Premium Store Fitout', 'Store Maker', 'Design & Build', 'Other'] as const;
export type Industry = typeof INDUSTRY_OPTIONS[number];

export const INDUSTRY_COLOR: Record<Industry, string> = {
  'Store Maker': '#FF4081',
  'Premium Store Fitout': '#7C4DFF',
  'Design & Build': '#b6b6ff',
  Other: '#9e9e9e',
};

export function normalizeIndustry(raw: string | null | undefined): Industry | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith('store maker')) return 'Store Maker';
  if (s.includes('premuim') || s.includes('premium')) return 'Premium Store Fitout';
  if (s.includes('design') && s.includes('build')) return 'Design & Build';
  return 'Other';
}
