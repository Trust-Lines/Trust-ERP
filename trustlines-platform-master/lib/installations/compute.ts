// Installation plan — every number the old workbook calculated with formulas (Dashboard, alerts,
// Suggested Status, Installer Double-Booking, Monthly tabs, Team Allocation), from the rows of
// public.installations (migration 142). Pure functions of (rows, today) — shared by the page and
// its tests; nothing here is stored.

export const BRANCHES = ['NE', 'SE', 'NW', 'CVW'] as const;
export type Branch = (typeof BRANCHES)[number];
export const STATUSES = ['Not Started', 'In Progress', 'Completed', 'Delayed', 'On Hold'] as const;
export type InstallStatus = (typeof STATUSES)[number];
export const CONFIDENCES = ['Confirmed', 'Tentative', 'On Hold'] as const;
export type Confidence = (typeof CONFIDENCES)[number];
export const SCOPES = ['STORE MAKER', 'PREMIUM FIT OUT', 'DESIGN AND BUILD'] as const;

export interface Installation {
  id: string;
  project_no: string | null;
  project_name: string | null;
  branch: Branch | null;
  city_state: string | null;
  planned_start: string | null;   // yyyy-mm-dd
  planned_finish: string | null;
  /** The saved team (install_teams, migration 143); `team` / `team_size` are its snapshot, or
   *  what was typed for a crew that isn't a saved team. */
  team_id?: string | null;
  team: string | null;
  team_size: number | null;
  scope: string | null;
  pm_name: string | null;
  confidence: Confidence | null;
  status: InstallStatus | null;
  blockers: string | null;
  notes: string | null;
  sort_order: number;
  updated_at: string;
}

/** Fields a person edits in the register (everything else is the app's). */
export const EDITABLE_FIELDS = [
  'project_no', 'project_name', 'branch', 'city_state', 'planned_start', 'planned_finish', 'team_id', 'team',
  'team_size', 'scope', 'pm_name', 'confidence', 'status', 'blockers', 'notes',
] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];
export type RowPatch = Partial<Record<EditableField, string | number | null>>;

/** An installation team (install_teams, migration 143). */
export interface InstallTeam {
  id: string;
  name: string;
  branch: Branch | null;
  members: string[];
  /** Head count for a crew with no named members. */
  size: number | null;
  notes: string | null;
  active: boolean;
  sort_order: number;
}

/** "TEAM B (Terrence, Robert)" — how a team reads in the register (and its text snapshot). */
export const teamLabel = (t: Pick<InstallTeam, 'name' | 'members'>) =>
  t.members.length ? `${t.name} (${t.members.join(', ')})` : t.name;
export const teamHeadcount = (t: Pick<InstallTeam, 'members' | 'size'>) => t.members.length || Math.max(0, t.size ?? 0);

/** Rows with their saved team read live from the team (so editing a team updates every row). */
export function resolveTeams(rows: Installation[], teams: InstallTeam[]): Installation[] {
  const byId = new Map(teams.map(t => [t.id, t]));
  return rows.map(r => {
    const t = r.team_id ? byId.get(r.team_id) : undefined;
    return t ? { ...r, team: teamLabel(t), team_size: teamHeadcount(t) } : r;
  });
}

// ── dates (all yyyy-mm-dd strings, compared as UTC days) ─────────────────────────────────────
const DAY = 86_400_000;
const toMs = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const daysBetween = (from: string, to: string) => Math.round((toMs(to) - toMs(from)) / DAY);
export const addDays = (iso: string, n: number) => new Date(toMs(iso) + n * DAY).toISOString().slice(0, 10);
export const monthKey = (iso: string) => iso.slice(0, 7);   // "2026-11"
export function monthLabel(key: string, short = false) {
  const d = new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, 1));
  return d.toLocaleDateString('en-US', { month: short ? 'short' : 'long', year: short ? '2-digit' : 'numeric', timeZone: 'UTC' });
}
export function fmtDate(iso: string | null) {
  if (!iso) return '';
  const d = new Date(toMs(iso));
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(/ /g, '-');
}
/** Every month from `from` to `to` inclusive ("2026-11" … "2027-12"). */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = +from.slice(0, 4), m = +from.slice(5, 7);
  const end = +to.slice(0, 4) * 12 + +to.slice(5, 7);
  while (y * 12 + m <= end) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

// ── team / installers ─────────────────────────────────────────────────────────────────────────
/** Installers named in a team: "TEAM B (Terrence, Robert)" → ["terrence", "robert"]. A team with
 *  no names in brackets is one unit ("team express em"). TBD / blank = nobody. */
