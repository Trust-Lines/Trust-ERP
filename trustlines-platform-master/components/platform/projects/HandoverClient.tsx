'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CircleCheck, Contact, Hourglass, X, Plus, Users, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { HandoverChecklistItem, ProjectHandover, ProjectStage } from '@/types/database';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ProjectSubpageHeader } from './ProjectSubpageHeader';

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const CARD = 'flex flex-col rounded-[8px] border border-ui-divider bg-ui-page-bg';

interface Summary {
  tlines_pm: string | null; trustlines_pm: string | null; ops_manager: string | null; pm_supervisor: string | null;
  dropbox_root_path: string | null; closed_deal_date: string | null; deal_value: number | null; currency: string | null; scope_summary: string | null;
}
interface Attached { id: string; customer_contact_id: string; role_on_project: string | null; is_primary: boolean }
interface ContactInfo { id: string; name: string; title: string | null; email: string | null; phone: string | null }
interface AvailContact { id: string; name: string; title: string | null }

interface Props {
  projectId: string; projectCode: string; projectName: string; stage: ProjectStage | null; canEdit: boolean;
  summary: Summary;
  initialHandover: ProjectHandover | null;
  template: HandoverChecklistItem[];
  derived: Record<string, boolean>;
  autoKeys: string[];
  customer: { id: string; name: string } | null;
  initialAttached: Attached[];
  contactMap: Record<string, ContactInfo>;
  initialAvailable: AvailContact[];
}

/** Status-chip look (same tone tokens + icon + label as <StatusBadge>) for states with no status group. */
function ToneChip({ tone, icon: Icon, size = 'md', children }: { tone: string; icon: LucideIcon; size?: 'sm' | 'md'; children: React.ReactNode }) {
  return (
    <span
      className={size === 'sm'
        ? 'ml-0.5 inline-flex h-5 shrink-0 items-center gap-1 rounded-tag px-2 text-[10px] font-medium leading-[1.5] whitespace-nowrap [&_svg]:size-3'
        : 'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-tag px-3 text-[12px] font-medium leading-[1.5] whitespace-nowrap [&_svg]:size-3.5'}
      style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}
    >
      <Icon aria-hidden />
      {children}
    </span>
  );
}

