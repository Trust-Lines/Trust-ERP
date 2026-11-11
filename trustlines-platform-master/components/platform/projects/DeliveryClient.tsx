'use client';

import { useState } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { DeliveryPlan, ProjectStage, PunchListItem } from '@/types/database';
import { DELIVERY_METHODS, DELIVERY_STATUSES, BUILD_BY } from '@/lib/delivery/config';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ProjectSubpageHeader } from './ProjectSubpageHeader';

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const CARD = 'flex min-w-0 flex-col rounded-[8px] border border-ui-divider bg-ui-page-bg px-5 pb-5 pt-4';
const TITLE = cn('m-0 text-[20px] font-semibold leading-[1.45]', HEADING);
const LABEL = 'text-[12px] font-medium leading-4 text-ui-body';
const FIELD = 'h-[42px] w-full rounded-[6px] border border-ui-input-border bg-ui-input-bg px-3 text-[14px] text-[var(--color-secondary-700)] outline-none placeholder:text-ui-text-disabled focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring disabled:cursor-not-allowed disabled:opacity-60 dark:text-ui-heading';
const SELECT = 'h-[42px] w-full rounded-[6px] border-ui-input-border bg-ui-input-bg px-3 text-[14px] text-[var(--color-secondary-700)] dark:rounded-[6px] dark:border-ui-input-border dark:bg-ui-input-bg dark:px-3 dark:text-ui-heading [&_svg]:size-4';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '30 Oct 2026' like the frame. */
const dMonY = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const toISODate = (d: Date | null) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;
const parseISODate = (s: string | null | undefined) => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };

export interface SiteReadinessBadge { overall_status: string; target_ready_date: string | null }
export interface ContainerBadge {
  id: string; container_no: string | null; status: string; estimated_arrival_date: string | null;
}

interface Props {
  projectId: string; projectCode: string; projectName: string; stage?: ProjectStage | null; canEdit: boolean;
  initialPlan: DeliveryPlan | null;
  initialPunchList: PunchListItem[];
  schemaError: string | null;
  siteReadiness?: SiteReadinessBadge | null;
  containers?: ContainerBadge[];
}

const cap = (s: string) => s.replace(/_/g, ' ');
const label = (k: string) => cap(k).replace(/\b\w/g, c => c.toUpperCase());

const ARRIVED = new Set(['ARRIVED_PORT', 'WAREHOUSE', 'RELEASED', 'COMPLETED']);

