'use client';

import * as React from 'react';
import { ArrowDownUp, FileSpreadsheet, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { Select as FilterSelect } from '@/components/ui/select';
import {
  BRANCHES, SCOPES, STATUSES, addDays, alertOf, doubleBookings, durationDays, fmtDate, headcount, isClosed,
  planMonths, resolveTeams, statusNeedsUpdate, suggestedStatus, type InstallTeam, type Installation, type RowPatch,
} from '@/lib/installations/compute';
import { HEADING } from './shared';
import { DashboardTab } from './DashboardTab';
import { ColumnsMenu, REGISTER_COLUMNS, REGISTER_SORTS, RegisterTab, type RegisterColumn, type RegisterSort } from './RegisterTab';
import { MonthlyTab } from './MonthlyTab';
import { GanttTab } from './GanttTab';
import { TeamsTab } from './TeamsTab';
import { TeamsManagerTab, type TeamDraft } from './TeamsManagerTab';
import { RowEditModal } from './RowEditModal';

type Tab = 'dashboard' | 'register' | 'monthly' | 'gantt' | 'teamsMgr' | 'teams';
const TABS: { key: Tab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'register', label: 'Project Register' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'gantt', label: 'Gantt Chart' },
  { key: 'teamsMgr', label: 'Teams' },
  { key: 'teams', label: 'Team Allocation' },
];
type Drill = 'attention' | 'overdue' | 'clash' | 'update' | 'soon' | 'now';
const DRILL_LABEL: Record<Drill, string> = {
  attention: 'Needs attention', overdue: 'Overdue', clash: 'Double-booked', update: 'Statuses to update',
  soon: 'Starting in 14 days', now: 'Installing now',
};
const TAB_KEY = 'tl_install_tab';
const DATE_CLS = 'h-9 w-auto gap-2 rounded-[6px] border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] font-medium leading-[1.35] text-[var(--color-secondary-700)] dark:rounded-[6px] dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg dark:px-3 dark:text-ui-heading';
const toISO = (d: Date | null) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;
const fromISO = (s: string | null) => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
/** "20 Oct 2026" */
const dayLabel = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
/** "OCT 2026" */
const shortMonth = (m: string) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
const SORT_KEY = 'tl_install_sort';
const COLS_KEY = 'tl_install_hidden_cols';
const FILTER_CLS = 'inline-flex h-9 w-auto shrink-0 cursor-pointer items-center gap-1 rounded-[6px] border border-solid border-[var(--ui-input-border)] bg-ui-input-bg pl-3 pr-2 text-[13px] font-medium leading-normal text-[var(--color-secondary-700)] dark:rounded-[6px] dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg dark:text-ui-heading [&_svg]:size-3.5';

