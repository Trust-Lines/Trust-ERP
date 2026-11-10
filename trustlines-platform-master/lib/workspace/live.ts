// The PM workspace / Projects / Management rows, read from where the work actually happens.
//
// The portfolio engine (portfolio.ts → projectLifecycle.ts) works a project's phase out of this
// app's own records — handover, production_items, approvals. The projects imported on
// 2026-10-30 never went through that flow here: no handover, and their production_items were
// seeded once (all NOT_ORDERED) and never touched, because production is run in the Trust
// System. So every one of them read "Closed Deal · Blocked: No handover record yet".
//
// This overlays the live sources on each row, matched by project number ("STNE 409" = Trust 409):
//   • phase   — the Trust System's stage (same rules as the T-Lines PM board, lib/trust/board),
//               then the installation plan (started → Delivery & Build, all done → Completed)
//   • blockers— the internal-flow ones that only make sense for projects run in this app are
//               dropped; kept: open approvals / change requests / site / customer acceptance
//               (live here); added: a Trust type on hold, installation overdue / not started
//   • dates   — the installation's planned start / finish (Upcoming deadlines, Next milestone)
//   • people  — who the board (board_assignees) and the installation plan name, for "my projects"
// Projects the Trust System doesn't know keep the engine's own reading.

import { classifyTrustProject, loadTrustProjects, HOLD, typeLabel, type TrustProject, type TrustStage } from '@/lib/trust/board';
import { alertOf, isClosed, type Installation } from '@/lib/installations/compute';
import { projectNumber } from '@/lib/keyClients/match';
import { PHASE_LABELS, type LifecyclePhase } from '@/lib/lifecycle/projectLifecycle';
import type { PortfolioRow } from './rows';

// Trust stage → the workspace's phase (drives its KPI cards: Finalizing / Supply & Approvals /
// In Production) and the label shown — the board's own section names, so both pages agree.
const TRUST_TO_PHASE: Record<TrustStage, LifecyclePhase> = {
  finalization: 'PM_FINALIZATION',
  technical: 'SUPPLY_DEVELOPMENT',
  to_production: 'SUPPLY_DEVELOPMENT',
  in_production: 'PRODUCTION_LOGISTICS',
  shipped: 'DELIVERY_BUILD',
};
const TRUST_LABEL: Record<TrustStage, string> = {
  finalization: 'Finalization',
  technical: 'Technical / PO + PF',
  to_production: 'To Production',
  in_production: 'Production In Progress',
  shipped: 'Shipped',
};
/** Blockers this app keeps live for every project (not part of the internal hand-off flow). */
const LIVE_HERE = new Set(['open_change_requests', 'approvals_pending', 'site_not_ready', 'customer_not_accepted']);

/**
 * The key a project is matched to its Trust project by. The app's code carries a region prefix
 * ("STNW 408 MARKET"), the Trust number doesn't ("408  MARKET"), and several Trust numbers aren't
 * just digits ("408 MARKET" / "408 EXPRESS", "13P", "EX-5") — so the digits alone can't tell them
 * apart or find them at all. Drop the 4-letter region prefix, upper-case, and fold spaces/hyphens:
 * "STNW 408 MARKET" → "408 MARKET", "EX-5" → "EX 5".
 */
export function liveKey(code: string | null | undefined): string | null {
  const t = String(code ?? '').toUpperCase().trim().split(/\s+/).filter(Boolean);
  if (t.length > 1 && /^[A-Z]{4}$/.test(t[0])) t.shift();
  const k = t.join(' ').replace(/[\s_-]+/g, ' ').trim();
  return k || null;
}

/** The Trust key for a project code: exact key first, else its number when only one Trust project has it. */
export function trustKeyFor(code: string | null | undefined, trustByNo: Map<string, unknown>): string | null {
  const k = liveKey(code);
  if (!k) return null;
  if (trustByNo.has(k)) return k;
  const no = projectNumber(k);
  if (!no) return null;
  const same = [...trustByNo.keys()].filter(t => projectNumber(t) === no);
  return same.length === 1 ? same[0] : null;
}

export interface LiveContext {
  /** Keyed by liveKey() of the Trust project number. */
  trustByNo: Map<string, TrustProject>;
  installsByNo: Map<string, Installation[]>;
  /** project number → user ids named on it (board Trust PM / T-Lines PM). */
  peopleByNo: Map<string, Set<string>>;
  /** project number → installation PM names ("MORRY"). */
  installPmByNo: Map<string, Set<string>>;
  trustError: string | null;
}

