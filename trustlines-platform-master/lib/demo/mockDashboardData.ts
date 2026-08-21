
export const REGIONS = ['TLINES_NE', 'TLINES_SE', 'TLINES_NW', 'CVW', 'TLINES_HQ'] as const;
export type RegionKey = typeof REGIONS[number];

export const SERVICES = ['STORE_MAKER', 'DESIGN_BUILD', 'PREMIUM_STORE_FITOUT'] as const;
export type ServiceLine = typeof SERVICES[number];

export const REGION_LABEL: Record<RegionKey, string> = {
  TLINES_NE: 'Northeast (NE)',
  TLINES_SE: 'Southeast (SE)',
  TLINES_NW: 'Northwest (NW)',
  CVW:       'CVW',
  TLINES_HQ: 'Headquarters (HQ)',

};

export const SERVICE_LABEL: Record<ServiceLine, string> = {
  STORE_MAKER:          'Store Maker',
  DESIGN_BUILD:         'Design Build',
  PREMIUM_STORE_FITOUT: 'Premium Store Fitout',
};

export function regionFromParam(v: string | null | undefined): RegionKey {
  const s = (v ?? '').trim().toUpperCase();
  const direct = REGIONS.find(r => r === s);
  if (direct) return direct;
  const short: Record<string, RegionKey> = {
    NE: 'TLINES_NE', SE: 'TLINES_SE', NW: 'TLINES_NW', CVW: 'CVW', HQ: 'TLINES_HQ',
  };
  return short[s] ?? 'TLINES_SE';
}

export function serviceFromParam(v: string | null | undefined): ServiceLine {
  const s = (v ?? '').trim().toUpperCase();
  return (SERVICES as readonly string[]).includes(s) ? (s as ServiceLine) : 'PREMIUM_STORE_FITOUT';
}

export interface DashboardKpi {
  total_opportunities: number;
  total_opportunity_value: number;
  in_discussion_count: number;
  proposal_sent_count: number;
  signed_won_count: number;
  closed_value: number;
  stagnant_count: number;
  inactive_30d_count: number;
  inactive_60d_count: number;
  avg_deal_size: number;
  conversion_rate: number;
  new_this_week: number;
  awaiting_followup: number;
  documents_signed: number;
  boq_in_progress: number;
}

export interface StagnantOpp {
  name: string;
  status: 'In Discussion' | 'Proposal Sent';
  days_in_stage: number;
  value: number;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const ri = (min: number, max: number) => Math.round(rand(min, max));
const clampMin = (n: number) => (n < 0 ? 0 : n);

export function seedKpi(region: RegionKey, service: ServiceLine): DashboardKpi {
  const base = hash(region + service);
  const inDisc   = ri(9 + base * 12, 22 + base * 12);
  const propSent = ri(3, 9);
  const signed   = ri(2, 8);
  const total    = inDisc + propSent + signed;
  const inDiscVal = inDisc   * ri(60_000, 90_000);
  const propVal   = propSent * ri(70_000, 110_000);
  const closedVal = signed   * ri(90_000, 180_000);
  const totalVal  = inDiscVal + propVal + closedVal;
  return {
    total_opportunities:     total,
    total_opportunity_value: totalVal,
    in_discussion_count:     inDisc,
    proposal_sent_count:     propSent,
    signed_won_count:        signed,
    closed_value:            closedVal,
    stagnant_count:          ri(2, 7),
    inactive_30d_count:      ri(1, 5),
    inactive_60d_count:      ri(0, 3),
    avg_deal_size:           total ? Math.round(totalVal / total) : 0,
    conversion_rate:         total ? signed / total : 0,
    new_this_week:           ri(1, 8),
    awaiting_followup:       ri(3, 12),
    documents_signed:        signed,
    boq_in_progress:         ri(2, 7),
  };
}

export interface TickResult {
  kpi: DashboardKpi;
  signedDeal: boolean;
  worsened: boolean;
}

export function tickKpi(prev: DashboardKpi): TickResult {
  const k: DashboardKpi = { ...prev };
  let signedDeal = false;

  if (Math.random() < 0.4) {
    k.total_opportunities += 1;
    k.in_discussion_count += 1;
    k.new_this_week += 1;
    k.total_opportunity_value += ri(60_000, 90_000);
  }
  if (Math.random() < 0.3 && k.in_discussion_count > 0) {
    k.in_discussion_count -= 1;
    k.proposal_sent_count += 1;
  }
  if (Math.random() < 0.15) {
    signedDeal = true;
    k.signed_won_count += 1;
    k.documents_signed += 1;
    if (k.proposal_sent_count > 0) k.proposal_sent_count -= 1;
    k.closed_value += ri(90_000, 180_000);
  }

  const stagBefore = k.stagnant_count + k.inactive_30d_count + k.inactive_60d_count;
  if (Math.random() < 0.4) k.stagnant_count     = clampMin(k.stagnant_count     + (Math.random() < 0.55 ? 1 : -1));
  if (Math.random() < 0.3) k.inactive_30d_count = clampMin(k.inactive_30d_count + (Math.random() < 0.55 ? 1 : -1));
  if (Math.random() < 0.2) k.inactive_60d_count = clampMin(k.inactive_60d_count + (Math.random() < 0.55 ? 1 : -1));
  const stagAfter = k.stagnant_count + k.inactive_30d_count + k.inactive_60d_count;

  k.awaiting_followup = clampMin(k.awaiting_followup + ri(-1, 1));
  k.boq_in_progress   = clampMin(k.boq_in_progress + (Math.random() < 0.3 ? (Math.random() < 0.5 ? 1 : -1) : 0));
  k.avg_deal_size     = k.total_opportunities ? Math.round(k.total_opportunity_value / k.total_opportunities) : 0;
  k.conversion_rate   = k.total_opportunities ? k.signed_won_count / k.total_opportunities : 0;

  return { kpi: k, signedDeal, worsened: stagAfter > stagBefore };
}

const STAGNANT_NAMES = [
  'Sunset Plaza Retail', 'Bayview Mall Kiosk', 'Ocean Walk Store', 'City Center Shop',
  'Lakeside Outlet', 'Harbor Point Café', 'Grand Avenue Boutique', 'Maple Court Market',
];

export function makeStagnant(region: RegionKey, service: ServiceLine, n = 5): StagnantOpp[] {
  const offset = Math.floor(hash(region + service) * STAGNANT_NAMES.length);
  const out: StagnantOpp[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      name:          STAGNANT_NAMES[(i + offset) % STAGNANT_NAMES.length],
      status:        Math.random() < 0.6 ? 'In Discussion' : 'Proposal Sent',
      days_in_stage: ri(31, 95),
      value:         ri(80_000, 160_000),
    });
  }
  return out.sort((a, b) => b.days_in_stage - a.days_in_stage);
}

export function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${Math.round(v / 1_000)}K`;
  return `$${v}`;
}
export function fmtMoneyFull(v: number): string {
  return `$${Math.round(v).toLocaleString('en-US')}`;
}
