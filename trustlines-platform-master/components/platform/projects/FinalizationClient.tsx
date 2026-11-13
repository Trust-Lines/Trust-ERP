'use client';

import { useState } from 'react';
import {
  Activity, Banknote, CalendarClock, CircleHelp, FilePen, Layers, Package, PenTool, Plus, Ruler, Trash2, type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/ui/status-badge';
import { CHANGE_REQUEST_STATUS_TAG, statusLabel } from '@/lib/status/tags';
import type { ChangeRequest, ProjectStage, SiteReadiness, SiteReadinessItem } from '@/types/database';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { ProjectSubpageHeader } from './ProjectSubpageHeader';

interface Contact { id: string; name: string }
interface TimelineEvent { kind: string; at: string; title: string; detail?: string }
interface Props {
  projectId: string; projectCode: string; projectName: string; stage?: ProjectStage | null; canEdit: boolean;
  initialChangeRequests: ChangeRequest[];
  initialSiteReadiness: SiteReadiness | null;
  siteTemplate: SiteReadinessItem[];
  contacts: Contact[];
  timeline?: TimelineEvent[];
  schemaError: string | null;
}

// Figma "PM Finalization" (481:24797): project header + tabs, then Requests | Site Readiness side by side,
// then Communication Timeline. Frontend only — same props and the same API calls as before.
const CARD = 'flex min-w-0 flex-col rounded-[8px] border border-ui-divider bg-ui-page-bg px-5 pb-5 pt-4';
const TITLE = 'm-0 flex items-center gap-2 text-[20px] font-semibold leading-[1.35] text-[var(--color-secondary-700)] dark:text-ui-heading';
const SMALL_SELECT = 'h-[27px] w-auto min-w-[74px] gap-3 rounded-[6px] border-ui-input-border bg-ui-input-bg px-3 text-[12px] tracking-[-0.264px] text-[var(--color-secondary-700)] dark:rounded-[6px] dark:text-ui-heading [&_svg]:size-3';
const FIELD = 'w-full rounded-[6px] border border-ui-input-border bg-ui-input-bg px-3 text-[13px] text-ui-heading outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring';

const EVENT_LABEL: Record<string, string> = {
  change_request: 'Change request', meeting: 'Meeting', follow_up: 'Follow-up', stage: 'Stage',
};

const CR_STATUSES = ['open', 'under_review', 'approved', 'rejected', 'implemented', 'cancelled'];
const CR_CATEGORIES = ['scope', 'design', 'budget', 'timeline', 'material', 'other'];
const CATEGORY_ICON: Record<string, LucideIcon> = {
  scope: Ruler, design: PenTool, budget: Banknote, timeline: CalendarClock, material: Package, other: CircleHelp,
};
const cap = (s: string) => s.replace(/_/g, ' ');
const capFirst = (s: string) => { const t = cap(s); return t[0].toUpperCase() + t.slice(1); };
const toISODate = (d: Date | null) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;
const parseISODate = (s: string | null | undefined) => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
/** '26/10/2026' like the frame. */
const dmy = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };

function CrStatusPill({ status }: { status: string }) {
  // Figma Status Language "Change Request": tone + icon + label from lib/status/tags.ts.
  return <StatusBadge group="change_request" status={CHANGE_REQUEST_STATUS_TAG[status] ?? status} label={CHANGE_REQUEST_STATUS_TAG[status] ? undefined : statusLabel(status)} />;
}

function CategoryChip({ category }: { category: string }) {
  const Icon = CATEGORY_ICON[category] ?? Layers;
  return (
    <span
      className="inline-flex h-[17px] shrink-0 items-center gap-1 rounded-[3px] pl-1 pr-1.5 text-[10px] font-medium leading-4"
      style={{ background: 'var(--status-t4-bg)', color: 'var(--status-t4-fg)' }}
    >
      <Icon size={10} aria-hidden />{capFirst(category)}
    </span>
  );
}