export function installersOf(team: string | null): string[] {
  const t = (team ?? '').trim();
  if (!t || /^tbd$/i.test(t)) return [];
  const inside = t.match(/\(([^)]*)\)/);
  if (inside) {
    const names = inside[1].split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (names.length) return [...new Set(names)];
  }
  return [t.replace(/\s+/g, ' ').toLowerCase()];
}
/** Head count: the named installers when the team lists them, else the number typed in. */
export function headcount(r: Pick<Installation, 'team' | 'team_size'>): number {
  const t = (r.team ?? '').trim();
  const inside = t.match(/\(([^)]*)\)/);
  const named = inside ? inside[1].split(',').map(s => s.trim()).filter(Boolean).length : 0;
  return named || Math.max(0, r.team_size ?? 0);
}

// ── per-row automatic columns ─────────────────────────────────────────────────────────────────
export const isClosed = (r: Pick<Installation, 'status'>) => r.status === 'Completed';
export const isActive = (r: Pick<Installation, 'status'>) => r.status !== 'Completed' && r.status !== 'On Hold';

export function durationDays(r: Pick<Installation, 'planned_start' | 'planned_finish'>): number | null {
  if (!r.planned_start || !r.planned_finish) return null;
  return daysBetween(r.planned_start, r.planned_finish) + 1;
}

export type AlertTone = 'red' | 'amber' | 'blue';
export interface RowAlert { text: string; tone: AlertTone }

/** The workbook's "Alert (auto)" column. */
export function alertOf(r: Installation, today: string): RowAlert | null {
  if (isClosed(r)) return null;
  if (r.planned_start && !r.planned_finish) return { text: 'Missing finish date', tone: 'red' };
  if (r.planned_finish && r.planned_finish < today && r.status !== 'On Hold') return { text: 'Overdue - past finish date', tone: 'red' };
  if (r.planned_start && r.planned_start < today && (!r.status || r.status === 'Not Started')) return { text: 'Should have started', tone: 'amber' };
  if (r.planned_start && r.planned_start >= today) {
    const n = daysBetween(today, r.planned_start);
    if (n === 0) return { text: 'Starts today', tone: 'blue' };
    if (n <= 14) return { text: `Starts in ${n} day${n === 1 ? '' : 's'}`, tone: 'blue' };
  }
  return null;
}

/** The workbook's "Suggested Status (auto)": what the dates say the status should be. */
export function suggestedStatus(r: Installation, today: string): InstallStatus | null {
  if (r.status === 'Completed' || r.status === 'On Hold') return r.status;
  if (!r.planned_start) return null;
  if (r.planned_finish && r.planned_finish < today) return 'Delayed';
  if (r.planned_start > today) return 'Not Started';
  return 'In Progress';
}
/** Amber in the register: the entered status is blank or differs from the dates. */
export const statusNeedsUpdate = (r: Installation, today: string) => {
  const s = suggestedStatus(r, today);
  return s !== null && r.status !== s;
};

// ── installer double-booking ──────────────────────────────────────────────────────────────────
export interface Clash { id: string; projectNo: string; people: string[] }

/** For every active, dated row: the other active rows whose dates overlap it and that share an
 *  installer (or the whole team, when the team names nobody). */
export function doubleBookings(rows: Installation[]): Map<string, Clash[]> {
  const live = rows
    .filter(r => isActive(r) && r.planned_start)
    .map(r => ({ r, from: r.planned_start!, to: r.planned_finish ?? r.planned_start!, people: installersOf(r.team) }))
    .filter(x => x.people.length > 0);
  const out = new Map<string, Clash[]>();
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (a.from > b.to || b.from > a.to) continue;
      const shared = a.people.filter(p => b.people.includes(p));
      if (!shared.length) continue;
      const add = (x: typeof a, y: typeof a) => {
        const list = out.get(x.r.id) ?? [];
        list.push({ id: y.r.id, projectNo: y.r.project_no ?? '—', people: shared });
        out.set(x.r.id, list);
      };
      add(a, b); add(b, a);
    }
  }
  return out;
}

// ── dashboard ─────────────────────────────────────────────────────────────────────────────────
export interface DashboardStats {
  active: number;
  starting14: number;
  installingNow: number;
  needAttention: number;
  overdue: number;
  doubleBooked: number;
  statusesToUpdate: number;
  installersBooked14: number;
}

