
export interface RegionDef {
  code: string;
  label: string;
  dropboxShort: string;
  codeShort: string;
}

export const REGIONS: RegionDef[] = [
  { code: 'TLINES_NE', label: 'T-Lines North East', dropboxShort: 'NE',  codeShort: 'NE' },
  { code: 'TLINES_SE', label: 'T-Lines South East', dropboxShort: 'SE',  codeShort: 'SE' },
  { code: 'TLINES_NW', label: 'T-Lines North West', dropboxShort: 'NW',  codeShort: 'NW' },
  { code: 'CVW',       label: 'West',                dropboxShort: 'CVW', codeShort: 'W'  },
];

export const REGION_CODES = REGIONS.map(r => r.code);

export function dropboxRegionFolder(code?: string | null): string {
  const r = REGIONS.find(x => x.code === code);
  return r ? `T Lines ${r.dropboxShort} Projects` : '';
}

export function regionLabel(code?: string | null): string {
  return REGIONS.find(x => x.code === code)?.label ?? (code ?? '');
}

export interface ServiceLineDef {
  value: string;
  label: string;
  dropboxSection: string;
  codeShort: string;
}

export const SERVICE_LINES: ServiceLineDef[] = [
  { value: 'store_maker',          label: 'Store Maker',          dropboxSection: '1-Store Maker',          codeShort: 'ST' },
  { value: 'premium_store_fitout', label: 'Premium Store Fitout', dropboxSection: '2-Premium Store Fitout', codeShort: 'PS' },
  { value: 'design_build',         label: 'Design Build',         dropboxSection: '3-Design & Build',        codeShort: 'DS' },
];

export const SERVICE_LINE_VALUES = SERVICE_LINES.map(s => s.value);

export function dropboxSectionForServiceLine(value?: string | null): string {
  return SERVICE_LINES.find(x => x.value === value)?.dropboxSection ?? '';
}

/** Our company from ClickUp's "Industry" text ("Store Maker", "Design & Build", "Premuim Store Fitout" — sic). */
export function serviceLineFromIndustry(industry?: string | null): string | null {
  const n = (industry ?? '').trim().toLowerCase();
  if (!n) return null;
  if (n.includes('store maker')) return 'store_maker';
  if (n.includes('design')) return 'design_build';
  if (n.includes('fitout') || n.includes('premium') || n.includes('premuim')) return 'premium_store_fitout';
  return null;
}

/** Our company for a project / deal code: its prefix ("STSE507" → store_maker), else null. */
export function serviceLineFromCode(code?: string | null): string | null {
  const c = (code ?? '').trim().toUpperCase();
  return SERVICE_LINES.find(s => c.startsWith(s.codeShort))?.value ?? null;
}

export function serviceLineLabel(value?: string | null): string {
  return SERVICE_LINES.find(x => x.value === value)?.label ?? (value ?? '');
}

export function composeProjectCode(serviceLine?: string | null, region?: string | null, num?: number | null): string {
  const s = SERVICE_LINES.find(x => x.value === serviceLine)?.codeShort ?? '';
  const r = REGIONS.find(x => x.code === region)?.codeShort ?? '';
  const prefix = `${s}${r}`;
  return num != null ? `${prefix} ${num}` : prefix;
}
