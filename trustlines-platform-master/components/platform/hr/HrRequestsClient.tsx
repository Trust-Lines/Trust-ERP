'use client';

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowDownUp, Inbox, Paperclip, Plus, Search, X } from 'lucide-react';
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
import type { HrAbsenceReason, HrRequest, HrRequestFile, HrRequestPriority } from './types';
import { newId, useHrLocal } from './HrData';
import { HrRequestDetail } from './HrRequestDetail';
import { PRIORITY, PRIORITY_RANK, REASON, STATUS, forLabel, initials, requestDays } from './requestStyles';
import { dayKey } from './tones';

// Figma "Requests" (node 565:15743) + detail (565:17594): leave requests as cards; a card opens
// the request to approve or reject it. No HR backend yet: requests live in this tab (HrData).
// "Active" = waiting for a decision; "History" = approved or rejected.

export interface HrRequestPerson {
  id: string;
  full_name: string;
  role: string | null;
  created_at: string | null;
}

type Tab = 'active' | 'history';
type SortKey = 'newest' | 'oldest' | 'date';

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
// Dialog dropdowns: 40px tall, 14px text, 16px chevron (the shared Select draws a 12px one by default).
const DIALOG_SELECT = 'h-10 w-full px-3 text-[14px] rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg text-ui-heading [&_.ui-select-chevron]:size-4';
const TOOLBAR_SELECT ='inline-flex h-10 w-auto cursor-pointer items-center gap-2 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pr-3 text-[13px] font-medium text-[var(--color-secondary-700)] dark:rounded-[6px] dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg dark:pr-3 dark:text-ui-heading [&_svg]:size-3.5';

export function HrRequestsClient({ people }: { people: HrRequestPerson[] }) {
  const [today] = useState(() => new Date());
  const { requests, addRequest, updateRequest } = useHrLocal();
  const [tab, setTab] = useState<Tab>('active');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [priority, setPriority] = useState('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = requests.find(r => r.id === openId) ?? null;

  const activeCount = requests.filter(r => r.status === 'pending').length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = requests.filter(r =>
      (tab === 'active') === (r.status === 'pending') &&
      (!priority || r.priority === priority) &&
      (!q || `${r.name} ${r.role ?? ''} ${REASON[r.reason].label}`.toLowerCase().includes(q)));
    return [...rows].sort((a, b) => {
      if (sortBy === 'date') return a.date.localeCompare(b.date) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      return sortBy === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt);
    });
  }, [requests, tab, query, priority, sortBy]);

  const vacationDaysUsed = useMemo(() => {
    if (!opened) return 0;
    return requests
      .filter(r => r.status === 'approved' && r.reason === 'vacation' && (opened.userId ? r.userId === opened.userId : r.name === opened.name))
      .reduce((sum, r) => sum + requestDays(r), 0);
  }, [requests, opened]);

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
          <p className="m-0 text-[13px] text-ui-body">Track work, and keep every request moving.</p>
        </div>
        <button
          type="button" onClick={() => setCreating(true)}
          className="inline-flex h-9 items-center gap-2 rounded-[6px] border-0 bg-ui-btn-accent px-3.5 text-[13px] font-medium text-ui-btn-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring"
        >
          <Plus size={16} aria-hidden /> New request
        </button>
      </div>

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
        </div>

        {/* ── Cards ── */}
        {visible.length === 0 ? (
          <EmptyState
            boxed
            icon={<Inbox />}
            title={requests.length === 0 ? 'No requests yet' : tab === 'active' ? 'No requests waiting' : 'No decided requests'}
            description={tab === 'active' ? 'Sick calls and vacation requests waiting for a decision show here.' : 'Approved and rejected requests show here.'}
            action={tab === 'active' ? <Button onClick={() => setCreating(true)}><Plus aria-hidden /> New request</Button> : undefined}
          />
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 2xl:grid-cols-3">
            {visible.map(r => <li key={r.id}><RequestCard request={r} today={today} onOpen={() => setOpenId(r.id)} /></li>)}
          </ul>
        )}
      </div>

      <NewRequestDialog open={creating} onOpenChange={setCreating} people={people} today={today} onCreate={addRequest} />
      <HrRequestDetail
        request={opened}
        onOpenChange={o => { if (!o) setOpenId(null); }}
        vacationDaysUsed={vacationDaysUsed}
        onDecide={(id, status, note) => updateRequest(id, { status, decisionNote: note, decidedAt: new Date().toISOString() })}
      />
    </div>
  );
}

