import { REGIONS } from '@/lib/regions';
import { loadClientOpportunities } from '@/lib/keyClients/server';
import { projectNumber } from '@/lib/keyClients/match';
import { classifyTrustProject, loadTrustProjects } from '@/lib/trust/board';
import type { StageSpell } from './stageSpell';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Dashboard stage history (board_stage_spells, migration 157). Every day the cron records which
// board step each card is in; the dashboard's From / To + step filter reads it back to list the
// cards that were in a step during a period, not only the ones in it today.

/** Installation plan rows that count as "Installation" on the board (else Completed / not yet). */
export const INSTALLING_STATUSES = ['In Progress', 'Delayed', 'On Hold'];
export function isInstalling(i: { status: string | null; planned_start: string | null }, today: string): boolean {
  return i.status !== 'Completed'
    && (INSTALLING_STATUSES.includes(i.status ?? '') || (!!i.planned_start && i.planned_start <= today));
}

export interface StageEntry { itemKey: string; stage: string; region: string | null; projectNo: string | null }

const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => utcDay(new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000));

/**
 * Where every card is today — the same rules as the board (components/platform/dashboard/
 * BranchBoardPage): Trust System projects by classifyTrustProject, key clients' deals / leads,
 * delivered projects without an install yet, and the installation plan. Every region.
 */
export async function currentStageEntries(admin: any, today = utcDay()): Promise<{ entries: StageEntry[]; trustError: string | null }> {
  const [trust, opps, installs, delivered] = await Promise.all([
    loadTrustProjects(),
    loadClientOpportunities(admin, { includeLeads: true }).catch(() => ({ regions: {} as Record<string, any[]> })),
    admin.from('installations').select('id, project_no, branch, planned_start, status').limit(5000)
      .then((r: { data: any[] | null }) => r.data ?? []),
    admin.from('projects').select('id, code, region').eq('current_stage', 'delivered')
      .is('deleted_at', null).neq('is_archived', true).eq('is_draft', false).limit(5000)
      .then((r: { data: any[] | null }) => r.data ?? []),
  ]);
  const entries: StageEntry[] = [];

  for (const p of trust.projects) {
    entries.push({ itemKey: `trust:${p.id}`, stage: classifyTrustProject(p, today).stage, region: p.bucket, projectNo: projectNumber(p.projectNo) });
  }
  for (const o of Object.values(opps.regions).flat() as { id: string; region: string | null; projectNo: string | null; isClient: boolean }[]) {
    if (!o.region || (!o.projectNo && o.isClient)) continue;   // same cut as the board
    entries.push({ itemKey: `opportunity:${o.id}`, stage: o.isClient ? 'opportunity' : 'leads', region: o.region, projectNo: o.projectNo });
  }
  const regionOfBranch = new Map(REGIONS.map(r => [r.dropboxShort, r.code]));
  const installNos = new Map<string, Set<string>>();   // region → project numbers with an install on the board
  for (const i of installs as { id: string; project_no: string | null; branch: string | null; planned_start: string | null; status: string | null }[]) {
    const region = i.branch ? regionOfBranch.get(i.branch) : undefined;
    if (!region || !i.project_no) continue;
    const stage = i.status === 'Completed' ? 'completed' : isInstalling(i, today) ? 'installation' : null;
    if (!stage) continue;
    const no = projectNumber(i.project_no.replace(/^#+\s*/, ''));
    if (no) installNos.set(region, (installNos.get(region) ?? new Set()).add(no));
    entries.push({ itemKey: `trust:${i.id}`, stage, region, projectNo: no });
  }
  for (const p of delivered as { id: string; code: string; region: string | null }[]) {
    const no = projectNumber(p.code);
    if (!p.region || (no && installNos.get(p.region)?.has(no))) continue;
    entries.push({ itemKey: `project:${p.id}`, stage: 'ready', region: p.region, projectNo: no });
  }
  return { entries, trustError: trust.error };
}

/**
 * Record today's steps. A card still in the step it was in at the last run (up to 3 days ago, so
 * one missed run doesn't split a spell) extends that spell to today; otherwise a new spell starts.
 * Idempotent within a day.
 */
export async function recordStageSnapshot(admin: any, today = utcDay()): Promise<{ extended: number; started: number; cards: number; trustError: string | null }> {
  const { entries, trustError } = await currentStageEntries(admin, today);
  // A card missing today (e.g. the Trust System couldn't be read) just isn't extended; its spell
  // carries on if it's back within 3 days.
  const open = new Map<string, string>();   // "key|stage" → spell id
  const since = addDays(today, -3);
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('board_stage_spells').select('id, item_key, stage')
      .gte('last_day', since).order('id').range(from, from + 999);
    if (error) throw new Error(`board_stage_spells: ${error.message}`);
    for (const r of (data ?? []) as { id: string; item_key: string; stage: string }[]) open.set(`${r.item_key}|${r.stage}`, r.id);
    if (!data || data.length < 1000) break;
  }
  const seen = new Set<string>();
  const extendIds: string[] = [];
  const inserts: Record<string, unknown>[] = [];
  for (const e of entries) {
    const k = `${e.itemKey}|${e.stage}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const id = open.get(k);
    if (id) extendIds.push(id);
    else inserts.push({ item_key: e.itemKey, stage: e.stage, region: e.region, project_no: e.projectNo, first_day: today, last_day: today });
  }
  for (let i = 0; i < extendIds.length; i += 200) {
    const { error } = await admin.from('board_stage_spells').update({ last_day: today }).in('id', extendIds.slice(i, i + 200));
    if (error) throw new Error(`board_stage_spells update: ${error.message}`);
  }
  for (let i = 0; i < inserts.length; i += 500) {
    const { error } = await admin.from('board_stage_spells').insert(inserts.slice(i, i + 500));
    if (error) throw new Error(`board_stage_spells insert: ${error.message}`);
  }
  return { extended: extendIds.length, started: inserts.length, cards: seen.size, trustError };
}

/**
 * Spells of the last ~13 months, by card key — for the dashboard's step + date filter. Empty when
 * migration 157 isn't applied or nothing was recorded yet.
 */
export async function loadStageSpells(admin: any, today = utcDay()): Promise<Record<string, StageSpell[]>> {
  const out: Record<string, StageSpell[]> = {};
  const since = addDays(today, -400);
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await admin.from('board_stage_spells').select('item_key, stage, first_day, last_day')
      .gte('last_day', since).order('first_day').range(from, from + 999);
    if (error) { console.error('[dashboard] stage history unavailable (migration 157?):', error.message); return out; }
    for (const r of (data ?? []) as { item_key: string; stage: string; first_day: string; last_day: string }[]) {
      (out[r.item_key] ??= []).push({ stage: r.stage, from: r.first_day, to: r.last_day });
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}
