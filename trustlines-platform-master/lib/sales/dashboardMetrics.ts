// The numbers behind the Sales dashboard. Pure functions (no I/O) so every figure is easy to check.
// lib/sales/dashboardData.ts loads the rows and calls these.
import type { Lead, OpportunityStatus } from '@/components/platform/leads/types';

// ── stage groups ────────────────────────────────────────────────────────────────────────────
/** The path an open deal walks, in order. `statuses[0]` is what the CRM board filters on. */
export const PATH_STAGES: { key: string; label: string; statuses: OpportunityStatus[] }[] = [
  { key: 'new', label: 'New', statuses: ['new_opportunity'] },
  { key: 'ready', label: 'Ready to start', statuses: ['ready_to_start'] },
  { key: 'working', label: 'Working on it Trust', statuses: ['working_on_it_trust'] },
  { key: 'proposal', label: 'Proposal sent', statuses: ['design_proposal_sent', 'contract_stage'] },
  { key: 'changes', label: 'Changes requested', statuses: ['modification_request'] },
];
export const WAITING_STATUSES: OpportunityStatus[] = ['waiting', 'waiting_from_op'];
export const POTENTIAL_STATUSES: OpportunityStatus[] = ['potential', 'in_target_list'];

const PATH_STATUS_SET = new Set(PATH_STAGES.flatMap(s => s.statuses));
const OPEN_SET = new Set<OpportunityStatus>([...PATH_STATUS_SET, ...WAITING_STATUSES]);

export const isOpen = (l: Pick<Lead, 'opportunity_status'>) => OPEN_SET.has(l.opportunity_status);
const money = (l: Pick<Lead, 'deal_size'>) => (typeof l.deal_size === 'number' && Number.isFinite(l.deal_size) ? l.deal_size : 0);

export interface StageBucket { key: string; label: string; crmStatus: OpportunityStatus; count: number; value: number }

export function pathBuckets(leads: Lead[]): StageBucket[] {
  return PATH_STAGES.map(s => {
    const rows = leads.filter(l => s.statuses.includes(l.opportunity_status));
    return { key: s.key, label: s.label, crmStatus: s.statuses[0], count: rows.length, value: rows.reduce((a, l) => a + money(l), 0) };
  });
}

export function waitingBucket(leads: Lead[]): { count: number; value: number } {
  const rows = leads.filter(l => WAITING_STATUSES.includes(l.opportunity_status));
  return { count: rows.length, value: rows.reduce((a, l) => a + money(l), 0) };
}

export function outcomes(leads: Lead[]) {
  const won = leads.filter(l => l.opportunity_status === 'deal_closed');
  const lost = leads.filter(l => l.opportunity_status === 'deal_missed');
  const decided = won.length + lost.length;
  return {
    won: won.length, lost: lost.length,
    wonValue: won.reduce((a, l) => a + money(l), 0), lostValue: lost.reduce((a, l) => a + money(l), 0),
    winRatePct: decided ? Math.round((won.length / decided) * 100) : null,
  };
}

// ── regions ─────────────────────────────────────────────────────────────────────────────────
export interface RegionRow {
  region: string; label: string; open: number; proposals: number; waiting: number;
  won: number; lost: number; wonValue: number; winRatePct: number | null;
}

export function regionRows(leads: Lead[], labelOf: (code: string) => string): RegionRow[] {
  const by = new Map<string, Lead[]>();
  for (const l of leads) {
    if (POTENTIAL_STATUSES.includes(l.opportunity_status)) continue; // not a deal yet
    const key = l.region || '__none__';
    if (!by.has(key)) by.set(key, []);
    by.get(key)!.push(l);
  }
  return [...by.entries()].map(([region, rows]) => {
    const o = outcomes(rows);
    return {
      region, label: region === '__none__' ? 'No region' : labelOf(region),
      open: rows.filter(isOpen).length,
      proposals: rows.filter(l => l.opportunity_status === 'design_proposal_sent' || l.opportunity_status === 'modification_request').length,
      waiting: rows.filter(l => WAITING_STATUSES.includes(l.opportunity_status)).length,
      won: o.won, lost: o.lost, wonValue: o.wonValue, winRatePct: o.winRatePct,
    };
  }).sort((a, b) => (b.open + b.won + b.lost) - (a.open + a.won + a.lost));
}