export function InstallationClient({ initialRows, initialTeams, teamsSetupNeeded, setupNeeded, loadError, canEdit, projectByNo, today }: {
  initialRows: Installation[];
  initialTeams: InstallTeam[];
  /** install_teams missing (migration 143 not run yet). */
  teamsSetupNeeded: boolean;
  setupNeeded: boolean;
  loadError: string | null;
  canEdit: boolean;
  projectByNo: Record<string, string>;
  today: string;
}) {
  const [rawRows, setRows] = React.useState(initialRows);
  const [teams, setTeams] = React.useState(initialTeams);
  // Rows with their saved team read live from the team.
  const rows = React.useMemo(() => resolveTeams(rawRows, teams), [rawRows, teams]);
  const [editing, setEditing] = React.useState<Installation | 'new' | null>(null);
  const [tab, setTab] = React.useState<Tab>('dashboard');
  React.useEffect(() => {
    try { const t = localStorage.getItem(TAB_KEY) as Tab | null; if (t && TABS.some(x => x.key === t)) setTab(t); } catch { /* storage blocked */ }
  }, []);
  const go = (t: Tab) => { setTab(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* storage blocked */ } };

  // Filters — one set for every tab.
  const [q, setQ] = React.useState('');
  const [branch, setBranch] = React.useState('');
  const [pm, setPm] = React.useState('');
  const [scope, setScope] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [hideDone, setHideDone] = React.useState(false);
  // Date range (Figma 638:27272): rows whose planned dates overlap [from, to]. Picking a month
  // fills both ends with that month; editing a date by hand leaves "custom".
  const [month, setMonth] = React.useState('');
  const [from, setFrom] = React.useState<string | null>(null);
  const [to, setTo] = React.useState<string | null>(null);
  const pickMonth = (m: string) => {
    setMonth(m);
    if (!m) { setFrom(null); setTo(null); return; }
    setFrom(`${m}-01`);
    setTo(new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10));
  };
  const pickDate = (which: 'from' | 'to', v: string | null) => { (which === 'from' ? setFrom : setTo)(v); setMonth(''); };
  const [drill, setDrill] = React.useState<Drill | null>(null);
  // Register view options (Figma 629:5556): sort and visible columns, remembered per browser.
  const [sort, setSort] = React.useState<RegisterSort>('newest');
  const [hiddenCols, setHiddenCols] = React.useState<Set<RegisterColumn>>(new Set(['clash']));
  React.useEffect(() => {
    try {
      const s = localStorage.getItem(SORT_KEY) as RegisterSort | null;
      if (s && REGISTER_SORTS.some(x => x.value === s)) setSort(s);
      const h = localStorage.getItem(COLS_KEY);
      if (h) setHiddenCols(new Set(JSON.parse(h) as RegisterColumn[]));
    } catch { /* storage blocked */ }
  }, []);
  const pickSort = (v: RegisterSort) => { setSort(v); try { localStorage.setItem(SORT_KEY, v); } catch { /* storage blocked */ } };
  const toggleCol = (k: RegisterColumn) => setHiddenCols(prev => {
    const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k);
    try { localStorage.setItem(COLS_KEY, JSON.stringify([...n])); } catch { /* storage blocked */ }
    return n;
  });
  const setAllCols = (show: boolean) => {
    const n = new Set<RegisterColumn>(show ? [] : REGISTER_COLUMNS.filter(c => !('locked' in c)).map(c => c.key));
    setHiddenCols(n);
    try { localStorage.setItem(COLS_KEY, JSON.stringify([...n])); } catch { /* storage blocked */ }
  };

  const clashesAll = React.useMemo(() => doubleBookings(rows), [rows]);
  const pmNames = React.useMemo(() => [...new Set(rows.map(r => r.pm_name?.trim()).filter((x): x is string => !!x))].sort(), [rows]);
  const months = React.useMemo(() => planMonths(rows), [rows]);

  const visible = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const in14 = addDays(today, 14);
    return rows.filter(r => {
      if (needle && ![r.project_no, r.project_name, r.city_state, r.team, r.pm_name, r.notes, r.blockers].some(v => v?.toLowerCase().includes(needle))) return false;
      if (branch && r.branch !== branch) return false;
      if (pm && (pm === '__none' ? !!r.pm_name : r.pm_name !== pm)) return false;
      if (scope && (r.scope ?? '').toUpperCase() !== scope) return false;
      if (status && (status === '__none' ? !!r.status : r.status !== status)) return false;
      if (hideDone && isClosed(r)) return false;
      if (from || to) {
        const rs = r.planned_start, re = r.planned_finish ?? r.planned_start;
        if (!rs || !re) return false;
        if (from && re < from) return false;
        if (to && rs > to) return false;
      }
      switch (drill) {
        case 'attention': return !!alertOf(r, today);
        case 'overdue': return !isClosed(r) && r.status !== 'On Hold' && !!r.planned_finish && r.planned_finish < today;
        case 'clash': return clashesAll.has(r.id);
        case 'update': return statusNeedsUpdate(r, today);
        case 'soon': return !isClosed(r) && !!r.planned_start && r.planned_start >= today && r.planned_start <= in14;
        case 'now': return !isClosed(r) && !!r.planned_start && r.planned_start <= today && (!r.planned_finish || r.planned_finish >= today);
        default: return true;
      }
    });
  }, [rows, q, branch, pm, scope, status, hideDone, drill, today, clashesAll, from, to]);
  const filtered = visible.length !== rows.length;
  // Clashes are found across the whole plan (an installer is busy whatever the filter), but the
  // dashboard only lists / counts the rows on screen.
  const clashesVisible = React.useMemo(() => {
    const ids = new Set(visible.map(r => r.id));
    return new Map([...clashesAll].filter(([id]) => ids.has(id)));
  }, [visible, clashesAll]);

  // ── saving ──────────────────────────────────────────────────────────────────────────────────
  /** Saves cells of one row (shown at once, put back if the server says no). */
  const save = React.useCallback(async (id: string, patch: RowPatch): Promise<boolean> => {
    const before = rawRows.find(r => r.id === id);
    if (!before) return false;
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } as Installation : r)));
    try {
      const res = await fetch(`/api/installations/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? 'Could not save');
      setRows(rs => rs.map(r => (r.id === id ? { ...r, ...body.row } : r)));
      return true;
    } catch (e) {
      setRows(rs => rs.map(r => (r.id === id ? before : r)));
      toast.error(e instanceof Error ? e.message : 'Could not save');
      return false;
    }
  }, [rawRows]);

  /** A new row from the form. */
  const create = async (patch: RowPatch): Promise<boolean> => {
    try {
      const res = await fetch('/api/installations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? 'Could not add');
      setRows(rs => [...rs, body.row]);
      setDrill(null); setQ('');
      toast.success(`${body.row.project_no ?? 'Project'} added to the installation plan`);
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not add'); return false; }
  };

  // ── teams ───────────────────────────────────────────────────────────────────────────────────
  const teamRequest = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error ?? 'Could not save the team');
    return json;
  };
  const createTeam = async (d: TeamDraft) => {
    try {
      const { team } = await teamRequest('/api/installations/teams', 'POST', d);
      setTeams(ts => [...ts, team]);
      toast.success(`${team.name} created`);
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save the team'); return false; }
  };
  const updateTeam = async (id: string, d: TeamDraft) => {
    try {
      const { team } = await teamRequest(`/api/installations/teams/${id}`, 'PATCH', d);
      setTeams(ts => ts.map(t => (t.id === id ? team : t)));
      toast.success(`${team.name} saved — its rows show the change`);
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save the team'); return false; }
  };
  const deleteTeam = async (t: InstallTeam) => {
    const used = rawRows.filter(r => r.team_id === t.id).length;
    if (!window.confirm(`Delete ${t.name}?${used ? `\n\nIt is on ${used} row${used === 1 ? '' : 's'} — they keep "${t.name}" as text until you pick another team.` : ''}`)) return;
    try {
      await teamRequest(`/api/installations/teams/${t.id}`, 'DELETE');
      setTeams(ts => ts.filter(x => x.id !== t.id));
      setRows(rs => rs.map(r => (r.team_id === t.id ? { ...r, team_id: null } : r)));
      toast.success(`${t.name} deleted`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not delete the team'); }
  };

  const remove = async (row: Installation) => {
    if (!window.confirm(`Delete ${row.project_no || 'this row'} ${row.project_name ?? ''} from the installation plan?`)) return;
    setRows(rs => rs.filter(r => r.id !== row.id));
    try {
      const res = await fetch(`/api/installations/${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Could not delete');
    } catch (e) {
      setRows(rs => [...rs, row].sort((a, b) => a.sort_order - b.sort_order));
      toast.error(e instanceof Error ? e.message : 'Could not delete');
    }
  };

  const exportCsv = () => {
    const head = ['Project #', 'Project / Store Name', 'Branch', 'City / State', 'Planned Start', 'Planned Finish', 'Duration (days)', 'Assigned Team', 'Team Members',
      'Installation Scope / Company', 'Assigned Project Manager', 'Confidence', 'Project Status', 'Dependencies / Blockers', 'Notes', 'Last Updated', 'Alert (auto)',
      'Suggested Status (auto)', 'Installer Double-Booking (auto)'];
    const cell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = visible.map(r => [
      r.project_no, r.project_name, r.branch, r.city_state, r.planned_start, r.planned_finish, durationDays(r), r.team, headcount(r), r.scope, r.pm_name,
      r.confidence, r.status, r.blockers, r.notes, fmtDate(r.updated_at?.slice(0, 10) ?? null), alertOf(r, today)?.text, suggestedStatus(r, today),
      clashesAll.get(r.id)?.map(c => c.projectNo).join(' ') ?? '',
    ].map(cell).join(','));
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `installation-plan-${today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── render ──────────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Figma 620:33811 — page heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-[5px] leading-[1.35]">
          <PageCrumbs items={[{ label: 'T-Lines PM', href: '/tlines-pm' }, { label: 'Installation Plan', href: '/tlines-pm/installation' }]} />
          <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Installation Plan</h1>
          <p className="m-0 text-[13px] text-ui-body">
            {rows.filter(r => !isClosed(r)).length} open installation{rows.filter(r => !isClosed(r)).length === 1 ? '' : 's'} · the dashboard, months, Gantt and teams update from the register
          </p>
        </div>
        {!setupNeeded && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportCsv}
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[6px] border border-[var(--color-secondary-700)] bg-ui-page-bg pl-3 pr-3.5 text-[13px] font-semibold leading-[1.4] text-[var(--color-secondary-700)] hover:bg-ui-hover-bg dark:border-ui-heading dark:text-ui-heading">
              <FileSpreadsheet size={16} aria-hidden /> Export Excel
            </button>
            {canEdit && (
              <button type="button" onClick={() => setEditing('new')}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[6px] border-0 bg-ui-btn-accent pl-3 pr-3.5 text-[13px] font-semibold leading-[1.4] text-ui-btn-accent-fg hover:brightness-95">
                <Plus size={16} aria-hidden /> Add project
              </button>
            )}
          </div>
        )}
      </div>

      {setupNeeded || loadError ? (
        <div className="rounded-[10px] border border-ui-divider bg-ui-surface p-6 text-[13px] text-ui-body">
          {setupNeeded
            ? <>The installation plan isn’t set up in the database yet. Run <code className="rounded bg-ui-page-bg px-1.5 py-0.5">supabase/migrations/142_installations.sql</code> in the Supabase SQL editor — it creates the table and loads the 43 projects from the workbook.</>
            : loadError}
        </div>
      ) : (
        <>
          {/* tabs */}
          {/* Figma 620:33816 — underline view tabs */}
          <div role="tablist" aria-label="Installation plan" className="mt-3 flex h-12 items-stretch gap-8 overflow-x-auto border-b border-ui-divider">
            {TABS.map(t => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => go(t.key)}
                className={cn('-mb-px shrink-0 cursor-pointer whitespace-nowrap border-0 border-b-[3px] border-solid bg-transparent px-0 text-[13px] leading-[1.4] transition-colors',
                  tab === t.key
                    ? 'border-[var(--color-secondary-700)] font-semibold text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading'
                    : 'border-transparent font-normal text-ui-text-secondary hover:text-ui-heading')}>
                {t.label}
              </button>
            ))}
          </div>

          {/* filters (every tab) */}
          {/* Figma 629:5556 — search + filters left, sort + columns right (register only) */}
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <label className="relative flex items-center">
              <Search size={16} className="pointer-events-none absolute left-2.5 text-ui-text-secondary" aria-hidden />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search project…" aria-label="Search project, team, PM, notes"
                className="h-9 w-[285px] max-w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] leading-[1.45] text-ui-heading outline-none placeholder:text-ui-text-secondary focus:border-[var(--ui-focus-ring)]" />
            </label>
            <FilterSelect aria-label="Branch" value={branch} onValueChange={v => setBranch(v ?? '')} className={FILTER_CLS}
              options={[{ value: '', label: 'All Branches' }, ...BRANCHES.map(b => ({ value: b, label: b }))]} />
            <FilterSelect aria-label="Project manager" value={pm} onValueChange={v => setPm(v ?? '')} className={FILTER_CLS}
              options={[{ value: '', label: 'All PMs' }, { value: '__none', label: 'No PM (TBD)' }, ...pmNames.map(n => ({ value: n, label: n }))]} />
            <FilterSelect aria-label="Company" value={scope} onValueChange={v => setScope(v ?? '')} className={FILTER_CLS}
              options={[{ value: '', label: 'All Companies' }, ...SCOPES.map(s => ({ value: s, label: s }))]} />
            <FilterSelect aria-label="Status" value={status} onValueChange={v => setStatus(v ?? '')} className={FILTER_CLS}
              options={[{ value: '', label: 'All Statuses' }, { value: '__none', label: 'No status' }, ...STATUSES.map(s => ({ value: s, label: s }))]} />
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-ui-body">
              <Checkbox checked={hideDone} onCheckedChange={v => setHideDone(!!v)} /> Hide completed
            </label>
            {drill && (
              <button type="button" onClick={() => setDrill(null)}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-[var(--ui-btn-solid)] px-3 text-[12px] font-semibold text-[var(--ui-btn-solid-fg)]">
                {DRILL_LABEL[drill]} <X size={13} />
              </button>
            )}
            <span className="text-[12px] text-ui-text-secondary">
              {filtered ? `${visible.length} of ${rows.length} projects` : `${rows.length} projects`}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <FilterSelect aria-label="Month" value={month} onValueChange={v => pickMonth(v ?? '')} className={cn(FILTER_CLS, 'gap-2 px-3 dark:px-3')}
                options={[{ value: '', label: from || to ? 'Custom' : 'All months' }, ...months.map(m => ({ value: m, label: shortMonth(m) }))]} />
              <div className="flex items-center gap-2.5" role="group" aria-label="Date range">
                <DatePicker value={fromISO(from)} onValueChange={d => pickDate('from', toISO(d))} aria-label="From date" placeholder="Any"
                  prefix={<span className="text-[11px] leading-[1.35] text-ui-body">From</span>} formatValue={dayLabel} iconEnd className={DATE_CLS} />
                <DatePicker value={fromISO(to)} onValueChange={d => pickDate('to', toISO(d))} aria-label="To date" placeholder="Any"
                  prefix={<span className="text-[11px] leading-[1.35] text-ui-body">To</span>} formatValue={dayLabel} iconEnd className={DATE_CLS} />
                {(from || to) && (
                  <button type="button" onClick={() => pickMonth('')} aria-label="Clear dates" title="Clear dates"
                    className="inline-grid size-8 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent text-ui-text-secondary hover:bg-ui-hover-bg hover:text-ui-heading">
                    <X size={14} />
                  </button>
                )}
              </div>
            {tab === 'register' && (
              <div className="flex items-center gap-2">
                <span className="relative inline-flex items-center">
                  <ArrowDownUp size={14} aria-hidden className="pointer-events-none absolute left-3 z-[1] text-[var(--color-secondary-700)] dark:text-ui-heading" />
                  <FilterSelect aria-label="Sort" value={sort} onValueChange={v => pickSort((v ?? 'newest') as RegisterSort)}
                    className={cn(FILTER_CLS, 'gap-2 pl-[34px] pr-3 dark:pl-[34px]')} options={REGISTER_SORTS.map(o => ({ value: o.value, label: o.label }))} />
                </span>
                <ColumnsMenu hidden={hiddenCols} onToggle={toggleCol} onSetAll={setAllCols} />
              </div>
            )}
            </div>
          </div>

          {tab === 'dashboard' && (
            <DashboardTab rows={visible} today={today} clashes={clashesVisible} months={months} projectByNo={projectByNo}
              onDrill={d => { setDrill(d); go('register'); }} />
          )}
          {tab === 'register' && (
            <RegisterTab rows={visible} today={today} clashes={clashesAll} canEdit={canEdit} projectByNo={projectByNo} sort={sort} hidden={hiddenCols}
              onSave={(id, patch) => { void save(id, patch); }} onAdd={() => setEditing('new')} onEdit={r => setEditing(r)}
              onDelete={remove} pmNames={pmNames} teams={teams} />
          )}
          {tab === 'monthly' && <MonthlyTab rows={visible} months={months} today={today} projectByNo={projectByNo} />}
          {tab === 'gantt' && <GanttTab rows={visible} months={months} today={today} clashes={clashesAll} projectByNo={projectByNo} />}
          {tab === 'teamsMgr' && (
            <TeamsManagerTab teams={teams} rows={rows} today={today} canEdit={canEdit} setupNeeded={teamsSetupNeeded} projectByNo={projectByNo}
              onCreate={createTeam} onUpdate={updateTeam} onDelete={t => { void deleteTeam(t); }} />
          )}
          {tab === 'teams' && <TeamsTab rows={visible} months={months} today={today} clashes={clashesAll} projectByNo={projectByNo} />}
        </>
      )}

      <RowEditModal
        open={editing !== null}
        row={editing === 'new' || editing === null ? null : rawRows.find(r => r.id === editing.id) ?? editing}
        teams={teams} pmNames={pmNames} today={today}
        onClose={() => setEditing(null)}
        onSave={patch => (editing && editing !== 'new' ? save(editing.id, patch) : create(patch))}
      />
    </div>
  );
}
