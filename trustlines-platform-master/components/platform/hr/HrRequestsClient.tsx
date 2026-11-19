'use client';

import { useId, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowDownUp, Inbox, Plus, Search } from 'lucide-react';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { roleLabel } from '@/components/platform/shell/Sidebar';
import { PersonFace } from '@/components/ui/avatar-directory';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { HrPunchKind, HrRequestPriority, HrRequestReason, HrSavedRequest } from './types';
import { HrRequestDetail } from './HrRequestDetail';
import { PRIORITY, PRIORITY_RANK, PUNCH_LABEL, REASON, STATUS, forLabel, initials, requestDays } from './requestStyles';
import { dayKey } from './tones';
import { HEADING } from '@/components/platform/shared/panelStyles';

// Figma "Requests" (node 565:15743) + detail (565:17594): leave and clock-correction requests as
// cards — the same hr_requests the mobile app writes (POST / PATCH /api/hr/requests). I see my own
// and those of the people I manage; a card opens the request to approve / reject (if I manage the
// person) or cancel (mine, while pending). "Active" = pending; "History" = decided or cancelled.

type Tab = 'active' | 'history';
type SortKey = 'newest' | 'oldest' | 'date';
type Scope = 'all' | 'mine' | 'team';

// Dialog dropdowns: 40px tall, 14px text, 16px chevron (the shared Select draws a 12px one by default).
const DIALOG_SELECT = 'h-10 w-full px-3 text-[14px] rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg text-ui-heading [&_.ui-select-chevron]:size-4';
const TOOLBAR_SELECT ='inline-flex h-10 w-auto cursor-pointer items-center gap-2 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pr-3 text-[13px] font-medium text-[var(--color-secondary-700)] dark:rounded-[6px] dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg dark:pr-3 dark:text-ui-heading [&_svg]:size-3.5';

async function send(url: string, method: 'POST' | 'PATCH', body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) return null;
    const j = await res.json().catch(() => null) as { error?: string } | null;
    return j?.error ?? `Request failed (${res.status})`;
  } catch {
    return 'Network error — try again';
  }
}

