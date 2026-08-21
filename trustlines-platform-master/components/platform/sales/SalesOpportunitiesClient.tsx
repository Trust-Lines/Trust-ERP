'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Inbox } from 'lucide-react';
import { REGIONS, SERVICE_LINES } from '@/lib/regions';
import { OPPORTUNITY_STAGE_LABEL, PROJECT_TYPE_LABEL } from '@/lib/marketing/classification';
import { StagePill, type StageTone } from '@/components/platform/shared/StagePill';
import type { OpportunityStage, ProjectType, ScopeType } from '@/types/database';

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
}

interface Props {
  initialOpportunities: SalesOpportunityRow[];
  currentUserId: string;
  loadError?: boolean;
}

const STAGE_TONE: Record<OpportunityStage, StageTone> = {
  new: 'neutral', marketing_qualification: 'neutral', qualified_for_sales: 1,
  sales_handoff: 1, sales_accepted: 2, discovery: 3, sales_design: 4,
  proposal: 5, negotiation: 6, working_on_it_trust: 4,
  closed_won: 'done', closed_lost: 'neutral', on_hold: 'neutral',
};
const CLOSABLE_STAGES: OpportunityStage[] = ['sales_accepted', 'discovery', 'sales_design', 'proposal', 'negotiation'];
function OpportunityStagePill({ stage }: { stage: OpportunityStage }) {
  return <StagePill tone={STAGE_TONE[stage]}>{OPPORTUNITY_STAGE_LABEL[stage]}</StagePill>;
}