export function FinalizationClient({
  projectId, projectCode, projectName, stage = null, canEdit,
  initialChangeRequests, initialSiteReadiness, siteTemplate, contacts, timeline = [], schemaError,
}: Props) {
  const [crs, setCrs] = useState<ChangeRequest[]>(initialChangeRequests);
  const [site, setSite] = useState<SiteReadiness | null>(initialSiteReadiness);
  const [addingCr, setAddingCr] = useState(false);
  const [busy, setBusy] = useState(false);

  const checklist = site?.checklist ?? siteTemplate;
  const siteDone = checklist.filter(i => i.done).length;
  const nameOf = (id: string | null) => (id ? contacts.find(c => c.id === id)?.name ?? null : null);

  async function createCr(payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/change-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Failed'); return false; }
      setCrs(p => [b.changeRequest, ...p]);
      setAddingCr(false);
      toast.success('Change request added');
      return true;
    } finally { setBusy(false); }
  }

  async function patchCr(crId: string, patch: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/change-requests/${crId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
      setCrs(p => p.map(c => c.id === crId ? b.changeRequest : c));
    } finally { setBusy(false); }
  }

  async function deleteCr(crId: string) {
    if (!window.confirm('Remove this change request?')) return;
    const res = await fetch(`/api/projects/${projectId}/change-requests/${crId}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed to remove'); return; }
    setCrs(p => p.filter(c => c.id !== crId));
    toast.success('Removed');
  }

  async function patchSite(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/site-readiness`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
      setSite(b.siteReadiness);
    } finally { setBusy(false); }
  }

  const siteStatus = site?.overall_status ?? 'not_ready';
  const statusOptions = CR_STATUSES.map(s => ({ value: s, label: capFirst(s) }));

  return (
    <>
      <ProjectSubpageHeader projectId={projectId} code={projectCode} name={projectName} stage={stage} active="finalization" />

      {schemaError && (
        <div className="mb-4 rounded-[8px] border border-error-normal p-3 text-[13px] text-error-normal" style={{ background: 'var(--status-danger-bg)' }}>{schemaError}</div>
      )}

      <div className="flex flex-col gap-[18px]">
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,565fr)_minmax(0,971fr)]">
          {/* ── Requests (Figma 481:25137) ── */}
          <section className={CARD}>
            <div className="flex min-h-[42px] items-center justify-between gap-3 border-b border-ui-divider pb-4">
              <h2 className={TITLE}>Requests <span>({crs.length})</span></h2>
              {canEdit && !addingCr && (
                <button
                  type="button" onClick={() => setAddingCr(true)}
                  className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-[6px] border-0 bg-ui-btn-accent pl-3.5 pr-6 text-[13px] font-medium text-ui-btn-accent-fg hover:opacity-90"
                >
                  <Plus size={16} aria-hidden /> Add Request
                </button>
              )}
            </div>

            {addingCr && canEdit && <div className="mt-3"><CrForm contacts={contacts} onSave={createCr} onCancel={() => setAddingCr(false)} /></div>}

            {crs.length === 0 && !addingCr ? (
              <EmptyState size="sm" className="py-8" icon={<FilePen />} title="No change requests yet." />
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {crs.map(cr => {
                  const by = nameOf(cr.customer_contact_id);
                  const meta = [
                    dmy(cr.created_at),
                    cr.description,
                    by && `Requested by ${by}`,
                    cr.budget_impact != null && `Budget: ${cr.currency ?? ''} ${Number(cr.budget_impact).toLocaleString()}`.replace('  ', ' '),
                    cr.timeline_impact_days != null && `Timeline: ${cr.timeline_impact_days > 0 ? '+' : ''}${cr.timeline_impact_days}d`,
                  ].filter(Boolean).join('  ·  ');
                  return (
                    <li
                      key={cr.id}
                      className={cn('flex items-center justify-between gap-3 border-b border-ui-divider px-1 py-3 last:border-b-0', ['cancelled', 'rejected'].includes(cr.status) && 'opacity-60')}
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate text-[16px] font-semibold leading-[1.4] text-[var(--color-secondary-700)] dark:text-ui-heading">{cr.title}</span>
                          {cr.category && <CategoryChip category={cr.category} />}
                        </div>
                        <span className="whitespace-pre-wrap text-[11px] leading-[1.4] text-ui-text-secondary">{meta}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {canEdit ? (
                          <>
                            <Select aria-label={`${cr.title} status`} className={SMALL_SELECT} options={statusOptions} value={cr.status}
                              disabled={busy} onValueChange={v => { if (v) void patchCr(cr.id, { status: v }); }} />
                            <button
                              type="button" onClick={() => deleteCr(cr.id)} aria-label={`Remove ${cr.title}`}
                              className="grid size-7 cursor-pointer place-items-center rounded-[4px] border-0 bg-transparent text-error-normal hover:bg-ui-hover-bg"
                            >
                              <Trash2 size={14} aria-hidden />
                            </button>
                          </>
                        ) : <CrStatusPill status={cr.status} />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ── Site Readiness (Figma 481:24997) ── */}
          <section className={CARD}>
            <div className="flex min-h-[42px] flex-wrap items-center justify-between gap-3 border-b border-ui-divider pb-4">
              {/* Figma 481:25306: title + count only; the overall status stays readable on hover. */}
              <h2 className={TITLE} title={`Overall: ${cap(siteStatus)}`}>
                Site Readiness <span>({siteDone}/{checklist.length})</span>
              </h2>
              <label className="flex items-center gap-2">
                <span className="text-[12px] font-medium leading-4 text-ui-body">Target Ready Date</span>
                <DatePicker
                  aria-label="Target ready date" placeholder="mm/dd/yyyy" disabled={!canEdit || busy}
                  className="h-[42px] w-[184px] flex-row-reverse justify-between rounded-[6px] border-ui-input-border bg-ui-input-bg px-3 text-[14px] text-[var(--color-secondary-700)] dark:rounded-[6px] dark:text-ui-heading [&_svg]:size-4"
                  value={parseISODate(site?.target_ready_date)} onValueChange={d => void patchSite({ target_ready_date: toISODate(d) })}
                />
              </label>
            </div>
            <ul className="m-0 flex list-none flex-col p-0">
              {checklist.map(item => (
                <li key={item.key} className="border-b border-ui-divider last:border-b-0">
                  <label className={cn('flex items-center py-2.5', canEdit && !busy ? 'cursor-pointer' : 'cursor-default')}>
                    <span className="flex w-9 shrink-0 justify-center">
                      <Checkbox
                        checked={item.done} disabled={!canEdit || busy}
                        onCheckedChange={() => void patchSite({ toggle: item.key })} aria-label={item.label}
                      />
                    </span>
                    <span className={cn('truncate pr-2.5 text-[12px] font-medium text-ui-body', item.done && 'text-ui-text-secondary line-through')}>{item.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Communication Timeline (Figma 481:25078) ── */}
        <section className={cn(CARD, 'gap-4 pb-6')}>
          <h2 className={cn(TITLE, 'leading-[1.45]')}>Communication Timeline</h2>
          {timeline.length === 0 ? (
            <EmptyState size="sm" icon={<Activity />} title="Nothing recorded yet." description="Meetings, follow-ups, change requests and stage changes show up here." />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {timeline.map((e, i) => (
                <li key={i} className="flex items-start gap-1">
                  {/* Figma 481:25306: the bullet takes the heading colour (navy light / white dark); the kind is in the meta line. */}
                  <span className="mt-[5px] size-[7px] shrink-0 rounded-full bg-[var(--color-secondary-700)] dark:bg-ui-heading" aria-hidden />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[14px] font-semibold tracking-[-0.308px] text-[var(--color-secondary-700)] dark:text-ui-heading">{e.title}</span>
                    <span className="whitespace-pre-wrap text-[12px] leading-4 text-ui-body">
                      {[EVENT_LABEL[e.kind] ?? e.kind, e.detail, new Date(e.at).toLocaleDateString()].filter(Boolean).join('  ·  ')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function CrForm({ contacts, onSave, onCancel }: { contacts: Contact[]; onSave: (p: Record<string, unknown>) => Promise<boolean>; onCancel: () => void }) {
  const [f, setF] = useState({ title: '', description: '', category: '', customer_contact_id: '', budget_impact: '', timeline_impact_days: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF(p => ({ ...p, [k]: e.target.value }));
  const pick = (k: keyof typeof f) => (v: string | null) => setF(p => ({ ...p, [k]: v ?? '' }));

  async function submit() {
    if (!f.title.trim()) return;
    setSaving(true);
    await onSave({
      title: f.title.trim(), description: f.description.trim() || null,
      category: f.category || null, customer_contact_id: f.customer_contact_id || null,
      budget_impact: f.budget_impact === '' ? null : Number(f.budget_impact),
      timeline_impact_days: f.timeline_impact_days === '' ? null : Number(f.timeline_impact_days),
    });
    setSaving(false);
  }

  const label = 'text-[12px] font-medium leading-4 text-ui-body';
  const sel = 'h-10 w-full rounded-[6px] border-ui-input-border bg-ui-input-bg px-3 text-[13px] dark:rounded-[6px]';
  return (
    <div className="flex flex-col gap-3 rounded-[6px] border border-ui-divider bg-ui-surface p-3.5">
      <label className="flex flex-col gap-1.5">
        <span className={label}>Title *</span>
        <input className={cn(FIELD, 'h-10')} placeholder="e.g. Move cashier wall" value={f.title} onChange={set('title')} autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className={label}>Category</span>
          <Select aria-label="Category" className={sel} value={f.category} onValueChange={pick('category')}
            options={[{ value: '', label: '—' }, ...CR_CATEGORIES.map(c => ({ value: c, label: capFirst(c) }))]} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={label}>Requested by</span>
          <Select aria-label="Requested by" className={sel} value={f.customer_contact_id} onValueChange={pick('customer_contact_id')}
            options={[{ value: '', label: '—' }, ...contacts.map(c => ({ value: c.id, label: c.name }))]} />
        </div>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Description</span>
        <textarea className={cn(FIELD, 'resize-y py-2')} rows={2} value={f.description} onChange={set('description')} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Budget impact (Δ)</span>
          <input type="number" step="0.01" className={cn(FIELD, 'h-10')} placeholder="0" value={f.budget_impact} onChange={set('budget_impact')} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Timeline impact (days)</span>
          <input type="number" className={cn(FIELD, 'h-10')} placeholder="0" value={f.timeline_impact_days} onChange={set('timeline_impact_days')} />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={!f.title.trim() || saving}
          className="inline-flex h-9 cursor-pointer items-center rounded-[6px] border-0 bg-ui-btn-accent px-4 text-[13px] font-medium text-ui-btn-accent-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? 'Saving…' : 'Add'}
        </button>
        <button type="button" onClick={onCancel}
          className="inline-flex h-9 cursor-pointer items-center rounded-[6px] border border-ui-divider bg-transparent px-4 text-[13px] font-medium text-ui-body hover:bg-ui-hover-bg">
          Cancel
        </button>
      </div>
    </div>
  );
}