export function dashboardStats(rows: Installation[], today: string, clashes = doubleBookings(rows)): DashboardStats {
  const in14 = addDays(today, 14);
  const open = rows.filter(r => !isClosed(r));
  return {
    active: open.length,
    starting14: open.filter(r => r.planned_start && r.planned_start >= today && r.planned_start <= in14).length,
    installingNow: open.filter(r => r.planned_start && r.planned_start <= today && (!r.planned_finish || r.planned_finish >= today)).length,
    needAttention: rows.filter(r => alertOf(r, today)).length,
    overdue: open.filter(r => r.status !== 'On Hold' && r.planned_finish && r.planned_finish < today).length,
    doubleBooked: clashes.size,
    statusesToUpdate: rows.filter(r => statusNeedsUpdate(r, today)).length,
    // Installer slots on jobs that run at any point in the next 14 days.
    installersBooked14: open
      .filter(r => r.planned_start && r.planned_start <= in14 && (r.planned_finish ?? r.planned_start) >= today)
      .reduce((n, r) => n + headcount(r), 0),
  };
}

export const byStart = (a: Installation, b: Installation) =>
  (a.planned_start ?? '9999').localeCompare(b.planned_start ?? '9999') || a.sort_order - b.sort_order;

/** Rows with an alert, by start date (the dashboard's "Needs attention"). */
export const needsAttention = (rows: Installation[], today: string) =>
  rows.filter(r => alertOf(r, today)).sort(byStart);

/** Open rows starting today … today + days. */
export const startingWithin = (rows: Installation[], today: string, days: number) => {
  const end = addDays(today, days);
  return rows.filter(r => !isClosed(r) && r.planned_start && r.planned_start >= today && r.planned_start <= end).sort(byStart);
};

export interface CountRow { key: string; projects: number; installers: number }

/** Projects + installer slots per branch / per PM (dashboard side tables). */
export function countBy(rows: Installation[], key: (r: Installation) => string | null, keys?: readonly string[]): CountRow[] {
  const map = new Map<string, CountRow>((keys ?? []).map(k => [k, { key: k, projects: 0, installers: 0 }]));
  for (const r of rows) {
    if (isClosed(r)) continue;
    const k = key(r) ?? 'Unassigned';
    const row = map.get(k) ?? { key: k, projects: 0, installers: 0 };
    row.projects += 1;
    row.installers += headcount(r);
    map.set(k, row);
  }
  return [...map.values()];
}

/** Entered status vs what the dates suggest (dashboard "By status"). */
export function statusTable(rows: Installation[], today: string) {
  return STATUSES.map(s => ({
    status: s,
    entered: rows.filter(r => r.status === s).length,
    suggested: rows.filter(r => suggestedStatus(r, today) === s).length,
  }));
}

// ── months (Monthly Overview, Team Allocation, charts) ────────────────────────────────────────
export interface MonthRow {
  month: string;
  starting: number;
  confirmed: number;
  tentative: number;
  inProgress: number;
  completed: number;
  assignments: number;
  byBranch: Record<Branch, number>;
}

/** Counted in the month the installation starts (as the workbook did). */
export function monthRows(rows: Installation[], months: string[]): MonthRow[] {
  return months.map(month => {
    const inMonth = rows.filter(r => r.planned_start && monthKey(r.planned_start) === month);
    const byBranch = Object.fromEntries(BRANCHES.map(b => [b, 0])) as Record<Branch, number>;
    for (const r of inMonth) if (r.branch) byBranch[r.branch] += headcount(r);
    return {
      month,
      starting: inMonth.length,
      confirmed: inMonth.filter(r => r.confidence === 'Confirmed').length,
      tentative: inMonth.filter(r => r.confidence === 'Tentative').length,
      inProgress: inMonth.filter(r => r.status === 'In Progress').length,
      completed: inMonth.filter(r => r.status === 'Completed').length,
      assignments: inMonth.reduce((n, r) => n + headcount(r), 0),
      byBranch,
    };
  });
}

/** The plan's month range: Nov 2026 – Dec 2027, widened to cover every dated row. */
export function planMonths(rows: Installation[], from = '2026-11', to = '2027-12'): string[] {
  let lo = from, hi = to;
  for (const r of rows) {
    if (r.planned_start && monthKey(r.planned_start) < lo) lo = monthKey(r.planned_start);
    const end = r.planned_finish ?? r.planned_start;
    if (end && monthKey(end) > hi) hi = monthKey(end);
  }
  return monthsBetween(`${lo}-01`, `${hi}-01`);
}

/** Gantt columns: Sundays from the week holding `from` through `to` ("Wk of 01-Nov"). */
export function weekStarts(from: string, to: string): string[] {
  const d = new Date(toMs(from));
  let cur = addDays(from, -d.getUTCDay());
  const out: string[] = [];
  while (cur <= to) { out.push(cur); cur = addDays(cur, 7); }
  return out;
}
