
import { SERVICES, SERVICE_LABEL, type ServiceLine } from './mockDashboardData';

export { SERVICES, SERVICE_LABEL };
export type { ServiceLine };

export const REGIONS4 = ['NE', 'SE', 'NW', 'West'] as const;
export type Region4 = typeof REGIONS4[number];
export const REGION4_LABEL: Record<Region4, string> = {
  NE: 'North East', SE: 'South East', NW: 'North West', West: 'West',
};

export const PIPELINE = [
  { key: 'lead',         label: 'Lead' },
  { key: 'opportunity',  label: 'Opportunity' },
  { key: 'design',       label: 'Design' },
  { key: 'estimate',     label: 'Estimate' },
  { key: 'contract',     label: 'Contract' },
  { key: 'closed',       label: 'Closed Deal' },
  { key: 'production',   label: 'Production' },
  { key: 'installation', label: 'Installation' },
] as const;
export type StageKey = typeof PIPELINE[number]['key'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

const REGION_SIZE: Record<Region4, number>   = { SE: 1.28, NE: 1.02, West: 0.9,  NW: 0.72 };
const REGION_GROWTH: Record<Region4, number> = { West: 0.44, SE: 0.31, NE: 0.2,  NW: 0.12 };
const SERVICE_VOLUME: Record<ServiceLine, number>  = { STORE_MAKER: 1.35, DESIGN_BUILD: 1.0,  PREMIUM_STORE_FITOUT: 0.72 };
const SERVICE_AVGDEAL: Record<ServiceLine, number> = { STORE_MAKER: 48_000, DESIGN_BUILD: 96_000, PREMIUM_STORE_FITOUT: 178_000 };

export interface Cell {
  region: Region4;
  service: ServiceLine;
  funnel: Record<StageKey, number>;
  opportunities: number;
  working: number;
  won: number;
  lost: number;
  winRate: number;
  activeJobs: number;
  revenueYTD: number;
  revenueLY: number;
  yoy: number;
  avgDeal: number;
  pipelineValue: number;
}

export function cell(region: Region4, service: ServiceLine): Cell {
  const h = hash(region + '|' + service);
  const size = REGION_SIZE[region] * SERVICE_VOLUME[service];

  const leads = Math.round((70 + h * 46) * size);
  const opportunity = Math.round(leads * (0.60 + h * 0.06));
  const design      = Math.round(opportunity * (0.72 + h * 0.05));
  const estimate    = Math.round(design * (0.74 + h * 0.05));
  const contract    = Math.round(estimate * (0.66 + h * 0.05));
  const closed      = Math.round(contract * (0.70 + h * 0.05));
  const production  = Math.round(closed * (0.62 + h * 0.06));
  const installation = Math.round(production * (0.5 + h * 0.08));

  const working = opportunity + design + estimate + contract;
  const won = Math.round(leads * (0.19 + h * 0.05));
  const lost = Math.round(won * (0.9 + h * 0.5));
  const avgDeal = Math.round(SERVICE_AVGDEAL[service] * (0.9 + h * 0.24));
  const revenueYTD = won * avgDeal;
  const revenueLY = Math.round(revenueYTD / (1 + REGION_GROWTH[region] * (0.85 + h * 0.3)));
  const activeJobs = production + installation;
  const pipelineValue = Math.round(working * avgDeal * 0.55);

  return {
    region, service,
    funnel: { lead: leads, opportunity, design, estimate, contract, closed, production, installation },
    opportunities: leads,
    working, won, lost,
    winRate: won + lost > 0 ? won / (won + lost) : 0,
    activeJobs, revenueYTD, revenueLY,
    yoy: revenueLY > 0 ? (revenueYTD - revenueLY) / revenueLY : 0,
    avgDeal, pipelineValue,
  };
}

const ZERO_FUNNEL = (): Record<StageKey, number> =>
  Object.fromEntries(PIPELINE.map(s => [s.key, 0])) as Record<StageKey, number>;

export function aggregate(cells: Cell[]): Omit<Cell, 'region' | 'service'> {
  const funnel = ZERO_FUNNEL();
  let opportunities = 0, working = 0, won = 0, lost = 0, activeJobs = 0,
      revenueYTD = 0, revenueLY = 0, pipelineValue = 0;
  for (const c of cells) {
    for (const s of PIPELINE) funnel[s.key] += c.funnel[s.key];
    opportunities += c.opportunities; working += c.working; won += c.won; lost += c.lost;
    activeJobs += c.activeJobs; revenueYTD += c.revenueYTD; revenueLY += c.revenueLY;
    pipelineValue += c.pipelineValue;
  }
  return {
    funnel, opportunities, working, won, lost,
    winRate: won + lost > 0 ? won / (won + lost) : 0,
    activeJobs, revenueYTD, revenueLY,
    yoy: revenueLY > 0 ? (revenueYTD - revenueLY) / revenueLY : 0,
    avgDeal: won > 0 ? Math.round(revenueYTD / won) : 0,
    pipelineValue,
  };
}

export type Scope = { region: Region4 | 'ALL'; service: ServiceLine | 'ALL' };

export function cellsFor(scope: Scope): Cell[] {
  const regions = scope.region === 'ALL' ? [...REGIONS4] : [scope.region];
  const services = scope.service === 'ALL' ? [...SERVICES] : [scope.service];
  const out: Cell[] = [];
  for (const r of regions) for (const s of services) out.push(cell(r, s));
  return out;
}

export function scopeTotals(scope: Scope) { return aggregate(cellsFor(scope)); }

export function serviceAcrossRegions(service: ServiceLine): Cell[] {
  return REGIONS4.map(r => cell(r, service));
}

export function servicesInRegion(region: Region4): Cell[] {
  return SERVICES.map(s => cell(region, s));
}

export function weakest(cells: Cell[]): Cell | null {
  if (cells.length === 0) return null;
  return [...cells].sort((a, b) => a.winRate - b.winRate || a.yoy - b.yoy)[0];
}
export function strongest(cells: Cell[]): Cell | null {
  if (cells.length === 0) return null;
  return [...cells].sort((a, b) => b.revenueYTD - a.revenueYTD)[0];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'] as const;
const SHAPE_CUR = [0.115, 0.128, 0.14, 0.15, 0.145, 0.163, 0.159];
const SHAPE_LY  = [0.12, 0.128, 0.142, 0.15, 0.155, 0.152, 0.153];

export function monthlySeries(scope: Scope): { months: readonly string[]; cur: number[]; prev: number[] } {
  const t = scopeTotals(scope);
  return {
    months: MONTHS,
    cur:  SHAPE_CUR.map(f => Math.round(t.revenueYTD * f)),
    prev: SHAPE_LY.map(f => Math.round(t.revenueLY * f)),
  };
}

export function fmtM(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v}`;
}
export const fmtPct = (v: number) => `${Math.round(v * 100)}%`;
export const fmtSignedPct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