function RequestCard({ request: r, today, onOpen }: { request: HrRequest; today: Date; onOpen: () => void }) {
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
            <span className={cn('truncate text-[20px] font-semibold tracking-[-0.44px]', HEADING)}>{r.name}</span>
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

const ACCEPT = 'application/pdf,image/*';

function NewRequestDialog({ open, onOpenChange, people, today, onCreate }: {
  open: boolean; onOpenChange: (open: boolean) => void; people: HrRequestPerson[]; today: Date;
  onCreate: (r: Omit<HrRequest, 'id' | 'createdAt' | 'status'>) => void;
}) {
  const formId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [personId, setPersonId] = useState('');
  const [reason, setReason] = useState<HrAbsenceReason>('sick');
  const [priority, setPriority] = useState<HrRequestPriority>('medium');
  const [date, setDate] = useState(() => dayKey(today));
  const [endDate, setEndDate] = useState(() => dayKey(today));
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<HrRequestFile[]>([]);
  // Files not handed to a request are released when the form resets or unmounts.
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => { filesRef.current.forEach(f => URL.revokeObjectURL(f.url)); }, []);

  const reset = (keepFiles = false) => {
    if (!keepFiles) files.forEach(f => URL.revokeObjectURL(f.url));
    setPersonId(''); setReason('sick'); setPriority('medium');
    setDate(dayKey(today)); setEndDate(dayKey(today)); setDescription(''); setFiles([]);
  };
  const person = people.find(p => p.id === personId);
  const rangeOk = !!date && !!endDate && endDate >= date;
  const canSubmit = !!person && rangeOk;
  const fileLabel = reason === 'sick' ? 'Medical Report' : 'Attachment';

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles(prev => [...prev, ...Array.from(list).map(f => ({ id: newId(), name: f.name, type: f.type, url: URL.createObjectURL(f), label: null }))]);
  };
  const removeFile = (id: string) => setFiles(prev => {
    const f = prev.find(x => x.id === id);
    if (f) URL.revokeObjectURL(f.url);
    return prev.filter(x => x.id !== id);
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!person || !rangeOk) return;
    onCreate({
      userId: person.id, name: person.full_name, role: person.role ? roleLabel(person.role) : null,
      joinedAt: person.created_at, reason, priority, date, endDate,
      description: description.trim() || null,
      files: files.map(f => ({ ...f, label: fileLabel })),
    });
    onOpenChange(false);
    reset(true);
  };

  return (
    <Modal open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset(); }}>
      <ModalContent
        title="New request"
        description="Log a sick call or a vacation request."
        footer={<>
          <p className="m-0 mr-auto text-[13px] text-ui-text-secondary">Kept on this device until HR saving is connected.</p>
          <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button type="submit" form={formId} disabled={!canSubmit}>Add request</Button>
        </>}
      >
        <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
            <label htmlFor={`${formId}-person`}>Staff member</label>
            <Select
              id={`${formId}-person`} className={DIALOG_SELECT} value={personId} onValueChange={v => setPersonId(v ?? '')}
              placeholder={people.length ? 'Choose a person' : 'No staff found'} disabled={people.length === 0}
              options={people.map(p => ({ value: p.id, label: p.role ? `${p.full_name} · ${roleLabel(p.role)}` : p.full_name }))}
              listClassName="max-h-[min(280px,var(--available-height))]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
              <label htmlFor={`${formId}-reason`}>Type</label>
              <Select
                id={`${formId}-reason`} className={DIALOG_SELECT} value={reason} onValueChange={v => v && setReason(v as HrAbsenceReason)}
                options={(Object.keys(REASON) as HrAbsenceReason[]).map(k => ({ value: k, label: REASON[k].label }))}
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
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
              From
              <Input type="date" required value={date} onChange={e => { setDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }} />
            </label>
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
              To
              <Input type="date" required min={date} value={endDate} aria-invalid={!rangeOk || undefined} onChange={e => setEndDate(e.target.value)} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
            Details
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Anything HR should know" />
          </label>
          <div className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
            <span>Attached files</span>
            {files.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {files.map(f => (
                  <li key={f.id} className="flex items-center gap-2 rounded-[4px] bg-ui-surface px-2 py-1 text-[12px] font-normal text-ui-body">
                    <Paperclip size={16} aria-hidden className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <button type="button" onClick={() => removeFile(f.id)} aria-label={`Remove ${f.name}`} className="grid size-6 cursor-pointer place-items-center rounded-[4px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg">
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            <Button type="button" variant="outline" className="self-start" onClick={() => fileInput.current?.click()}>
              <Paperclip aria-hidden /> Add files
            </Button>
            <p className="m-0 text-[11px] font-normal text-ui-text-secondary">PDF or images, e.g. a medical report.</p>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
