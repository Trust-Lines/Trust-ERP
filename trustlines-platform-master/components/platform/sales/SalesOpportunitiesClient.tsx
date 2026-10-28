'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, Inbox, Plus, Search } from 'lucide-react';
import { REGIONS, SERVICE_LINES } from '@/lib/regions';
import { OPPORTUNITY_STAGE_LABEL, PROJECT_TYPE_LABEL } from '@/lib/marketing/classification';
import type { OpportunityStage, ProjectType, ScopeType } from '@/types/database';
import { Select } from '@/components/platform/shared/Select';
import { Select as FilterSelect } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { OpportunityQuickView } from '@/components/platform/marketing/OpportunityQuickView';
import { feedback } from '@/components/ui/feedback-toast';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

export interface SalesOpportunityRow {
  id: string;
  prospect_id: string;
  need_id: string;
  title: string;
  project_types: ProjectType[];
  scope_types: ScopeType[];
  stage: OpportunityStage;
  deadline: string | null;
  sales_owner_id: string | null;
  sales_handoff_at: string | null;
  sales_accepted_at: string | null;
  project_id: string | null;
  return_reason: string | null;
  closed_reason: string | null;
  created_at: string;
  updated_at: string;
  lead_display_name: string;
  owner_name: string | null;
  design_job: { status: string; designerName: string | null; updatedAt: string } | null;
}

const DESIGN_STATUS_LABEL: Record<string, string> = {
  awaiting_assignment: 'Awaiting a designer', assigned: 'Assigned, not started', working_on_it: 'In progress',
  ready_for_sales_review: 'Ready for your review', revision_requested: 'Revision requested',
  approved_by_sales: 'Approved', presented_to_customer: 'Presented to customer', completed: 'Completed', cancelled: 'Cancelled',
};

