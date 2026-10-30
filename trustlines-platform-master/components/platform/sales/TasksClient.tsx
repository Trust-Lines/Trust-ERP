'use client';

import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, ChevronDown, Ellipsis, ExternalLink, ListChecks, Plus, RefreshCw, RotateCcw, Search, UserRound, X } from 'lucide-react';
import { formatDate } from '@/lib/formatDate';
import { Select as FilterSelect } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { OpportunityQuickView } from '@/components/platform/marketing/OpportunityQuickView';
import { findStatusTag } from '@/lib/status/tags';
import { cn } from '@/lib/utils';

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
const MENU_ITEM = 'flex w-full cursor-pointer items-center gap-2 rounded-[4px] border-0 bg-transparent px-2 py-1.5 text-left text-[13px] text-ui-body no-underline hover:bg-ui-hover-bg [&_svg]:size-3.5';

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

export function TasksClient({ tasks: initial, assignees, currentUserId }: {
  tasks: TaskRow[];
  assignees: { id: string; full_name: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [mine, setMine]     = useState(false);
  const [fStatus, setFStatus] = useState('');
  const [fAssignee, setFAssignee] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [fOverdue, setFOverdue] = useState(false);
  const [openDealId, setOpenDealId] = useState<string | null>(null); // deal shown in the progress pop-up
  const [syncing, setSyncing] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
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
  }, [tasks, mine, fStatus, fAssignee, fOverdue, search, currentUserId, today]);

  const open = tasks.filter(t => t.status !== 'done').length;
  const overdue = tasks.filter(t => t.status !== 'done' && t.due_date && t.due_date < today).length;
  const myOpen = tasks.filter(t => t.status !== 'done' && t.assignee_id === currentUserId).length;

  // Deals a new task can be attached to — the Opportunities already on this list.
  const deals = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasks) if (t.kind === 'opportunity' && !m.has(t.lead_id)) m.set(t.lead_id, t.lead_name);
    return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

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
          {(mine || fStatus || fAssignee || fOverdue || search) && (
            <button
              type="button"
              onClick={() => { setMine(false); setFStatus(''); setFAssignee(''); setFOverdue(false); setSearch(''); }}
              className="border-0 bg-transparent px-1 text-[13px] font-medium text-ui-link hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button" onClick={() => syncFromPipeline(false)} disabled={syncing} title="Create the follow-ups each open deal needs"
            className={cn('inline-flex h-9 items-center gap-2 rounded-[6px] border border-[var(--color-secondary-700)] bg-transparent px-3 text-[13px] font-medium leading-[1.35] transition-colors hover:bg-ui-hover-bg disabled:opacity-60 dark:border-ui-heading', HEADING)}
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : undefined} aria-hidden />
            {syncing ? 'Updating…' : 'Update from pipeline'}
          </button>
          <button
            type="button" onClick={() => setCreating(true)} disabled={deals.length === 0}
            title={deals.length === 0 ? 'No deals on this list to add a task to' : undefined}
            className="inline-flex h-9 items-center gap-2 rounded-[6px] border-0 bg-ui-btn-accent pl-7 pr-10 text-[13px] font-medium leading-[1.35] text-ui-btn-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={16} aria-hidden />
            New Task
          </button>
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse">
              <thead>
                <tr className="h-[46px] border-b border-ui-divider bg-[var(--ui-table-head-bg,var(--ui-surface))]">
                  <th className={cn(TH, 'w-[44px] pl-[18px]')}><span className="sr-only">Done</span></th>
                  <th className={TH}>Task</th>
                  <th className={cn(TH, 'w-[300px]')}>Deal/Lead</th>
                  <th className={cn(TH, 'w-[110px]')}>Deal Date</th>
                  <th className={cn(TH, 'w-[180px]')}>Assignee</th>
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
                        <input
                          type="checkbox" checked={done} onChange={toggleDone}
                          aria-label={done ? `Re-open: ${t.title}` : `Mark done: ${t.title}`}
                          title={done ? 'Re-open' : 'Mark done'}
                          className="size-4 cursor-pointer rounded-[3px] accent-[var(--color-secondary-700)]"
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
                        <label className="relative inline-flex max-w-full cursor-pointer items-center gap-2.5">
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <span aria-hidden className={cn('grid size-[26px] shrink-0 place-items-center rounded-full bg-ui-surface text-[10px] font-semibold', HEADING)}>
                              {initials(t.assignee_name)}
                            </span>
                            <span className={cn('truncate text-[13px] leading-[1.4]', t.assignee_name ? HEADING : 'text-ui-text-secondary')}>
                              {t.assignee_name ?? 'Unassigned'}
                            </span>
                          </span>
                          <ChevronDown size={14} aria-hidden className="shrink-0 text-ui-body" />
                          <select
                            aria-label={`Assignee for ${t.title}`}
                            value={t.assignee_id ?? ''}
                            onChange={e => {
                              const id = e.target.value || null;
                              patch(t, { assignee_id: id, assignee_name: assignees.find(a => a.id === id)?.full_name ?? null });
                            }}
                            className="absolute inset-0 cursor-pointer opacity-0"
                          >
                            <option value="">Unassigned</option>
                            {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                          </select>
                        </label>
                      </td>
                      <td className="px-2">
                        <label
                          className="relative inline-flex h-[30px] cursor-pointer items-center gap-2.5 rounded-[4px] border pl-4 pr-2.5 text-[12px] font-medium leading-4 uppercase"
                          style={{ background: `var(--status-${STATUS_META[t.status].tone}-bg)`, color: `var(--status-${STATUS_META[t.status].tone}-fg)`, borderColor: `var(--status-${STATUS_META[t.status].tone}-fg)` }}
                        >
                          {STATUS_META[t.status].label}
                          <ChevronDown size={14} aria-hidden />
                          <select
                            aria-label={`Status for ${t.title}`}
                            value={t.status}
                            onChange={e => {
                              const s = e.target.value as TaskRow['status'];
                              patch(t, { status: s, completed_at: s === 'done' ? new Date().toISOString() : null });
                            }}
                            className="absolute inset-0 cursor-pointer opacity-0"
                          >
                            {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                          </select>
                        </label>
                      </td>
                      <td className="px-2">
                        <input
                          type="date" value={t.due_date ?? ''} aria-label={`Due date for ${t.title}`}
                          onChange={e => patch(t, { due_date: e.target.value || null })}
                          className={cn(
                            'h-[30px] rounded-[4px] border border-[var(--color-secondary-700)] bg-ui-input-bg pl-4 pr-2.5 text-[12px] font-medium dark:border-ui-heading',
                            isOverdue ? 'text-error-normal' : HEADING,
                          )}
                        />
                      </td>
                      <td className="px-2 text-[12px] whitespace-nowrap text-ui-body">{fmt(t.created_at)}</td>
                      <td className={cn('px-2 text-[12px] whitespace-nowrap', done ? 'text-ui-body' : 'text-ui-text-disabled')}>{fmt(t.completed_at)}</td>
                      <td className="relative pr-2 text-center">
                        <button
                          type="button" aria-label={`Actions for ${t.title}`} aria-expanded={menuId === t.id}
                          onClick={() => setMenuId(id => (id === t.id ? null : t.id))}
                          className="inline-grid size-7 place-items-center rounded-[4px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg"
                        >
                          <Ellipsis size={16} />
                        </button>
                        {menuId === t.id && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setMenuId(null)} />
                            <div role="menu" className="absolute right-2 top-full z-30 mt-1 w-44 rounded-[6px] border border-ui-divider bg-ui-surface-elevated p-1 text-left shadow-03">
                              {t.kind === 'opportunity' ? (
                                <button type="button" role="menuitem" className={MENU_ITEM} onClick={() => { setMenuId(null); setOpenDealId(t.lead_id); }}>
                                  <ExternalLink aria-hidden /> Open deal
                                </button>
                              ) : (
                                <Link href={taskHref(t)} role="menuitem" className={MENU_ITEM} onClick={() => setMenuId(null)}>
                                  <ExternalLink aria-hidden /> Open lead
                                </Link>
                              )}
                              <button type="button" role="menuitem" className={MENU_ITEM} onClick={() => { setMenuId(null); toggleDone(); }}>
                                {done ? <><RotateCcw aria-hidden /> Re-open</> : <><Check aria-hidden /> Mark done</>}
                              </button>
                            </div>
                          </>
                        )}
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
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [due, setDue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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

  const fieldCls = 'h-10 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] text-ui-heading outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring';
  return (
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/45 p-4" onClick={onClose}>
      <form
        role="dialog" aria-modal="true" aria-labelledby="new-task-title"
        onClick={e => e.stopPropagation()} onSubmit={submit}
        className="flex w-full max-w-[480px] flex-col gap-4 rounded-card bg-ui-page-bg p-6 shadow-04"
      >
        <div className="flex items-center justify-between">
          <h2 id="new-task-title" className={cn('m-0 text-[18px] font-semibold', HEADING)}>New Task</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-[6px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg">
            <X size={16} />
          </button>
        </div>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-body">
          Task
          <input autoFocus required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Send the revised proposal" className={fieldCls} />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-body">
          Deal
          <select required value={dealId} onChange={e => setDealId(e.target.value)} className={fieldCls}>
            {deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-body">
            Assignee
            <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className={fieldCls}>
              <option value="">Unassigned</option>
              {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-body">
            Due
            <input type="date" value={due} onChange={e => setDue(e.target.value)} className={fieldCls} />
          </label>
        </div>
        <div className="flex justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} className={cn('h-9 rounded-[6px] border border-[var(--color-secondary-700)] bg-transparent px-5 text-[13px] font-medium hover:bg-ui-hover-bg dark:border-ui-heading', HEADING)}>
            Cancel
          </button>
          <button type="submit" disabled={saving || !title.trim() || !dealId} className="h-9 rounded-[6px] border-0 bg-ui-btn-accent px-6 text-[13px] font-medium text-ui-btn-accent-fg hover:opacity-90 disabled:opacity-50">
            {saving ? 'Adding…' : 'Add task'}
          </button>
        </div>
      </form>
    </div>
  );
}
