'use client';

import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, Ellipsis, ExternalLink, ListChecks, Plus, RefreshCw, RotateCcw, Search, UserRound } from 'lucide-react';
import { formatDate } from '@/lib/formatDate';
import { Select as FilterSelect, Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { OpportunityQuickView } from '@/components/platform/marketing/OpportunityQuickView';
import { findStatusTag } from '@/lib/status/tags';
import { cn } from '@/lib/utils';
import { Menu, MenuContent, MenuItem, MenuLinkItem, MenuTrigger } from '@/components/ui/menu';
import { PersonFace } from '@/components/ui/avatar-directory';
import { Checkbox } from '@/components/ui/checkbox';
import type { TaskQuickFilter } from '@/lib/sales/taskFilters';

export interface TaskRow {
  id: string;
  /** 'lead' = old lead-intake task, 'opportunity' = a pipeline deal (incl. the auto follow-ups). */
  kind: 'lead' | 'opportunity';
  /** Id of the lead intake or the Opportunity the task belongs to. */
  lead_id: string;
  /** Pipeline stage label, for Opportunity tasks. */
  deal_stage: string | null;
  /** The deal's CRM "Date created" — what the CRM board sorts by. */
  deal_date: string | null;
  lead_name: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  assignee_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
}

// Figma "Sales tasks" (node 299:13922): status tags are T-tones (To Do = T2 blue).
const STATUS_META: Record<TaskRow['status'], { label: string; tone: string }> = {
  todo:        { label: 'To Do',       tone: 't2' },
  in_progress: { label: 'In Progress', tone: 't7' },
  done:        { label: 'Done',        tone: 't9' },
};
const STATUS_ORDER: TaskRow['status'][] = ['todo', 'in_progress', 'done'];

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const FILTER_CLS = 'inline-flex h-9 w-auto shrink-0 cursor-pointer items-center gap-1 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-3 pr-2 text-[13px] font-medium leading-normal text-[var(--color-secondary-700)] dark:rounded-[6px] dark:text-ui-heading [&_svg]:size-3.5';
const TH = 'px-2.5 text-left text-[12px] font-semibold leading-[1.4] whitespace-nowrap text-ui-body';

// Table-cell dropdowns: the design-system Select without the form-field box (the cell is the box).
const CELL_SELECT = 'h-auto w-auto max-w-full gap-2.5 border-0 bg-transparent px-0 hover:border-0 dark:border-0 dark:bg-transparent dark:px-0';
// Status trigger = the tone pill. Literal class strings — Tailwind can't see classes built at runtime.
const STATUS_TRIGGER: Record<TaskRow['status'], string> = {
  todo:        'border-[var(--status-t2-fg)] bg-[var(--status-t2-bg)] text-[var(--status-t2-fg)] hover:border-[var(--status-t2-fg)] dark:border-[var(--status-t2-fg)] dark:bg-[var(--status-t2-bg)] dark:text-[var(--status-t2-fg)]',
  in_progress: 'border-[var(--status-t7-fg)] bg-[var(--status-t7-bg)] text-[var(--status-t7-fg)] hover:border-[var(--status-t7-fg)] dark:border-[var(--status-t7-fg)] dark:bg-[var(--status-t7-bg)] dark:text-[var(--status-t7-fg)]',
  done:        'border-[var(--status-t9-fg)] bg-[var(--status-t9-bg)] text-[var(--status-t9-fg)] hover:border-[var(--status-t9-fg)] dark:border-[var(--status-t9-fg)] dark:bg-[var(--status-t9-bg)] dark:text-[var(--status-t9-fg)]',
};

/** 'YYYY-MM-DD' ⇄ local Date, so the DatePicker can edit the date-only column. */
const parseISODate = (s: string | null) => {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toISODate = (d: Date | null) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;

const fmt = (iso: string | null) => formatDate(iso);
// Deal date is written exactly like the CRM board's "Date created" (m/d/yy) so the two screens read the same.
const fmtCrm = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
};

const taskApi = (t: TaskRow) =>
  t.kind === 'opportunity'
    ? `/api/marketing/opportunities/${t.lead_id}/tasks/${t.id}`
    : `/api/leads/${t.lead_id}/tasks/${t.id}`;
const taskHref = (t: TaskRow) => (t.kind === 'opportunity' ? `/leads?open=${t.lead_id}` : `/leads/${t.lead_id}`);

export function TasksClient({ tasks: initial, assignees, currentUserId, openDeals = [], initialFilter }: {
  tasks: TaskRow[];
  assignees: { id: string; full_name: string }[];
  currentUserId: string;
  /** Every open deal the user can work — the New Task dialog's choices. */
  openDeals?: { id: string; name: string }[];
  initialFilter?: TaskQuickFilter;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [mine, setMine]     = useState(initialFilter === 'mine');
  const [fStatus, setFStatus] = useState('');
  const [fAssignee, setFAssignee] = useState(initialFilter === 'unassigned' ? '__none__' : '');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [fOverdue, setFOverdue] = useState(initialFilter === 'overdue');
  const [fToday, setFToday] = useState(initialFilter === 'today');
  const [openDealId, setOpenDealId] = useState<string | null>(null); // deal shown in the progress pop-up
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);
  useEffect(() => { setTasks(initial); }, [initial]);

  // Bring the list up to date with the pipeline: every open deal gets the follow-ups its stage calls
  // for (proposal sent -> "what was their answer?", waiting -> "check in", ...). Idempotent.
  async function syncFromPipeline(silent: boolean) {
    setSyncing(true);
    const res = await fetch('/api/sales/tasks/sync', { method: 'POST' }).catch(() => null);
    setSyncing(false);
    if (!res || !res.ok) { if (!silent) toast.error('Could not update tasks from the pipeline'); return; }
    const r = await res.json() as { created: number; retired: number };
    if (r.created || r.retired) { toast.success(`${r.created} new task${r.created === 1 ? '' : 's'} from the pipeline${r.retired ? ` · ${r.retired} no longer needed` : ''}`); router.refresh(); }
    else if (!silent) toast.success('Tasks are up to date');
  }
  const syncedOnce = useRef(false);
  useEffect(() => { if (syncedOnce.current) return; syncedOnce.current = true; void syncFromPipeline(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const today = new Date().toISOString().slice(0, 10);

  async function patch(t: TaskRow, body: Partial<TaskRow>) {
    setBusy(t.id);
    setTasks(ts => ts.map(x => (x.id === t.id ? { ...x, ...body } : x)));
    const res = await fetch(taskApi(t), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => null);
    if (!res || !res.ok) { toast.error('Could not save'); router.refresh(); }
    setBusy(null);
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter(t => {
      if (mine && t.assignee_id !== currentUserId) return false;
      if (fStatus && t.status !== fStatus) return false;
      if (fAssignee === '__none__' && t.assignee_id) return false;
      if (fAssignee && fAssignee !== '__none__' && t.assignee_id !== fAssignee) return false;
      if (fOverdue && !(t.status !== 'done' && t.due_date && t.due_date < today)) return false;
      if (fToday && !(t.status !== 'done' && t.due_date?.slice(0, 10) === today)) return false;
      if (q && !`${t.title} ${t.lead_name} ${t.deal_stage ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => {
      // Same order as the CRM board: newest deal first — never the oldest project on top.
      const ta = Date.parse(a.deal_date ?? '') || 0, tb = Date.parse(b.deal_date ?? '') || 0;
      if (ta !== tb) return tb - ta;
      if (a.lead_id !== b.lead_id) return a.lead_id.localeCompare(b.lead_id);   // keep one deal's tasks together
      const ad = a.status === 'done' ? 1 : 0, bd = b.status === 'done' ? 1 : 0;
      if (ad !== bd) return ad - bd;                                             // within a deal: open first
      return (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999');
    });
  }, [tasks, mine, fStatus, fAssignee, fOverdue, fToday, search, currentUserId, today]);

  const open = tasks.filter(t => t.status !== 'done').length;
  const overdue = tasks.filter(t => t.status !== 'done' && t.due_date && t.due_date < today).length;
  const myOpen = tasks.filter(t => t.status !== 'done' && t.assignee_id === currentUserId).length;
  const dueToday = tasks.filter(t => t.status !== 'done' && t.due_date?.slice(0, 10) === today).length;

  // Deals a new task can be attached to — the Opportunities already on this list.
  const deals = useMemo(() => {
    const m = new Map<string, string>(openDeals.map(d => [d.id, d.name]));
    for (const t of tasks) if (t.kind === 'opportunity' && !m.has(t.lead_id)) m.set(t.lead_id, t.lead_name);
    return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, openDeals]);

  return (
    <div className="flex flex-col gap-[30px]">
      {/* ── Page heading ── */}
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'Sales', href: '/leads' }, { label: 'Tasks', href: '/sales-tasks' }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Tasks</h1>
        <p className="m-0 text-[13px] text-ui-body">
          {open} open · {myOpen} assigned to me
          {overdue > 0 && (
            <>
              {' · '}
              <button
                type="button" aria-pressed={fOverdue} onClick={() => setFOverdue(o => !o)}
                title={fOverdue ? 'Show all tasks' : 'Show only overdue tasks'}
                className={cn('border-0 bg-transparent p-0 text-[13px] text-error-normal hover:underline', fOverdue && 'font-semibold underline')}
              >
                {overdue} overdue
              </button>
            </>
          )}
          {(dueToday > 0 || fToday) && (
            <>
              {' · '}
              <button
                type="button" aria-pressed={fToday} onClick={() => setFToday(o => !o)}
                title={fToday ? 'Show all tasks' : 'Show only tasks due today'}
                className={cn('border-0 bg-transparent p-0 text-[13px] text-[var(--status-warning-fg)] hover:underline', fToday && 'font-semibold underline')}
              >
                {dueToday} due today
              </button>
            </>
          )}
        </p>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-[285px] max-w-full">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
            <input
              type="search" aria-label="Search tasks" placeholder="Search task…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] leading-[1.45] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
            />
          </div>
          <FilterSelect
            aria-label="Status" className={FILTER_CLS} value={fStatus} onValueChange={v => setFStatus(v ?? '')}
            options={[{ value: '', label: 'All Statuses' }, ...STATUS_ORDER.map(s => ({ value: s, label: STATUS_META[s].label }))]}
          />
          <FilterSelect
            aria-label="Assignee" className={FILTER_CLS} value={fAssignee} onValueChange={v => setFAssignee(v ?? '')}
            options={[{ value: '', label: 'All Assignees' }, { value: '__none__', label: 'Unassigned' }, ...assignees.map(a => ({ value: a.id, label: a.full_name }))]}
          />
          <button
            type="button" aria-pressed={mine} onClick={() => setMine(m => !m)}
            className={cn(FILTER_CLS, 'gap-2 px-3 aria-pressed:border-[var(--color-secondary-700)] aria-pressed:bg-ui-selected-bg dark:aria-pressed:border-ui-heading [&_svg]:size-4')}
          >
            <UserRound aria-hidden />
            Assigned to me{myOpen > 0 ? ` · ${myOpen}` : ''}
          </button>
          {(mine || fStatus || fAssignee || fOverdue || fToday || search) && (
            <Button
              variant="link"
              onClick={() => { setMine(false); setFStatus(''); setFAssignee(''); setFOverdue(false); setFToday(false); setSearch(''); }}
            >
              Clear filters
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline" size="toolbar"
            onClick={() => syncFromPipeline(false)} disabled={syncing} title="Create the follow-ups each open deal needs"
          >
            <RefreshCw className={cn('size-4', syncing && 'animate-spin')} aria-hidden />
            {syncing ? 'Updating…' : 'Update from pipeline'}
          </Button>
          <Button
            variant="accent" size="toolbar"
            onClick={() => setCreating(true)} disabled={deals.length === 0}
            title={deals.length === 0 ? 'No open deals to add a task to' : undefined}
          >
            <Plus className="size-4" aria-hidden />
            New Task
          </Button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
        {visible.length === 0 ? (
          <EmptyState
            icon={<ListChecks />}
            title={tasks.length === 0 ? 'No tasks yet' : 'No matching tasks'}
            description={tasks.length === 0
              ? 'Open deals get their follow-ups automatically — use “Update from pipeline” if you expect some.'
              : 'Try another search or clear the filters.'}
          />
        ) : (
          <div className="relative overflow-x-auto">
            {/* relative: keeps the sr-only header labels inside the scroller instead of widening the page.
                table-fixed + min-w: the fixed columns add up to 1052px and Assignee takes 16% (250px at the minimum),
                so Task always keeps at least 258px; on wide screens Assignee and Task both grow. */}
            <table className="w-full min-w-[1560px] table-fixed border-collapse">
              <thead>
                <tr className="h-[46px] border-b border-ui-divider bg-[var(--ui-table-head-bg,var(--ui-surface))]">
                  <th className={cn(TH, 'w-[44px] pl-[18px]')}><span className="sr-only">Done</span></th>
                  <th className={TH}>Task</th>
                  <th className={cn(TH, 'w-[300px]')}>Deal/Lead</th>
                  <th className={cn(TH, 'w-[110px]')}>Deal Date</th>
                  <th className={cn(TH, 'w-[16%]')}>Assignee</th>
                  <th className={cn(TH, 'w-[150px]')}>Status</th>
                  <th className={cn(TH, 'w-[160px]')}>Due</th>
                  <th className={cn(TH, 'w-[120px]')}>Created</th>
                  <th className={cn(TH, 'w-[120px]')}>Completed</th>
                  <th className="w-[48px]"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(t => {
                  const done = t.status === 'done';
                  const isOverdue = !done && !!t.due_date && t.due_date < today;
                  const stageTone = t.deal_stage ? (findStatusTag('lead_stage', t.deal_stage)?.tone ?? 't0') : null;
                  const toggleDone = () => patch(t, { status: done ? 'todo' : 'done', completed_at: done ? null : new Date().toISOString() });
                  return (
                    <tr key={t.id} className={cn('h-16 border-b border-ui-divider last:border-b-0', busy === t.id && 'opacity-60')}>
                      <td className="pl-[18px] pr-2.5">
                        <Checkbox
                          checked={done} onCheckedChange={toggleDone}
                          aria-label={done ? `Re-open: ${t.title}` : `Mark done: ${t.title}`}
                          title={done ? 'Re-open' : 'Mark done'}
                        />
                      </td>
                      <td className="max-w-0 px-2.5">
                        <p className={cn('m-0 truncate text-[13px] font-semibold', done ? 'text-ui-text-disabled line-through' : HEADING)} title={t.title}>
                          {t.title}
                        </p>
                      </td>
                      <td className="max-w-0 px-2.5">
                        <div className="flex flex-col items-start gap-1">
                          {t.kind === 'opportunity' ? (
                            <button
                              type="button" onClick={() => setOpenDealId(t.lead_id)} title="See how this deal has progressed"
                              className="max-w-full truncate border-0 bg-transparent p-0 text-left text-[13px] text-ui-body hover:underline"
                            >{t.lead_name}</button>
                          ) : (
                            <Link href={taskHref(t)} className="max-w-full truncate text-[13px] text-ui-body no-underline hover:underline">{t.lead_name}</Link>
                          )}
                          {t.deal_stage && stageTone && (
                            <span
                              className="rounded-[4px] border px-2.5 py-0.5 text-[12px] font-medium leading-4 whitespace-nowrap"
                              style={{ background: `var(--status-${stageTone}-bg)`, color: `var(--status-${stageTone}-fg)`, borderColor: `var(--status-${stageTone}-fg)` }}
                            >
                              {t.deal_stage}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 text-[12px] whitespace-nowrap text-ui-body">{fmtCrm(t.deal_date)}</td>
                      <td className="px-2.5">
                        <Select
                          aria-label={`Assignee for ${t.title}`}
                          className={CELL_SELECT}
                          value={t.assignee_id ?? ''}
                          onValueChange={v => {
                            const id = v || null;
                            patch(t, { assignee_id: id, assignee_name: assignees.find(a => a.id === id)?.full_name ?? null });
                          }}
                          options={[{ value: '', label: 'Unassigned' }, ...assignees.map(a => ({ value: a.id, label: a.full_name }))]}
                          renderOption={o => (
                            <span className="inline-flex min-w-0 items-center gap-2">
                              <span aria-hidden className={cn('grid size-[26px] shrink-0 place-items-center rounded-full bg-ui-surface text-[10px] font-semibold', HEADING)}>
                                <PersonFace userId={o.value || null} name={o.value ? o.label : null} fallback={initials(o.value ? o.label : null)} />
                              </span>
                              <span className={cn('truncate text-[13px] leading-[1.4]', o.value ? HEADING : 'text-ui-text-secondary', 'in-data-highlighted:text-primary-50')}>{o.label}</span>
                            </span>
                          )}
                        />
                      </td>
                      <td className="px-2">
                        <Select
                          aria-label={`Status for ${t.title}`}
                          className={cn(CELL_SELECT, 'h-[30px] rounded-[4px] border pl-4 pr-2.5 text-[12px] font-medium uppercase dark:rounded-[4px] dark:px-2.5 dark:pl-4', STATUS_TRIGGER[t.status])}
                          value={t.status}
                          onValueChange={v => {
                            const s = v as TaskRow['status'] | null;
                            if (!s || s === t.status) return;
                            patch(t, { status: s, completed_at: s === 'done' ? new Date().toISOString() : null });
                          }}
                          options={STATUS_ORDER.map(s => ({ value: s, label: STATUS_META[s].label }))}
                        />
                      </td>
                      <td className="px-2">
                        <DatePicker
                          aria-label={`Due date for ${t.title}`}
                          placeholder="No due date"
                          value={parseISODate(t.due_date)}
                          onValueChange={d => patch(t, { due_date: toISODate(d) })}
                          className={cn('h-[30px] text-[12px] font-medium', isOverdue && 'text-error-normal dark:text-error-normal')}
                        />
                      </td>
                      <td className="px-2 text-[12px] whitespace-nowrap text-ui-body">{fmt(t.created_at)}</td>
                      <td className={cn('px-2 text-[12px] whitespace-nowrap', done ? 'text-ui-body' : 'text-ui-text-disabled')}>{fmt(t.completed_at)}</td>
                      <td className="pr-2 text-center">
                        <Menu>
                          <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.title}`} />}>
                            <Ellipsis />
                          </MenuTrigger>
                          <MenuContent>
                            {t.kind === 'opportunity' ? (
                              <MenuItem onClick={() => setOpenDealId(t.lead_id)}>
                                <ExternalLink aria-hidden /> Open deal
                              </MenuItem>
                            ) : (
                              <MenuLinkItem render={<Link href={taskHref(t)} />}>
                                <ExternalLink aria-hidden /> Open lead
                              </MenuLinkItem>
                            )}
                            <MenuItem onClick={toggleDone}>
                              {done ? <><RotateCcw aria-hidden /> Re-open</> : <><Check aria-hidden /> Mark done</>}
                            </MenuItem>
                          </MenuContent>
                        </Menu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <NewTaskDialog
          deals={deals} assignees={assignees}
          onClose={() => setCreating(false)}
          onCreated={row => { setTasks(ts => [row, ...ts]); setCreating(false); }}
        />
      )}

      {openDealId && (
        <OpportunityQuickView
          opportunityId={openDealId}
          assignees={assignees}
          onClose={() => { setOpenDealId(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function initials(name: string | null): string {
  if (!name) return '—';
  return name.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

// Creates a follow-up on one of the deals already on this list (POST …/opportunities/:id/tasks),
// then saves assignee/due on the new task the same way the row editors do.
function NewTaskDialog({ deals, assignees, onClose, onCreated }: {
  deals: { id: string; name: string }[];
  assignees: { id: string; full_name: string }[];
  onClose: () => void;
  onCreated: (row: TaskRow) => void;
}) {
  const [dealId, setDealId] = useState(deals[0]?.id ?? '');
  const dealOptions = useMemo(() => deals.map(d => ({ value: d.id, label: d.name })), [deals]);
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [due, setDue] = useState('');
  const [saving, setSaving] = useState(false);
  const formId = useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dealId || !title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/marketing/opportunities/${dealId}/tasks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim() }),
      }).catch(() => null);
      const body = res ? await res.json().catch(() => ({})) : {};
      if (!res || !res.ok || !body.task) { toast.error(body.error ?? 'Could not add task'); return; }
      const extra: Record<string, string> = {};
      if (assigneeId) extra.assignee_id = assigneeId;
      if (due) extra.due_date = due;
      if (Object.keys(extra).length) {
        const r = await fetch(`/api/marketing/opportunities/${dealId}/tasks/${body.task.id}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(extra),
        }).catch(() => null);
        if (!r || !r.ok) toast.error('Task added, but the assignee/due date could not be saved');
      }
      onCreated({
        id: body.task.id, kind: 'opportunity', lead_id: dealId, deal_stage: null, deal_date: null,
        lead_name: deals.find(d => d.id === dealId)?.name ?? '—', title: body.task.title, status: 'todo',
        assignee_id: assigneeId || null, assignee_name: assignees.find(a => a.id === assigneeId)?.full_name ?? null,
        due_date: due || null, created_at: body.task.created_at ?? new Date().toISOString(), completed_at: null,
      });
      toast.success('Task added');
    } finally { setSaving(false); }
  }

  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent
        title="New Task"
        footer={<>
          <ModalClose render={<Button variant="secondary" size="md" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button type="submit" form={formId} variant="accent" size="md" loading={saving} disabled={!title.trim() || !dealId}>
            Add task
          </Button>
        </>}
      >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[14px] font-medium text-ui-body">
          Task
          <Input autoFocus required aria-label="Task" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Send the revised proposal" className="h-10 text-[14px]" />
        </label>
        <div className="flex flex-col gap-1.5 text-[14px] font-medium text-ui-body">
          Deal
          {/* Searchable — the open-deal list can run to hundreds. */}
          <Combobox
            aria-label="Deal" placeholder="Search a deal…" emptyText="No open deal matches"
            className="h-10 text-[14px]"
            options={dealOptions}
            value={dealOptions.find(o => o.value === dealId) ?? null}
            onValueChange={o => setDealId(o?.value ?? '')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5 text-[14px] font-medium text-ui-body">
            Assignee
            <Select
              aria-label="Assignee" className="h-10 text-[14px]"
              value={assigneeId} onValueChange={v => setAssigneeId(v ?? '')}
              options={[{ value: '', label: 'Unassigned' }, ...assignees.map(a => ({ value: a.id, label: a.full_name }))]}
            />
          </div>
          <div className="flex flex-col gap-1.5 text-[14px] font-medium text-ui-body">
            Due
            <DatePicker
              aria-label="Due date" placeholder="No due date" className="h-10 w-full text-[14px]"
              value={parseISODate(due || null)} onValueChange={d => setDue(toISODate(d) ?? '')}
            />
          </div>
        </div>
      </form>
      </ModalContent>
    </Modal>
  );
}