export function SalesOpportunitiesClient({ initialOpportunities, loadError }: Props) {
  const [opportunities, setOpportunities] = useState<SalesOpportunityRow[]>(initialOpportunities);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function updateRow(id: string, patch: Partial<SalesOpportunityRow>) {
    setOpportunities(prev => prev.map(o => (o.id === id ? { ...o, ...patch } : o)));
  }

  async function doAccept(id: string, form: { region: string; service_line: string; city: string; street: string; state: string; customer_name: string }) {
    setBusyId(id);
    const res = await fetch(`/api/sales/opportunities/${id}/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) { toast.error(body.error ?? 'Failed to accept'); return; }
    updateRow(id, { stage: body.opportunity.stage, project_id: body.opportunity.project_id });
    setAcceptingId(null);
    toast.success(body.alreadyAccepted ? 'Already accepted' : `Project ${body.project?.code ?? ''} created`);
  }

  async function doReturn(id: string, reason: string) {
    if (!reason.trim()) { toast.error('A reason is required'); return; }
    setBusyId(id);
    const res = await fetch(`/api/sales/opportunities/${id}/return`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
    });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) { toast.error(body.error ?? 'Failed to return'); return; }
    updateRow(id, { stage: body.opportunity.stage, return_reason: body.opportunity.return_reason });
    setReturningId(null);
    toast.success('Returned to Marketing');
  }

  async function doCloseWon(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/sales/opportunities/${id}/close-won`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) { toast.error(body.error ?? 'Failed to close won'); return; }
    updateRow(id, { stage: body.opportunity.stage });
    toast.success('Closed Won');
  }

  async function doStartDesign(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/sales/opportunities/${id}/start-design`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) { toast.error(body.error ?? 'Failed to start Design'); return; }
    updateRow(id, { stage: 'discovery' });
    toast.success('Design job started — assign a designer on the Design page');
  }

  async function doNegotiate(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/sales/opportunities/${id}/negotiate`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) { toast.error(body.error ?? 'Failed to move to Negotiation'); return; }
    updateRow(id, { stage: body.opportunity.stage });
    toast.success('Moved to Negotiation');
  }

  async function doCloseLost(id: string) {
    const reason = window.prompt('Reason for Closed Lost:');
    if (!reason?.trim()) return;
    setBusyId(id);
    const res = await fetch(`/api/sales/opportunities/${id}/close-lost`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
    });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) { toast.error(body.error ?? 'Failed to close lost'); return; }
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
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Opportunity Handoffs</h1>
        <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
          {opportunities.length} opportunit{opportunities.length !== 1 ? 'ies' : 'y'} handed off from Marketing or already yours
        </p>
      </div>

      {opportunities.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
          <Inbox size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <div>No Opportunity handoffs yet. They appear here once Marketing hands one off.</div>
        </div></div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {opportunities.map(o => (
            <div key={o.id} className="card"><div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{o.title}</div>
                <OpportunityStagePill stage={o.stage} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginBottom: 8 }}>
                Lead: {o.lead_display_name} {o.deadline && `· Deadline: ${o.deadline}`} {o.owner_name && `· Owner: ${o.owner_name}`}
              </div>
              {o.project_types.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {o.project_types.map(t => <span key={t} className="pill" style={{ background: 'var(--bg-subtle)', fontSize: 10.5 }}>{PROJECT_TYPE_LABEL[t]}</span>)}
                </div>
              )}
              {o.return_reason && o.stage === 'marketing_qualification' && (
                <div style={{ fontSize: 12, color: 'var(--status-warning-fg, #92400e)', marginBottom: 8 }}>Returned: {o.return_reason}</div>
              )}
              {o.closed_reason && o.stage === 'closed_lost' && (
                <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginBottom: 8 }}>Lost reason: {o.closed_reason}</div>
              )}

              {o.stage === 'sales_handoff' && acceptingId !== o.id && returningId !== o.id && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setAcceptingId(o.id)}>Accept</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setReturningId(o.id)}>Return to Marketing</button>
                </div>
              )}
              {o.stage === 'sales_handoff' && acceptingId === o.id && (
                <AcceptForm busy={busyId === o.id} onSave={form => doAccept(o.id, form)} onCancel={() => setAcceptingId(null)} />
              )}
              {o.stage === 'sales_handoff' && returningId === o.id && (
                <ReturnForm busy={busyId === o.id} onSave={reason => doReturn(o.id, reason)} onCancel={() => setReturningId(null)} />
              )}
              {CLOSABLE_STAGES.includes(o.stage) && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {o.stage === 'sales_accepted' && (
                    <button className="btn btn-secondary btn-sm" disabled={busyId === o.id} onClick={() => doStartDesign(o.id)}>Start Design</button>
                  )}
                  {(o.stage === 'discovery' || o.stage === 'sales_design' || o.stage === 'proposal') && (
                    <a href="/design" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>Open Design Job →</a>
                  )}
                  {o.stage === 'proposal' && (
                    <button className="btn btn-secondary btn-sm" disabled={busyId === o.id} onClick={() => doNegotiate(o.id)}>Move to Negotiation</button>
                  )}
                  <button className="btn btn-primary btn-sm" disabled={busyId === o.id} onClick={() => doCloseWon(o.id)}>Close Won</button>
                  <button className="btn btn-ghost btn-sm" disabled={busyId === o.id} onClick={() => doCloseLost(o.id)}>Close Lost</button>
                </div>
              )}
            </div></div>
          ))}
        </div>
      )}
    </>
  );
}

function AcceptForm({ busy, onSave, onCancel }: { busy: boolean; onSave: (f: { region: string; service_line: string; city: string; street: string; state: string; customer_name: string }) => void; onCancel: () => void }) {
  const [region, setRegion] = useState('');
  const [serviceLine, setServiceLine] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [state, setState] = useState('');
  const [customerName, setCustomerName] = useState('');

  const canSubmit = region && serviceLine && city.trim() && state.trim() && customerName.trim();

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 8, paddingTop: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label required" style={{ fontSize: 12 }}>Region</label>
          <select className="form-input" value={region} onChange={e => setRegion(e.target.value)}>
            <option value="">—</option>
            {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select></div>
        <div><label className="form-label required" style={{ fontSize: 12 }}>Service line</label>
          <select className="form-input" value={serviceLine} onChange={e => setServiceLine(e.target.value)}>
            <option value="">—</option>
            {SERVICE_LINES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select></div>
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