export function HrRequestsClient({ requests: raw, hasTeam, error }: {
  requests: HrSavedRequest[];
  /** I manage someone — show the Mine / My team filter. */
  hasTeam: boolean;
  error: string | null;
}) {
  const router = useRouter();
  const [today] = useState(() => new Date());
  const requests = useMemo(() => raw.map(r => ({ ...r, role: r.role ? roleLabel(r.role) : null })), [raw]);
  const [tab, setTab] = useState<Tab>('active');
  const [scope, setScope] = useState<Scope>('all');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [priority, setPriority] = useState('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = requests.find(r => r.id === openId) ?? null;

  const activeCount = requests.filter(r => r.status === 'pending' && (r.canDecide || r.mine)).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = requests.filter(r =>
      (tab === 'active') === (r.status === 'pending') &&
      (scope === 'all' || (scope === 'mine') === r.mine) &&
      (!priority || r.priority === priority) &&
      (!q || `${r.name} ${r.role ?? ''} ${REASON[r.reason].label}`.toLowerCase().includes(q)));
    return [...rows].sort((a, b) => {
      if (sortBy === 'date') return a.date.localeCompare(b.date) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      return sortBy === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt);
    });
  }, [requests, tab, scope, query, priority, sortBy]);

  const vacationDaysUsed = useMemo(() => {
    if (!opened) return 0;
    const year = opened.date.slice(0, 4);
    return requests
      .filter(r => r.status === 'approved' && r.reason === 'vacation' && r.userId === opened.userId && r.date.startsWith(year))
      .reduce((sum, r) => sum + requestDays(r), 0);
  }, [requests, opened]);

  async function act(id: string, action: 'approve' | 'reject' | 'cancel', note: string | null): Promise<boolean> {
    const err = await send(`/api/hr/requests/${id}`, 'PATCH', { action, note });
    if (err) { toast.error(err); return false; }
    toast.success(action === 'approve' ? 'Request approved' : action === 'reject' ? 'Request rejected' : 'Request cancelled');
    setOpenId(null);
    router.refresh();
    return true;
  }

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-[5px] leading-[1.35]">
          <PageCrumbs items={[{ label: 'Human Resources', href: '/hr' }, { label: 'Requests', href: '/hr/requests' }]} />
          <h1 className={cn('m-0 flex items-center gap-2.5 text-[28px] font-semibold leading-[1.35]', HEADING)}>
            Requests
            <span aria-label={`${activeCount} waiting`} className={cn('inline-flex min-w-[22px] items-center justify-center rounded-full bg-ui-surface px-[9px] py-[3px] text-[12px] font-semibold leading-[1.4]', HEADING)}>
              {activeCount}
            </span>
          </h1>
          <p className="m-0 text-[13px] text-ui-body">
            {hasTeam ? 'Your requests and the ones from people you manage.' : 'Ask for leave or a clock correction; your manager decides.'}
          </p>
        </div>
        <button
          type="button" onClick={() => setCreating(true)} disabled={!!error}
          className="inline-flex h-9 items-center gap-2 rounded-[6px] border-0 bg-ui-btn-accent px-3.5 text-[13px] font-medium text-ui-btn-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring disabled:opacity-50"
        >
          <Plus size={16} aria-hidden /> New request
        </button>
      </div>

      {error && (
        <p role="alert" className="m-0 rounded-[6px] border border-ui-divider bg-ui-surface-elevated px-4 py-3 text-[13px] text-ui-body">{error}</p>
      )}

      <div className="flex flex-col gap-6">
        {/* ── Tabs ── */}
        <div role="tablist" aria-label="Requests" className="flex h-12 items-center gap-8 border-b border-ui-divider">
          {([['active', 'Active Requests'], ['history', 'History']] as const).map(([key, label]) => (
            <button
              key={key} type="button" role="tab" aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                'flex h-full cursor-pointer items-center border-0 border-b-[3px] bg-transparent p-0 text-[13px] leading-[1.4]',
                tab === key ? cn('border-[var(--color-secondary-700)] font-semibold dark:border-ui-heading', HEADING) : 'border-transparent text-ui-text-secondary hover:text-ui-body',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-[380px] max-w-full">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
            <input
              type="search" aria-label="Search requests" placeholder="Search requests…"
              value={query} onChange={e => setQuery(e.target.value)}
              className="h-10 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] leading-[1.45] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
            />
          </div>
          <div className="relative">
            <ArrowDownUp aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--color-secondary-700)] dark:text-ui-heading" />
            <Select
              aria-label="Sort"
              className={cn(TOOLBAR_SELECT, 'pl-[34px] dark:pl-[34px]')}
              value={sortBy}
              onValueChange={v => setSortBy((v ?? 'newest') as SortKey)}
              options={[
                { value: 'newest', label: 'Newest' },
                { value: 'oldest', label: 'Oldest' },
                { value: 'date', label: 'By date' },
              ]}
            />
          </div>
          <Select
            aria-label="Priority"
            className={cn(TOOLBAR_SELECT, 'pl-3 dark:pl-3')}
            value={priority}
            onValueChange={v => setPriority(v ?? '')}
            options={[{ value: '', label: 'Priority' }, ...(Object.keys(PRIORITY) as HrRequestPriority[]).map(p => ({ value: p, label: PRIORITY[p].label }))]}
          />
          {hasTeam && (
            <Select
              aria-label="Whose requests"
              className={cn(TOOLBAR_SELECT, 'pl-3 dark:pl-3')}
              value={scope}
              onValueChange={v => setScope((v ?? 'all') as Scope)}
              options={[{ value: 'all', label: 'Everyone' }, { value: 'team', label: 'My team' }, { value: 'mine', label: 'Mine' }]}
            />
          )}
        </div>

        {/* ── Cards ── */}
        {visible.length === 0 ? (
          <EmptyState
            boxed
            icon={<Inbox />}
            title={requests.length === 0 ? 'No requests yet' : tab === 'active' ? 'No requests waiting' : 'No decided requests'}
            description={tab === 'active' ? 'Leave and clock-correction requests waiting for a decision show here.' : 'Approved, rejected and cancelled requests show here.'}
            action={tab === 'active' && !error ? <Button onClick={() => setCreating(true)}><Plus aria-hidden /> New request</Button> : undefined}
          />
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 2xl:grid-cols-3">
            {visible.map(r => <li key={r.id}><RequestCard request={r} today={today} onOpen={() => setOpenId(r.id)} /></li>)}
          </ul>
        )}
      </div>

      <NewRequestDialog
        open={creating} onOpenChange={setCreating} today={today}
        onCreated={() => { setTab('active'); router.refresh(); }}
      />
      <HrRequestDetail
        request={opened}
        onOpenChange={o => { if (!o) setOpenId(null); }}
        vacationDaysUsed={vacationDaysUsed}
        onDecide={(id, status, note) => act(id, status === 'approved' ? 'approve' : 'reject', note)}
        onCancel={id => act(id, 'cancel', null)}
      />
    </div>
  );
}