/** Everything the overlay needs, in one go. Never throws — a source that can't be read is skipped. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadLiveContext(admin: any): Promise<LiveContext> {
  const [trust, installsRes, assignRes] = await Promise.all([
    loadTrustProjects({ includeDone: true }),
    admin.from('installations').select('*'),
    admin.from('board_assignees').select('item_kind, item_id, user_id'),
  ]);
  const trustByNo = new Map<string, TrustProject>();
  for (const p of trust.projects) {
    const k = liveKey(p.projectNo);
    if (k && !p.deletedAt && !trustByNo.has(k)) trustByNo.set(k, p);
  }

  const installsByNo = new Map<string, Installation[]>();
  const installPmByNo = new Map<string, Set<string>>();
  for (const r of ((installsRes?.error ? [] : installsRes?.data) ?? []) as Installation[]) {
    const no = projectNumber(r.project_no);
    if (!no) continue;
    installsByNo.set(no, [...(installsByNo.get(no) ?? []), r]);
    if (r.pm_name?.trim()) installPmByNo.set(no, (installPmByNo.get(no) ?? new Set()).add(r.pm_name.trim().toLowerCase()));
  }

  // Board picks are keyed by the Trust project's id → map back to its key.
  const noByTrustId = new Map([...trustByNo.entries()].map(([k, p]) => [p.id, k]));
  const peopleByNo = new Map<string, Set<string>>();
  for (const a of ((assignRes?.error ? [] : assignRes?.data) ?? []) as { item_kind: string; item_id: string; user_id: string }[]) {
    const no = a.item_kind === 'trust' ? noByTrustId.get(a.item_id) : undefined;
    if (no) peopleByNo.set(no, (peopleByNo.get(no) ?? new Set()).add(a.user_id));
  }
  return { trustByNo, installsByNo, peopleByNo, installPmByNo, trustError: trust.error };
}

/** Rows with their live phase, blockers and dates. */
export function withLiveStatus(rows: PortfolioRow[], ctx: LiveContext, today = new Date().toISOString().slice(0, 10)): PortfolioRow[] {
  return rows.map(r => {
    const no = projectNumber(r.code);
    const tk = trustKeyFor(r.code, ctx.trustByNo);
    const trust = tk ? ctx.trustByNo.get(tk) : undefined;
    const installs = no ? ctx.installsByNo.get(no) ?? [] : [];
    if (!trust && !installs.length) return r;

    // Phase: Trust first, then the installation plan moves it on.
    let phase = r.phase as LifecyclePhase;
    let phaseLabel = r.phaseLabel;
    let onHoldTypes: string[] = [];
    if (trust) {
      const entry = classifyTrustProject(trust, today);
      phase = trust.status === 'DONE' ? 'COMPLETED' : TRUST_TO_PHASE[entry.stage];
      phaseLabel = trust.status === 'DONE' ? PHASE_LABELS.COMPLETED : TRUST_LABEL[entry.stage];
      onHoldTypes = [...new Set((trust.items ?? []).filter(i => i.status && HOLD.has(i.status)).map(i => typeLabel(i.type) ?? 'A type'))];
    }
    if (installs.length) {
      if (installs.every(isClosed)) { phase = 'COMPLETED'; phaseLabel = PHASE_LABELS.COMPLETED; }
      else if (installs.some(i => i.status === 'In Progress' || (i.planned_start && i.planned_start <= today))) {
        phase = 'DELIVERY_BUILD'; phaseLabel = 'Installation';
      }
    }

    // Blockers: only what's live.
    const keep = (code: string) => LIVE_HERE.has(code);
    const blockers = r.blockers.filter(b => keep(b.code));
    if (onHoldTypes.length) blockers.push({ code: 'items_on_hold', message: `${onHoldTypes.join(', ')} on hold (Trust)` });
    for (const i of installs) {
      const a = alertOf(i, today);
      if (a && a.tone !== 'blue') blockers.push({ code: 'installation', message: `Installation ${i.project_no ?? ''}: ${a.text}`.replace(/\s+/g, ' ') });
    }
    const myActions = r.myActions.filter(a => keep(a.code));

    // Dates: the installation plan's start / finish.
    const deadlines = installs
      .filter(i => !isClosed(i))
      .flatMap(i => [
        i.planned_start ? { type: 'Installation', stage: `${i.project_no ?? ''} starts`.trim(), targetDate: i.planned_start, isOverdue: false } : null,
        i.planned_finish ? { type: 'Installation', stage: `${i.project_no ?? ''} finish`.trim(), targetDate: i.planned_finish, isOverdue: i.planned_finish < today } : null,
      ])
      .filter((d): d is NonNullable<typeof d> => !!d && (d.targetDate >= today || d.isOverdue))
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate));

    // The engine's own deadlines come from the never-updated production_items, so they're replaced.
    return { ...r, phase, phaseLabel, blockers, myActions, deadlines };
  });
}

/** Is this person on the project, by the live sources (board picks, installation PM name)? */
export function isOnProject(code: string | null, userId: string, userName: string | null, ctx: LiveContext): boolean {
  const tk = trustKeyFor(code, ctx.trustByNo) ?? liveKey(code);
  if (tk && ctx.peopleByNo.get(tk)?.has(userId)) return true;
  const no = projectNumber(code);
  const name = userName?.trim().toLowerCase();
  if (!no || !name) return false;
  const first = name.split(/\s+/)[0];
  return [...(ctx.installPmByNo.get(no) ?? [])].some(pm => pm === name || pm === first);
}
