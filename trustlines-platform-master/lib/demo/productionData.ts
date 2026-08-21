
import { REGIONS4, SERVICES, type Region4, type ServiceLine } from './execData';
export { REGIONS4, SERVICES };
export type { Region4, ServiceLine };

export const TYPES = ['Millwork', 'Shelving', 'Ceiling', 'Image'] as const;
export type ProdType = typeof TYPES[number];

export const STATUSES = ['not_started', 'ordered', 'in_production', 'qc', 'packing', 'sent'] as const;
export type ProdStatus = typeof STATUSES[number];
export const STATUS_LABEL: Record<ProdStatus, string> = {
  not_started: 'Not started', ordered: 'Ordered', in_production: 'In production',
  qc: 'Quality check', packing: 'Packing', sent: 'Sent to T-Lines',
};

export type ViewerRole = 'trust' | 'tlines';

export interface TypeLine {
  type: ProdType;
  status: ProdStatus;
  vendorAssigned: boolean;
  poSigned: boolean;
  pfSigned: boolean | null;
  targetDate: string;
  isDelayed: boolean;
  delayDays: number;
  poValue: number;
  pfCost: number | null;
}

export interface ProdProject {
  code: string;
  name: string;
  region: Region4;
  service: ServiceLine;
  types: TypeLine[];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}
const STATUS_WEIGHT: Record<ProdStatus, number> = { not_started: 0.22, ordered: 0.18, in_production: 0.28, qc: 0.12, packing: 0.1, sent: 0.1 };
function pickStatus(h: number): ProdStatus {
  let acc = 0;
  for (const s of STATUSES) { acc += STATUS_WEIGHT[s]; if (h < acc) return s; }
  return 'sent';
}

const TYPE_BASE_VALUE: Record<ProdType, number> = { Millwork: 42_000, Shelving: 19_000, Ceiling: 27_000, Image: 8_500 };
const SERVICE_SCALE: Record<ServiceLine, number> = { STORE_MAKER: 0.85, DESIGN_BUILD: 1.05, PREMIUM_STORE_FITOUT: 1.55 };

const REGION_CITIES: Record<Region4, [string, string][]> = {
  NE: [['Milford', 'CT'], ['Hartford', 'CT'], ['Portland', 'ME'], ['Albany', 'NY'], ['Providence', 'RI']],
  SE: [['Atlanta', 'GA'], ['Charlotte', 'NC'], ['Orlando', 'FL'], ['Nashville', 'TN'], ['Columbia', 'SC']],
  NW: [['Seattle', 'WA'], ['Portland', 'OR'], ['Boise', 'ID'], ['Spokane', 'WA'], ['Eugene', 'OR']],
  West: [['Sacramento', 'CA'], ['Las Vegas', 'NV'], ['Phoenix', 'AZ'], ['San Diego', 'CA'], ['Reno', 'NV']],
};

const TODAY = new Date('2026-07-20');
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (base: Date, n: number) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };

const SERVICE_SHORT: Record<ServiceLine, string> = { STORE_MAKER: 'ST', PREMIUM_STORE_FITOUT: 'PS', DESIGN_BUILD: 'DS' };
const REGION_SHORT: Record<Region4, string> = { NE: 'NE', SE: 'SE', NW: 'NW', West: 'W' };
function projectCode(key: string, region: Region4, service: ServiceLine, h: number): string {
  const num = 100 + Math.floor(h * 899);
  return `${SERVICE_SHORT[service]}${REGION_SHORT[region]} ${num}`;
}