export function HandoverClient(props: Props) {
  const { projectId, projectCode, projectName, stage, canEdit, summary, template, derived, autoKeys, customer, contactMap } = props;
  const [handover, setHandover] = useState<ProjectHandover | null>(props.initialHandover);
  const [attached, setAttached] = useState<Attached[]>(props.initialAttached);
  const [available, setAvailable] = useState<AvailContact[]>(props.initialAvailable);
  const [busy, setBusy] = useState(false);

  const auto = new Set(autoKeys);
  const rawChecklist: HandoverChecklistItem[] = handover?.checklist ?? template;
  const checklist = rawChecklist.map(i => auto.has(i.key) ? { ...i, done: !!derived[i.key] } : i);
  const doneCount = checklist.filter(i => i.done).length;
  const complete = handover?.status === 'complete';

  async function patch(bodyObj: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/handover`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyObj),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Failed'); return null; }
      setHandover(body.handover);
      return body.handover as ProjectHandover;
    } finally { setBusy(false); }
  }

  async function attach(c: AvailContact) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/customer-contacts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerContactId: c.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Failed to attach'); return; }
      setAttached(prev => [...prev, body.link]);
      setAvailable(prev => prev.filter(a => a.id !== c.id));
      toast.success(`Attached ${c.name}`);
    } finally { setBusy(false); }
  }

  async function detach(a: Attached) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/customer-contacts/${a.id}`, { method: 'DELETE' });
      if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed to detach'); return; }
      setAttached(prev => prev.filter(x => x.id !== a.id));
      const ci = contactMap[a.customer_contact_id];
      if (ci) setAvailable(prev => [...prev, { id: ci.id, name: ci.name, title: ci.title }].sort((x, y) => x.name.localeCompare(y.name)));
      toast.success('Detached');
    } finally { setBusy(false); }
  }

  const money = summary.deal_value != null ? `${summary.currency ?? ''} ${Number(summary.deal_value).toLocaleString()}`.trim() : null;
  const summaryRows: [string, string | null, string][] = [
    ['T Lines PM', summary.tlines_pm, 'Not Set'], ['Trust Lines PM', summary.trustlines_pm, '-'],
    ['Ops Manager', summary.ops_manager, '-'], ['PM Supervisor', summary.pm_supervisor, '-'],
    ['Closed Deal Date', summary.closed_deal_date, '-'], ['Budget', money, '-'],
    ['Scope', summary.scope_summary, '-'], ['Dropbox', summary.dropbox_root_path, '-'],
  ];

  return (
    <>
      <ProjectSubpageHeader projectId={projectId} code={projectCode} name={projectName} stage={stage} active="handover" />

      {/* Figma 472:22208: Handover Summary (379px) + Handover Checklist side by side, Customer and Contacts below. */}
      <div className="flex flex-col gap-[18px] font-[family-name:var(--font-ui)]">
        <div className="flex flex-col items-start gap-4 lg:flex-row">
          <section aria-labelledby="handover-summary" className={cn(CARD, 'w-full pt-3.5 pb-4 pl-4 pr-[18px] lg:w-[379px]')}>
            <h2 id="handover-summary" className={cn('m-0 mb-4 text-[20px] font-semibold leading-normal tracking-[0.4px]', HEADING)}>Handover Summary</h2>
            <dl className="m-0 flex flex-col">
              {summaryRows.map(([k, v, empty], i) => (
                <div key={k} className={cn('flex items-center justify-between gap-4 py-[5px] text-[14px] tracking-[-0.308px]', i > 0 && 'border-t border-ui-divider', HEADING)}>
                  <dt className="shrink-0 font-semibold">{k}</dt>
                  <dd className="m-0 min-w-0 truncate text-right leading-[1.5]" title={v ?? undefined}>{v || empty}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="handover-checklist" className={cn(CARD, 'w-full min-w-0 flex-1 px-5 pt-4 pb-5')}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ui-divider pb-4">
              <div className="flex items-center gap-3">
                <h2 id="handover-checklist" className={cn('m-0 text-[20px] font-semibold leading-[1.35]', HEADING)}>Handover Checklist</h2>
                {complete
                  ? <ToneChip tone="t9" icon={CircleCheck} size="sm">Complete</ToneChip>
                  : <ToneChip tone="t2" icon={Hourglass} size="sm">{doneCount}/{checklist.length}</ToneChip>}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-4">
                <label className="flex items-center gap-2">
                  <span className="text-[12px] font-medium leading-4 text-ui-body">Handover Meeting</span>
                  <input
                    type="datetime-local" disabled={!canEdit || busy}
                    defaultValue={handover?.meeting_at ? handover.meeting_at.slice(0, 16) : ''}
                    onChange={e => patch({ meeting_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="h-[42px] w-[200px] rounded-[6px] border border-ui-input-border bg-ui-input-bg px-3 text-[14px] text-[var(--color-secondary-700)] outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring disabled:cursor-not-allowed disabled:opacity-60 dark:text-ui-heading dark:[color-scheme:dark]"
                  />
                </label>
                {canEdit && (complete
                  ? <Button size="md" onClick={() => patch({ reopen: true })} disabled={busy}>Reopen</Button>
                  : <Button size="md" onClick={() => patch({ complete: true })} disabled={busy}>Mark complete</Button>)}
              </div>
            </div>

            <ul className="m-0 mt-2 flex list-none flex-col p-0">
              {checklist.map(item => {
                const isAuto = auto.has(item.key);
                const clickable = canEdit && !busy && !isAuto;
                return (
                  <li key={item.key} className="flex items-center border-b border-ui-divider py-2.5">
                    <label className={cn('flex items-center gap-1.5', clickable ? 'cursor-pointer' : 'cursor-default')}
                      title={isAuto ? 'Set automatically from the project’s data' : undefined}>
                      <span className="flex w-9 justify-center px-2.5">
                        <Checkbox checked={item.done} disabled={!clickable} onCheckedChange={() => clickable && patch({ toggle: item.key })} />
                      </span>
                      <span className={cn('pr-2.5 text-[12px] font-medium text-ui-body', item.done && 'line-through opacity-70')}>{item.label}</span>
                      <span
                        className="rounded-[4px] border border-solid px-2 py-0.5 text-[11px] leading-[1.4]"
                        style={isAuto
                          ? { background: 'var(--status-t0-bg)', color: 'var(--status-t0-fg)', borderColor: 'var(--status-t0-fg)' }
                          : { background: 'var(--status-t8-bg)', color: 'var(--status-t8-fg)', borderColor: 'var(--status-t8-fg)' }}
                      >
                        {isAuto ? 'AUTO' : 'Manual'}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <section aria-labelledby="handover-contacts" className={cn(CARD, 'p-5')}>
          <h2 id="handover-contacts" className={cn('m-0 mb-4 text-[20px] font-semibold leading-[1.45]', HEADING)}>Customer and Contacts</h2>
          {!customer ? (
            <EmptyState size="sm" icon={<Contact />} title="No customer linked to this project." description="Link one from the originating lead (Customer card on the lead page)." />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <div className={cn('flex items-center gap-1 text-[14px] font-semibold tracking-[-0.308px]', HEADING)}>
                  <Contact className="size-6 shrink-0" strokeWidth={1.5} aria-hidden />
                  <Link href={`/customers/${customer.id}`} className="text-inherit no-underline hover:underline">{customer.name}</Link>
                </div>
                <span className="text-[15px] font-medium leading-4 text-ui-body">Attached to this project</span>
              </div>

              {attached.length === 0 ? (
                <EmptyState size="sm" icon={<Users />} title="No contacts attached yet." />
              ) : attached.map(a => {
                const ci = contactMap[a.customer_contact_id];
                const extra = [ci?.title, ci?.email, ci?.phone].filter(Boolean).join(' · ');
                return (
                  <div key={a.id} className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className={cn('flex min-w-0 items-center gap-1 text-[14px] font-semibold tracking-[-0.308px]', HEADING)}>
                        <Users className="size-6 shrink-0" strokeWidth={1.5} aria-hidden />
                        <span className="truncate">{ci?.name ?? 'Contact'}{extra ? `  ·  ${extra}` : ''}</span>
                      </div>
                      <span className="text-[15px] font-medium leading-4 text-ui-body">Attached to this project</span>
                    </div>
                    {canEdit && (
                      <Button variant="ghost-destructive" size="icon-sm" onClick={() => detach(a)} disabled={busy} aria-label={`Detach ${ci?.name ?? 'contact'}`}>
                        <X aria-hidden />
                      </Button>
                    )}
                  </div>
                );
              })}

              {canEdit && available.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-ui-divider pt-4">
                  <span className="text-[12px] font-medium text-ui-text-secondary">Available to attach</span>
                  <div className="flex flex-wrap gap-2">
                    {available.map(c => (
                      <Button key={c.id} variant="outline" size="sm" onClick={() => attach(c)} disabled={busy}>
                        <Plus aria-hidden /> {c.name}{c.title ? ` · ${c.title}` : ''}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