function RequestCard({ request: r, today, onOpen }: { request: HrSavedRequest; today: Date; onOpen: () => void }) {
  const badge = r.status === 'pending' ? PRIORITY[r.priority] : STATUS[r.status];
  const reason = REASON[r.reason];
  const Icon = reason.icon;
  return (
    <button
      type="button" onClick={onOpen}
      aria-label={`${reason.label}: ${r.name}, ${badge.label}. Open request`}
      className="flex w-full cursor-pointer flex-col gap-4 rounded-[11px] border border-ui-divider bg-ui-surface-elevated py-2.5 pl-2.5 pr-3.5 text-left font-inherit transition-colors hover:border-[var(--ui-input-border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring"
    >
      <span className="flex w-full items-start justify-between gap-3">
        <span className="flex min-w-0 items-start gap-2.5">
          <span className="flex size-[53px] shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-[var(--status-t0-fg)] text-[15px] font-semibold text-white dark:text-primary-950">
            <PersonFace name={r.name} userId={r.userId} fallback={initials(r.name)} />
          </span>
          <span className="flex min-w-0 flex-col justify-center">
            <span className={cn('truncate text-[20px] font-semibold tracking-[-0.44px]', HEADING)}>
              {r.name}{r.mine && <span className="ml-1.5 text-[13px] font-medium text-ui-text-secondary">(you)</span>}
            </span>
            {r.role && <span className="truncate text-[14px] tracking-[-0.308px] text-ui-text-secondary">{r.role}</span>}
          </span>
        </span>
        <span className="shrink-0 rounded-[4px] px-2.5 py-0.5 text-[16px] font-medium leading-[1.4]" style={{ background: badge.bg, color: badge.fg }}>
          {badge.label}
        </span>
      </span>
      <span className="flex w-full flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 rounded-[4px] py-0.5 pl-1.5 pr-2 text-[16px] font-medium leading-[1.4]" style={{ background: reason.bg, color: reason.fg }}>
          <Icon size={16} aria-hidden /> {reason.label}
        </span>
        <span className="flex items-center gap-1 whitespace-nowrap text-[16px] leading-[1.4]">
          <span className="text-ui-text-secondary">For:</span>
          <span className={cn('font-medium', HEADING)}>{forLabel(r.date, today)}</span>
        </span>
      </span>
    </button>
  );
}

const TYPES: HrRequestReason[] = ['vacation', 'sick', 'personal', 'correction'];
const PUNCHES: HrPunchKind[] = ['in', 'break_start', 'break_end', 'out'];