export function projectsFor(region: Region4, service: ServiceLine): ProdProject[] {
  const out: ProdProject[] = [];
  for (let i = 0; i < 3; i++) {
    const key = `${region}|${service}|${i}`;
    const h = hash(key);
    const cities = REGION_CITIES[region];
    const [city, state] = cities[Math.floor(h * cities.length + i * 3) % cities.length];
    const numTypes = 2 + Math.floor(h * 3);
    const types: TypeLine[] = [];
    for (let j = 0; j < numTypes; j++) {
      const th = hash(key + '|' + j);
      const status = pickStatus(th);
      const vendorAssigned = status !== 'not_started' || th > 0.5;
      const poSigned = status === 'not_started' ? th > 0.7 : true;
      const pfSigned = vendorAssigned && (status === 'in_production' || status === 'qc' || status === 'packing' || status === 'sent') && th > 0.25;
      const offsetDays = Math.round((th - 0.5) * 60);
      const target = addDays(TODAY, offsetDays);
      const isDelayed = status !== 'sent' && target < TODAY;
      const delayDays = isDelayed ? Math.round((TODAY.getTime() - target.getTime()) / 86_400_000) : 0;
      const type = TYPES[j % TYPES.length];
      const poValue = Math.round(TYPE_BASE_VALUE[type] * SERVICE_SCALE[service] * (0.82 + th * 0.36));
      const pfCost = pfSigned ? Math.round(poValue * (0.62 + hash(key + '|' + j + '|cost') * 0.2)) : null;
      types.push({
        type, status, vendorAssigned, poSigned,
        pfSigned, targetDate: iso(target), isDelayed, delayDays, poValue, pfCost,
      });
    }
    out.push({
      code: projectCode(key, region, service, h),
      name: `${city} - ${state}`,
      region, service, types,
    });
  }
  return out;
}

export function projectsForRegion(region: Region4): ProdProject[] {
  return SERVICES.flatMap(s => projectsFor(region, s));
}
export function projectsForCompany(service: ServiceLine): ProdProject[] {
  return REGIONS4.flatMap(r => projectsFor(r, service));
}
export function allProjects(): ProdProject[] {
  return REGIONS4.flatMap(r => projectsForRegion(r));
}

export interface ProdTotals {
  projects: number;
  typeLines: number;
  notStarted: number;
  inProduction: number;
  sent: number;
  delayed: number;
  poSigned: number;
  poPending: number;
  pfSigned: number;
  pfPending: number;
  vendorMissing: number;
}

export function aggregateProduction(projects: ProdProject[]): ProdTotals {
  const lines = projects.flatMap(p => p.types);
  return {
    projects: projects.length,
    typeLines: lines.length,
    notStarted: lines.filter(l => l.status === 'not_started').length,
    inProduction: lines.filter(l => ['ordered', 'in_production', 'qc', 'packing'].includes(l.status)).length,
    sent: lines.filter(l => l.status === 'sent').length,
    delayed: lines.filter(l => l.isDelayed).length,
    poSigned: lines.filter(l => l.poSigned).length,
    poPending: lines.filter(l => !l.poSigned).length,
    pfSigned: lines.filter(l => l.pfSigned === true).length,
    pfPending: lines.filter(l => l.vendorAssigned && l.pfSigned === false).length,
    vendorMissing: lines.filter(l => !l.vendorAssigned).length,
  };
}

export function byType(projects: ProdProject[]): { type: ProdType; total: number; inProduction: number; delayed: number }[] {
  return TYPES.map(type => {
    const lines = projects.flatMap(p => p.types).filter(l => l.type === type);
    return {
      type, total: lines.length,
      inProduction: lines.filter(l => ['ordered', 'in_production', 'qc', 'packing'].includes(l.status)).length,
      delayed: lines.filter(l => l.isDelayed).length,
    };
  });
}

export function forRole(projects: ProdProject[], role: ViewerRole): ProdProject[] {
  if (role === 'trust') return projects;
  return projects.map(p => ({ ...p, types: p.types.map(t => ({ ...t, pfSigned: null, pfCost: null })) }));
}

export interface Financials {
  poRevenue: number;
  pfCost: number;
  margin: number;
  marginPct: number;
  costedLines: number;
}
export function financials(projects: ProdProject[]): Financials {
  const lines = projects.flatMap(p => p.types);
  const poRevenue = lines.reduce((s, l) => s + l.poValue, 0);
  const costed = lines.filter(l => l.pfCost != null);
  const pfCost = costed.reduce((s, l) => s + (l.pfCost ?? 0), 0);
  const margin = poRevenue - pfCost;
  return { poRevenue, pfCost, margin, marginPct: poRevenue > 0 ? margin / poRevenue : 0, costedLines: costed.length };
}

export function financialsByType(projects: ProdProject[]): { type: ProdType; f: Financials }[] {
  return TYPES.map(type => ({ type, f: financials(projects.filter(p => p.types.some(t => t.type === type)).map(p => ({ ...p, types: p.types.filter(t => t.type === type) }))) }));
}

export function financialsByCompany(projectsAllServices: ProdProject[]): { service: ServiceLine; f: Financials }[] {
  return SERVICES.map(service => ({ service, f: financials(projectsAllServices.filter(p => p.service === service)) }));
}