function daysAgo(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

interface Props {
  initialOpportunities: SalesOpportunityRow[];
  currentUserId: string;
  loadError?: boolean;
  /** People a task can be assigned to inside the pop-up. */
  assignees?: { id: string; full_name: string }[];
}

// Each Opportunity stage borrows the tone + icon of the closest lead-stage status tag
// (lib/status/tags.ts); the label stays the Opportunity stage name.
const STAGE_TAG: Record<OpportunityStage, string> = {
  new: 'new_lead', marketing_qualification: 'qualification', qualified_for_sales: 'qualified',
  sales_handoff: 'qualified', sales_accepted: 'contacted', discovery: 'discovery', sales_design: 'proposal_preparation',
  working_on_it_trust: 'proposal_preparation', proposal: 'proposal_sent', negotiation: 'negotiation',
  closed_won: 'won', closed_lost: 'lost', on_hold: 'decision_pending',
};
const CLOSABLE_STAGES: OpportunityStage[] = ['sales_accepted', 'discovery', 'sales_design', 'proposal', 'negotiation'];
const CLOSED_STAGES: OpportunityStage[] = ['closed_won', 'closed_lost'];
function OpportunityStagePill({ stage }: { stage: OpportunityStage }) {
  return (
    <StatusBadge
      group="lead_stage" status={STAGE_TAG[stage]} label={OPPORTUNITY_STAGE_LABEL[stage]}
      className="h-auto gap-1 py-[3px] pl-2 pr-2.5 text-[12px] leading-4 [&_svg]:size-3.5"
    />
  );
}

// Figma "Opportunity handoffs" (node 299:8256).
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const FILTER_CLS = 'inline-flex h-9 w-auto shrink-0 cursor-pointer items-center gap-1 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-3 pr-2 text-[13px] font-medium leading-normal text-[var(--color-secondary-700)] dark:rounded-[6px] dark:text-ui-heading [&_svg]:size-3.5';
// 40px row action. Tones follow the Figma Close Lost (T10) / Close Won (T9) buttons; disabled = T0.
const ACTION_BASE = 'inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-[6px] border px-8 text-[13px] font-medium no-underline transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:border-[var(--status-t0-fg)] disabled:bg-[var(--status-t0-bg)] disabled:text-[var(--status-t0-fg)] disabled:opacity-100';
// Literal class strings — Tailwind can't see classes built at runtime.
const ACTION_WON = cn(ACTION_BASE, 'border-[var(--status-t9-fg)] bg-[var(--status-t9-bg)] text-[var(--status-t9-fg)]');
const ACTION_LOST = cn(ACTION_BASE, 'border-[var(--status-t10-fg)] bg-[var(--status-t10-bg)] text-[var(--status-t10-fg)]');
const ACTION_NEUTRAL = cn(ACTION_BASE, 'border-[var(--ui-input-border)] bg-ui-input-bg text-[var(--color-secondary-700)] dark:text-ui-heading');
const ACTION_PRIMARY = cn(ACTION_BASE, 'border-transparent bg-[var(--color-secondary-700)] text-white dark:bg-primary-50 dark:text-primary-950');

type StageFilter = '' | 'open' | 'closed';

export function SalesOpportunitiesClient({ initialOpportunities, loadError, assignees = [] }: Props) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null); // deal shown in the progress pop-up
  const [opportunities, setOpportunities] = useState<SalesOpportunityRow[]>(initialOpportunities);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<StageFilter>('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return opportunities.filter(o => {
      const closed = CLOSED_STAGES.includes(o.stage);
      if (stageFilter === 'open' && closed) return false;
      if (stageFilter === 'closed' && !closed) return false;
      return !q || `${o.title} ${o.lead_display_name} ${o.owner_name ?? ''}`.toLowerCase().includes(q);
    });
  }, [opportunities, query, stageFilter]);

  function updateRow(id: string, patch: Partial<SalesOpportunityRow>) {
    setOpportunities(prev => prev.map(o => (o.id === id ? { ...o, ...patch } : o)));
  }

  // POST one row action. A network error comes back as ok:false, so busyId is always cleared.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each action returns its own shape
  async function act(id: string, action: string, payload?: unknown): Promise<{ ok: boolean; body: Record<string, any> }> {
    setBusyId(id);
    try {
      const res = await fetch(`/api/sales/opportunities/${id}/${action}`, {
        method: 'POST',
        ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}),
      });
      return { ok: res.ok, body: await res.json().catch(() => ({})) };
    } catch {
      return { ok: false, body: { error: 'Network error — check your connection and try again' } };
    } finally {
      setBusyId(null);
    }
  }

  async function doAccept(id: string, form: { region: string; service_line: string; city: string; street: string; state: string; customer_name: string }) {
    const { ok, body } = await act(id, 'accept', form);
    if (!ok) { toast.error(body.error ?? 'Failed to accept'); return; }
    updateRow(id, { stage: body.opportunity.stage, project_id: body.opportunity.project_id });
    setAcceptingId(null);
    feedback.success(body.alreadyAccepted ? 'Already accepted' : 'Project created', {
      description: body.project?.code ? `${body.project.code} is ready for the delivery team.` : undefined,
      action: body.project?.id ? { label: 'View project', href: `/projects/${body.project.id}` } : undefined,
    });
  }

  async function doReturn(id: string, reason: string) {
    if (!reason.trim()) { toast.error('A reason is required'); return; }
    const { ok, body } = await act(id, 'return', { reason });
    if (!ok) { toast.error(body.error ?? 'Failed to return'); return; }
    updateRow(id, { stage: body.opportunity.stage, return_reason: body.opportunity.return_reason });
    setReturningId(null);
    toast.success('Returned to Marketing');
  }

  async function doCloseWon(o: SalesOpportunityRow) {
    // Closing Won hands the project to delivery and notifies the PMs — not a one-click accident.
    if (!window.confirm(`Close "${o.title}" as Won? The project moves on to the delivery team.`)) return;
    const id = o.id;
    const { ok, body } = await act(id, 'close-won');
    if (!ok) { toast.error(body.error ?? 'Failed to close won'); return; }
    updateRow(id, { stage: body.opportunity.stage });
    toast.success('Closed Won');
  }

  async function doStartDesign(id: string) {
    const { ok, body } = await act(id, 'start-design');
    if (!ok) { toast.error(body.error ?? 'Failed to start Design'); return; }
    updateRow(id, { stage: 'discovery' });
    toast.success('Design job started — assign a designer on the Design page');
  }

  async function doNegotiate(id: string) {
    const { ok, body } = await act(id, 'negotiate');
    if (!ok) { toast.error(body.error ?? 'Failed to move to Negotiation'); return; }
    updateRow(id, { stage: body.opportunity.stage });
    toast.success('Moved to Negotiation');
  }

  async function doCloseLost(id: string) {
    const reason = window.prompt('Reason for Closed Lost:');
    if (!reason?.trim()) return;
    const { ok, body } = await act(id, 'close-lost', { reason: reason.trim() });
    if (!ok) { toast.error(body.error ?? 'Failed to close lost'); return; }
    updateRow(id, { stage: body.opportunity.stage, closed_reason: body.opportunity.closed_reason });
    toast.success('Closed Lost');
  }

  if (loadError) {
    return (
      <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
        <AlertTriangle size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
        <div>Sales Handoff isn&apos;t ready yet. Migration 078 needs to be applied.</div>
      </div></div>
    );
  }

  return (
    <div className="flex flex-col gap-[30px]">
      {/* ── Page heading ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-[5px] leading-[1.35]">
          <p className="m-0 text-[11px] font-semibold text-ui-nav-active">Sales / Handoffs</p>
          <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Opportunity Handoffs</h1>
          <p className="m-0 text-[13px] text-ui-body">
            {opportunities.length} opportunit{opportunities.length !== 1 ? 'ies' : 'y'} handed off from Marketing or already yours
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/leads"
            className={cn('inline-flex h-9 items-center rounded-[6px] border border-[var(--color-secondary-700)] px-5 text-[13px] font-medium leading-[1.35] no-underline transition-colors hover:bg-ui-hover-bg dark:border-ui-heading', HEADING)}
          >
            Opportunity List
          </Link>
          <Link
            href="/leads/new?view=quick_deal"
            className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-ui-btn-accent px-8 text-[13px] font-medium leading-[1.35] text-ui-btn-accent-fg no-underline transition-opacity hover:opacity-90"
          >
            <Plus size={16} aria-hidden />
            Quick Deal
          </Link>
        </div>
      </div>

      {/* ── Search + filter ── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-[285px] max-w-full">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
          <input
            type="search" aria-label="Search handoffs" placeholder="Search handoffs…"
            value={query} onChange={e => setQuery(e.target.value)}
            className="h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] leading-[1.45] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
          />
        </div>
        <FilterSelect
          aria-label="Stage"
          className={FILTER_CLS}
          value={stageFilter}
          onValueChange={v => setStageFilter((v ?? '') as StageFilter)}
          options={[
            { value: '', label: 'All handoffs' },
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Won & Lost' },
          ]}
        />
      </div>

      {/* ── Handoff list ── */}
      <div className="rounded-[8px] bg-ui-surface p-5">
        {visible.length === 0 ? (
          <div className="rounded-[6px] bg-ui-surface-elevated">
            {opportunities.length === 0 ? (
              <EmptyState icon={<Inbox />} title="No handoffs yet" description="Opportunities appear here once Marketing hands one off to Sales." />
            ) : (
              <EmptyState icon={<Search />} title="No matching handoffs" description="Try another search or filter." />
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {visible.map(o => {
              const busy = busyId === o.id;
              return (
                <div key={o.id} className="rounded-[6px] bg-ui-surface-elevated px-5 py-3">
                  <div className="flex flex-wrap items-center gap-3.5">
                    <div
                      role="button" tabIndex={0} title="See how this deal has progressed"
                      onClick={() => setOpenId(o.id)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(o.id); } }}
                      className="flex min-w-[240px] flex-1 cursor-pointer flex-col items-start gap-[3px] rounded-[4px] outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring"
                    >
                      <p className="m-0 text-[13px] font-semibold leading-[1.4] text-ui-body">{o.title}</p>
                      <p className="m-0 text-[11px] leading-[1.4] text-ui-text-secondary">
                        Lead: {o.lead_display_name}
                        {o.deadline && ` · Deadline: ${o.deadline}`}
                        {o.owner_name && ` · Owner: ${o.owner_name}`}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <OpportunityStagePill stage={o.stage} />
                        {o.project_types.map(t => (
                          <span key={t} className="rounded-[4px] bg-[var(--status-t0-bg)] px-2 py-[3px] text-[12px] font-medium leading-4 text-[var(--status-t0-fg)]">{PROJECT_TYPE_LABEL[t]}</span>
                        ))}
                      </div>
                      {o.return_reason && o.stage === 'marketing_qualification' && (
                        <p className="m-0 text-[11px] text-[var(--status-warning-fg)]">Returned: {o.return_reason}</p>
                      )}
                      {o.closed_reason && o.stage === 'closed_lost' && (
                        <p className="m-0 text-[11px] text-ui-text-secondary">Lost reason: {o.closed_reason}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3.5">
                      {o.stage === 'sales_handoff' && acceptingId !== o.id && returningId !== o.id && (
                        <>
                          <button type="button" className={ACTION_NEUTRAL} onClick={() => setReturningId(o.id)}>Return to Marketing</button>
                          <button type="button" className={ACTION_PRIMARY} onClick={() => setAcceptingId(o.id)}>Accept</button>
                        </>
                      )}
                      {o.project_id && (
                        <Link href={`/projects/${o.project_id}`} className={ACTION_NEUTRAL}>View project</Link>
                      )}
                      {CLOSABLE_STAGES.includes(o.stage) && (
                        <>
                          {(o.stage === 'discovery' || o.stage === 'sales_design' || o.stage === 'proposal') && o.design_job && (
                            <span className={cn(
                              'rounded-[4px] px-2 py-[3px] text-[12px] font-medium leading-4',
                              o.design_job.status === 'revision_requested'
                                ? 'bg-[var(--status-t7-bg)] text-[var(--status-t7-fg)]'
                                : 'bg-[var(--status-t0-bg)] text-[var(--status-t0-fg)]',
                            )}>
                              {DESIGN_STATUS_LABEL[o.design_job.status] ?? o.design_job.status}
                              {o.design_job.designerName && ` · ${o.design_job.designerName}`}
                              {' · updated '}{daysAgo(o.design_job.updatedAt)}
                            </span>
                          )}
                          {o.stage === 'sales_accepted' && (
                            <button type="button" className={ACTION_NEUTRAL} disabled={busy} onClick={() => doStartDesign(o.id)}>Start Design</button>
                          )}
                          {(o.stage === 'discovery' || o.stage === 'sales_design' || o.stage === 'proposal') && (
                            <Link href="/design" className={ACTION_NEUTRAL}>Open Design Job</Link>
                          )}
                          {o.stage === 'proposal' && (
                            <button type="button" className={ACTION_NEUTRAL} disabled={busy} onClick={() => doNegotiate(o.id)}>Move to Negotiation</button>
                          )}
                          <button type="button" className={ACTION_LOST} disabled={busy} onClick={() => doCloseLost(o.id)}>Close Lost</button>
                          {/* Close Won needs the Project that Accept creates (lib/marketing/salesHandoff.ts → 409) — QA DEF-17. */}
                          <button type="button" className={ACTION_WON} disabled={busy || !o.project_id}
                            title={o.project_id ? undefined : 'Accept the Opportunity first — Close Won needs a Project'}
                            onClick={() => doCloseWon(o)}>Close Won</button>
                        </>
                      )}
                    </div>
                  </div>

                  {o.stage === 'sales_handoff' && acceptingId === o.id && (
                    <AcceptForm busy={busy} defaultCustomer={o.lead_display_name} onSave={form => doAccept(o.id, form)} onCancel={() => setAcceptingId(null)} />
                  )}
                  {o.stage === 'sales_handoff' && returningId === o.id && (
                    <ReturnForm busy={busy} onSave={reason => doReturn(o.id, reason)} onCancel={() => setReturningId(null)} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {openId && (
        <OpportunityQuickView
          opportunityId={openId}
          assignees={assignees}
          onClose={() => { setOpenId(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function AcceptForm({ busy, defaultCustomer = '', onSave, onCancel }: { busy: boolean; defaultCustomer?: string; onSave: (f: { region: string; service_line: string; city: string; street: string; state: string; customer_name: string }) => void; onCancel: () => void }) {
  const [region, setRegion] = useState('');
  const [serviceLine, setServiceLine] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [state, setState] = useState('');
  const [customerName, setCustomerName] = useState(defaultCustomer);

  const canSubmit = region && serviceLine && city.trim() && state.trim() && customerName.trim();

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 8, paddingTop: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label required" style={{ fontSize: 12 }}>Region</label>
          <Select className="form-input" value={region} onChange={e => setRegion(e.target.value)}>
            <option value="">—</option>
            {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
          </Select></div>
        <div><label className="form-label required" style={{ fontSize: 12 }}>Service line</label>
          <Select className="form-input" value={serviceLine} onChange={e => setServiceLine(e.target.value)}>
            <option value="">—</option>
            {SERVICE_LINES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select></div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label className="form-label required" style={{ fontSize: 12 }}>Customer name</label>
        <input className="form-input" value={customerName} onChange={e => setCustomerName(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label required" style={{ fontSize: 12 }}>City</label>
          <input className="form-input" value={city} onChange={e => setCity(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Street</label>
          <input className="form-input" value={street} onChange={e => setStreet(e.target.value)} /></div>
        <div><label className="form-label required" style={{ fontSize: 12 }}>State</label>
          <input className="form-input" value={state} onChange={e => setState(e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={!canSubmit || busy}
          onClick={() => onSave({ region, service_line: serviceLine, city, street, state, customer_name: customerName })}>
          {busy ? 'Creating project…' : 'Accept & create project'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function ReturnForm({ busy, onSave, onCancel }: { busy: boolean; onSave: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 8, paddingTop: 10 }}>
      <label className="form-label required" style={{ fontSize: 12 }}>Reason for returning to Marketing</label>
      <textarea className="form-input" rows={2} value={reason} onChange={e => setReason(e.target.value)} style={{ marginBottom: 10 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={!reason.trim() || busy} onClick={() => onSave(reason)}>{busy ? 'Sending…' : 'Return'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