/** A request for myself — POST /api/hr/requests (validated by lib/hr/requests validateRequest). */
function NewRequestDialog({ open, onOpenChange, today, onCreated }: {
  open: boolean; onOpenChange: (open: boolean) => void; today: Date; onCreated: () => void;
}) {
  const formId = useId();
  const [type, setType] = useState<HrRequestReason>('vacation');
  const [priority, setPriority] = useState<HrRequestPriority>('medium');
  const [date, setDate] = useState(() => dayKey(today));
  const [endDate, setEndDate] = useState(() => dayKey(today));
  const [punch, setPunch] = useState<HrPunchKind>('in');
  const [punchAt, setPunchAt] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const isCorrection = type === 'correction';
  const reset = () => {
    setType('vacation'); setPriority('medium'); setDate(dayKey(today)); setEndDate(dayKey(today));
    setPunch('in'); setPunchAt(''); setDescription('');
  };
  const rangeOk = !!date && !!endDate && endDate >= date;
  const canSubmit = !saving && (isCorrection ? !!punchAt && !!description.trim() : rangeOk);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    const body = isCorrection
      // datetime-local is the browser's local time; send it as an instant.
      ? { kind: 'correction', correction_kind: punch, correction_at: new Date(punchAt).toISOString(), priority, description: description.trim() }
      : { kind: 'leave', reason: type, start_date: date, end_date: endDate, priority, description: description.trim() || null };
    const err = await send('/api/hr/requests', 'POST', body);
    setSaving(false);
    if (err) { toast.error(err); return; }
    toast.success('Request sent to your manager');
    onOpenChange(false);
    reset();
    onCreated();
  };

  return (
    <Modal open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset(); }}>
      <ModalContent
        title="New request"
        description="Ask for leave or fix a missed clock punch. Your manager decides."
        footer={<>
          <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button type="submit" form={formId} disabled={!canSubmit}>{saving ? 'Sending…' : 'Send request'}</Button>
        </>}
      >
        <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
              <label htmlFor={`${formId}-type`}>Type</label>
              <Select
                id={`${formId}-type`} className={DIALOG_SELECT} value={type} onValueChange={v => v && setType(v as HrRequestReason)}
                options={TYPES.map(k => ({ value: k, label: REASON[k].label }))}
              />
            </div>
            <div className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
              <label htmlFor={`${formId}-priority`}>Priority</label>
              <Select
                id={`${formId}-priority`} className={DIALOG_SELECT} value={priority} onValueChange={v => v && setPriority(v as HrRequestPriority)}
                options={(Object.keys(PRIORITY) as HrRequestPriority[]).map(k => ({ value: k, label: PRIORITY[k].label }))}
              />
            </div>
          </div>
          {isCorrection ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
                <label htmlFor={`${formId}-punch`}>Punch</label>
                <Select
                  id={`${formId}-punch`} className={DIALOG_SELECT} value={punch} onValueChange={v => v && setPunch(v as HrPunchKind)}
                  options={PUNCHES.map(k => ({ value: k, label: PUNCH_LABEL[k] }))}
                />
              </div>
              <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
                When
                <Input type="datetime-local" required className="h-10 text-[14px]" value={punchAt} onChange={e => setPunchAt(e.target.value)} />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
                From
                <Input type="date" required className="h-10 text-[14px] [&::-webkit-calendar-picker-indicator]:size-4" value={date} onChange={e => { setDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }} />
              </label>
              <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
                To
                <Input type="date" required className="h-10 text-[14px] [&::-webkit-calendar-picker-indicator]:size-4" min={date} value={endDate} aria-invalid={!rangeOk || undefined} onChange={e => setEndDate(e.target.value)} />
              </label>
            </div>
          )}
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
            {isCorrection ? 'Why (required)' : 'Details'}
            <Textarea
              value={description} onChange={e => setDescription(e.target.value)} rows={3} maxLength={1000}
              required={isCorrection}
              placeholder={isCorrection ? 'e.g. Forgot to clock in, arrived at 09:00' : 'Anything your manager should know'}
              className="text-[14px]"
            />
          </label>
          {isCorrection && <p className="m-0 text-[11px] text-ui-text-secondary">Corrections can go back 31 days. Once approved, the punch is added to your shift record.</p>}
        </form>
      </ModalContent>
    </Modal>
  );
}