export function DeliveryClient({
  projectId, projectCode, projectName, stage = null, canEdit, initialPlan, initialPunchList, schemaError,
  siteReadiness = null, containers = [],
}: Props) {
  const [plan, setPlan] = useState<DeliveryPlan | null>(initialPlan);
  const [punch, setPunch] = useState<PunchListItem[]>(initialPunchList);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [acceptName, setAcceptName] = useState('');

  const method = plan?.delivery_method ?? 'warehouse';
  const status = plan?.status ?? 'planning';
  const openPunch = punch.filter(p => p.status === 'open').length;
  const completed = status === 'completed';

  async function patchPlan(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/delivery-plan`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
      setPlan(b.deliveryPlan);
      if (b.completed) toast.success('Project marked delivered & complete');
    } finally { setBusy(false); }
  }

  async function addPunch(title: string, description: string) {
    const res = await fetch(`/api/projects/${projectId}/punch-list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description }) });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
    setPunch(p => [b.item, ...p]); setAdding(false); toast.success('Punch item added');
  }
  async function togglePunch(item: PunchListItem) {
    const res = await fetch(`/api/projects/${projectId}/punch-list/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: item.status === 'done' ? 'open' : 'done' }) });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
    setPunch(p => p.map(x => x.id === item.id ? b.item : x));
  }
  async function delPunch(itemId: string) {
    const res = await fetch(`/api/projects/${projectId}/punch-list/${itemId}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed'); return; }
    setPunch(p => p.filter(x => x.id !== itemId)); toast.success('Removed');
  }

  const ro = !canEdit || busy;
  const textField = (v: string | null, k: string, aria: string) => (
    <input
      type="text" aria-label={aria} placeholder="type.." defaultValue={v ?? ''} disabled={ro} className={FIELD}
      onBlur={e => { if (e.target.value !== (v ?? '')) void patchPlan({ [k]: e.target.value }); }}
    />
  );
  const chips = [
    ...(siteReadiness ? [{
      key: 'site', ok: siteReadiness.overall_status === 'ready', icon: siteReadiness.overall_status === 'ready' ? CheckCircle2 : Circle,
      text: siteReadiness.overall_status === 'ready' ? 'Site ready'
        : `Site ${cap(siteReadiness.overall_status)}${siteReadiness.target_ready_date ? ` — target ${siteReadiness.target_ready_date}` : ''}`,
    }] : []),
    ...containers.map(c => ({
      key: c.id, ok: ARRIVED.has(c.status), icon: PackageCheck,
      text: `${c.container_no ?? 'Container'} — ${label(c.status)}${!ARRIVED.has(c.status) && c.estimated_arrival_date ? ` — ETA ${c.estimated_arrival_date}` : ''}`,
    })),
  ];

  return (
    <>
      <ProjectSubpageHeader projectId={projectId} code={projectCode} name={projectName} stage={stage} active="delivery" />

      {schemaError && (
        <div role="alert" className="mb-4 rounded-[8px] border border-error-normal p-3 text-[13px] text-error-normal" style={{ background: 'var(--status-danger-bg)' }}>{schemaError}</div>
      )}

      {/* Figma 472:22833: Delivery & build plan, Punch List, Customer Acceptance & Completion — full-width cards. */}
      <div className="flex flex-col gap-[18px] font-[family-name:var(--font-ui)]">
        <section aria-labelledby="delivery-plan" className={cn(CARD, 'gap-6')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="delivery-plan" className={TITLE}>Delivery &amp; build plan</h2>
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chips.map(({ key, ok, icon: Icon, text }) => (
                  <span key={key} className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-[3px] text-[11px] font-medium leading-4"
                    style={{ background: `var(--status-${ok ? 't9' : 't0'}-bg)`, color: `var(--status-${ok ? 't9' : 't0'}-fg)` }}>
                    <Icon className="size-3" aria-hidden />{text}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-x-3 gap-y-[18px] sm:grid-cols-2 xl:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <span className={LABEL}>Delivery method</span>
              <Select aria-label="Delivery method" className={SELECT} value={method} disabled={ro}
                options={DELIVERY_METHODS.map(m => ({ value: m, label: label(m) }))} onValueChange={v => { if (v) void patchPlan({ delivery_method: v }); }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={LABEL}>Status</span>
              <Select aria-label="Status" className={SELECT} value={status} disabled={ro}
                options={DELIVERY_STATUSES.map(s => ({ value: s, label: label(s) }))} onValueChange={v => { if (v) void patchPlan({ status: v }); }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={LABEL}>Installation Date</span>
              <DatePicker
                aria-label="Installation date" placeholder="Pick a date" disabled={ro} iconEnd formatValue={dMonY}
                className={cn(SELECT, 'w-full justify-between')}
                value={parseISODate(plan?.installation_date)} onValueChange={d => void patchPlan({ installation_date: toISODate(d) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={LABEL}>Built By</span>
              <Select aria-label="Built by" className={SELECT} value={plan?.build_by ?? ''} disabled={ro}
                options={[{ value: '', label: '—' }, ...BUILD_BY.map(b => ({ value: b, label: label(b) }))]}
                onValueChange={v => void patchPlan({ build_by: v || null })} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5"><span className={LABEL}>Build schedule</span>{textField(plan?.build_schedule ?? null, 'build_schedule', 'Build schedule')}</label>
            <label className="flex flex-col gap-1.5"><span className={LABEL}>Notes</span>{textField(plan?.notes ?? null, 'notes', 'Notes')}</label>
          </div>

          <label className={cn('inline-flex items-center gap-2 self-start text-[12px] font-medium text-ui-body', ro ? 'cursor-default' : 'cursor-pointer')}>
            <Checkbox className="size-4 rounded-[3px]" checked={plan?.site_confirmed ?? false} disabled={ro}
              onCheckedChange={c => void patchPlan({ site_confirmed: !!c })} />
            Site Confirmed Ready
          </label>
        </section>

        <section aria-labelledby="punch-list" className={cn(CARD, 'gap-4')}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="punch-list" className={TITLE} title={`${openPunch} open`}>Punch List ({punch.length})</h2>
            {canEdit && !adding && (
              <button type="button" onClick={() => setAdding(true)}
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[6px] border-0 bg-ui-btn-accent pl-3.5 pr-6 text-[13px] font-medium text-ui-btn-accent-fg hover:opacity-90">
                <Plus size={16} aria-hidden /> Add Item
              </button>
            )}
          </div>
          {adding && canEdit && <PunchForm onSave={addPunch} onCancel={() => setAdding(false)} />}
          {punch.length === 0 && !adding ? (
            <p className="m-0 text-[14px] text-ui-body">No punch items</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {punch.map(it => {
                const done = it.status === 'done';
                return (
                  <li key={it.id} className="flex items-start gap-2 border-b border-ui-divider py-2.5 last:border-b-0">
                    <span className="flex w-9 shrink-0 justify-center pt-0.5">
                      <Checkbox className="size-4 rounded-[3px]" checked={done} disabled={!canEdit}
                        onCheckedChange={() => void togglePunch(it)} aria-label={done ? `Reopen ${it.title}` : `Mark ${it.title} done`} />
                    </span>
                    <div className={cn('flex min-w-0 flex-1 flex-col gap-0.5', done && 'opacity-60')}>
                      <span className={cn('text-[13px] font-semibold', HEADING, done && 'line-through')}>{it.title}</span>
                      {it.description && <span className="text-[12px] text-ui-text-secondary">{it.description}</span>}
                    </div>
                    {canEdit && (
                      <button type="button" onClick={() => delPunch(it.id)} aria-label={`Remove ${it.title}`}
                        className="grid size-7 cursor-pointer place-items-center rounded-[4px] border-0 bg-transparent text-error-normal hover:bg-ui-hover-bg">
                        <Trash2 size={14} aria-hidden />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="delivery-acceptance" className={cn(CARD, 'gap-6')}>
          <h2 id="delivery-acceptance" className={TITLE}>Customer Acceptance &amp; Completion</h2>

          {plan?.customer_accepted ? (
            <p className="m-0 flex flex-wrap items-center gap-2 text-[13px]" style={{ color: 'var(--status-t9-fg)' }}>
              <CheckCircle2 className="size-4" aria-hidden />
              Accepted{plan.accepted_by ? ` by ${plan.accepted_by}` : ''}{plan.accepted_at ? ` on ${new Date(plan.accepted_at).toLocaleDateString()}` : ''}.
              {canEdit && <Button variant="ghost" size="sm" disabled={busy} onClick={() => patchPlan({ accept: false })}>Undo</Button>}
            </p>
          ) : !canEdit ? (
            <p className="m-0 text-[13px] text-ui-text-secondary">Not yet accepted.</p>
          ) : null}

          {canEdit && (
            <div className="flex flex-wrap items-end gap-3">
              {!plan?.customer_accepted && (
                <>
                  <label className="flex w-full flex-col gap-1.5 sm:w-[443px]">
                    <span className={LABEL}>Accepted by (customer)</span>
                    <input className={FIELD} value={acceptName} onChange={e => setAcceptName(e.target.value)} placeholder="type.." />
                  </label>
                  <button type="button" disabled={busy || !acceptName.trim()} onClick={() => patchPlan({ accept: true, acceptedBy: acceptName.trim() })}
                    className="inline-flex h-[42px] cursor-pointer items-center rounded-[6px] border border-[var(--color-secondary-700)] bg-ui-page-bg px-4 text-[13px] font-medium text-[var(--color-secondary-700)] hover:bg-ui-hover-bg disabled:cursor-not-allowed disabled:opacity-50 dark:border-ui-heading dark:text-ui-heading">
                    Record Acceptance
                  </button>
                </>
              )}
              {completed ? (
                <span className="inline-flex h-[42px] items-center gap-2 text-[13px] text-ui-text-secondary"><PackageCheck className="size-4" aria-hidden /> Project is delivered &amp; complete.</span>
              ) : (
                <button type="button" disabled={busy || openPunch > 0 || !plan?.customer_accepted} onClick={() => patchPlan({ complete: true })}
                  className="inline-flex h-[42px] cursor-pointer items-center gap-2 rounded-[6px] border-0 bg-[var(--color-secondary-700)] px-4 text-[13px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-50 dark:text-primary-950">
                  <PackageCheck className="size-4" aria-hidden /> Mark Delivered and Complete
                </button>
              )}
            </div>
          )}
          {!completed && canEdit && (openPunch > 0 || !plan?.customer_accepted) && (
            <p className="-mt-3 mb-0 text-[11px] text-ui-text-secondary">
              {openPunch > 0 && `Close ${openPunch} open punch item${openPunch !== 1 ? 's' : ''}. `}{!plan?.customer_accepted && 'Record customer acceptance first.'}
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function PunchForm({ onSave, onCancel }: { onSave: (title: string, description: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  return (
    <div className="flex flex-col gap-3 rounded-[6px] border border-ui-divider bg-ui-surface p-3.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr]">
        <label className="flex flex-col gap-1.5"><span className={LABEL}>Title *</span>
          <input className={FIELD} value={title} onChange={e => setTitle(e.target.value)} autoFocus /></label>
        <label className="flex flex-col gap-1.5"><span className={LABEL}>Description</span>
          <input className={FIELD} value={description} onChange={e => setDescription(e.target.value)} /></label>
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={!title.trim()} onClick={() => onSave(title.trim(), description.trim())}
          className="inline-flex h-9 cursor-pointer items-center rounded-[6px] border-0 bg-ui-btn-accent px-4 text-[13px] font-medium text-ui-btn-accent-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Add</button>
        <button type="button" onClick={onCancel}
          className="inline-flex h-9 cursor-pointer items-center rounded-[6px] border border-ui-divider bg-transparent px-4 text-[13px] font-medium text-ui-body hover:bg-ui-hover-bg">Cancel</button>
      </div>
    </div>
  );
}