// ── closings: how many deals were won / lost in each quarter ────────────────────────────────────
// (Not "deals by creation date": ClickUp shows a whole region as created on the day it was migrated —
// 173 West deals on 2026-02-18 — so creation dates say nothing about when deals happened.)
export interface ClosedIn { won: boolean; closedAt: string | null; createdAt: string; imported: boolean }
export interface ClosingRow { key: string; label: string; won: number; lost: number; total: number; winRatePct: number | null }

export function quarterKey(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

/**
 * A close date only counts when it's real: the ClickUp import fell back to "now" for tasks with no
 * Date done, which lands within minutes of the row's own created_at — that isn't when the deal closed.
 */
export function hasRealCloseDate(r: ClosedIn): boolean {
  if (!r.closedAt || Number.isNaN(Date.parse(r.closedAt))) return false;
  if (r.imported && Math.abs(Date.parse(r.closedAt) - Date.parse(r.createdAt)) < 10 * 60_000) return false;
  return true;
}

/** Oldest → newest, every quarter between the first and last close (empty quarters included as zeros). */
export function closingsByQuarter(rows: ClosedIn[]): { rows: ClosingRow[]; undated: number } {
  const map = new Map<string, { won: number; lost: number }>();
  let undated = 0;
  for (const r of rows) {
    if (!hasRealCloseDate(r)) { undated += 1; continue; }
    const k = quarterKey(r.closedAt as string)!;
    const cur = map.get(k) ?? { won: 0, lost: 0 };
    if (r.won) cur.won += 1; else cur.lost += 1;
    map.set(k, cur);
  }
  const keys = [...map.keys()].sort();
  if (!keys.length) return { rows: [], undated };
  const [y0, q0] = [Number(keys[0].slice(0, 4)), Number(keys[0].slice(6))];
  const [y1, q1] = [Number(keys.at(-1)!.slice(0, 4)), Number(keys.at(-1)!.slice(6))];
  const out: ClosingRow[] = [];
  for (let y = y0, q = q0; y < y1 || (y === y1 && q <= q1); q === 4 ? (y += 1, q = 1) : (q += 1)) {
    const key = `${y}-Q${q}`;
    const c = map.get(key) ?? { won: 0, lost: 0 };
    const decided = c.won + c.lost;
    out.push({ key, label: `Q${q} ’${String(y).slice(2)}`, ...c, total: decided, winRatePct: decided ? Math.round((c.won / decided) * 100) : null });
  }
  return { rows: out, undated };
}

// ── deals that have gone quiet ──────────────────────────────────────────────────────────────
export interface SilentDeal {
  id: string; title: string; region: string | null; stageLabel: string; dealSize: number | null;
  daysSilent: number; lastAt: string; lastBy: string | null; lastSnippet: string | null;
}

export interface ActiveDealIn {
  id: string; title: string; region: string | null; stageLabel: string; dealSize: number | null;
  createdAt: string; // the deal's own date (ClickUp creation date when imported)
}
export interface ActivityIn { at: string; by: string | null; text: string | null }

const DAY = 86_400_000;

/**
 * For each active deal, when did anything last happen (a comment, a logged change, or — failing that —
 * the day it was created) and how long has it been quiet? Longest-quiet first.
 */
export function silentDeals(deals: ActiveDealIn[], activityByDeal: Map<string, ActivityIn[]>, now: Date): SilentDeal[] {
  const out: SilentDeal[] = [];
  for (const d of deals) {
    let lastAt = d.createdAt, lastBy: string | null = null, lastSnippet: string | null = null;
    for (const a of activityByDeal.get(d.id) ?? []) {
      if (Date.parse(a.at) > Date.parse(lastAt)) { lastAt = a.at; lastBy = a.by; lastSnippet = a.text; }
    }
    const t = Date.parse(lastAt);
    if (Number.isNaN(t)) continue;
    out.push({
      id: d.id, title: d.title, region: d.region, stageLabel: d.stageLabel, dealSize: d.dealSize,
      daysSilent: Math.max(0, Math.floor((now.getTime() - t) / DAY)), lastAt, lastBy,
      lastSnippet: lastSnippet ? lastSnippet.replace(/\s+/g, ' ').trim().slice(0, 110) : null,
    });
  }
  return out.sort((a, b) => b.daysSilent - a.daysSilent);
}
