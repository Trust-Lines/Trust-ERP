'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Inbox, Mail, Phone, Building2, MapPin, Trash2, UserPlus, X, Loader2 } from 'lucide-react';
import { LEAD_STATUSES, LEAD_STATUS_LABEL, type LeadStatus } from '@/lib/web-cms/leads';

export interface WebLeadRow {
  id: string; kind: 'contact' | 'newsletter'; name: string | null; phone: string | null; email: string | null;
  company: string | null; store_location: string | null; store_condition: string | null; store_type: string | null;
  message: string | null; consent_accepted: boolean; consent_text_version: string | null; consent_at: string | null;
  source_page: string | null; utm: Record<string, string> | null;
  status: LeadStatus; internal_note: string | null; prospect_id: string | null; created_at: string;
}

interface Dup { id: string; display_name: string; matchedOn: string[] }

const STATUS_COLOR: Record<LeadStatus, string> = {
  new: '#0d9488', contacted: '#2563eb', converted: '#16a34a', spam: '#dc2626', archived: '#64748b',
};

function Pill({ status }: { status: LeadStatus }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: STATUS_COLOR[status], color: '#fff' }}>
      {LEAD_STATUS_LABEL[status]}
    </span>
  );
}

const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function WebLeadsClient({ initial, canEdit, loadError }: { initial: WebLeadRow[]; canEdit: boolean; loadError: boolean }) {
  const [leads, setLeads] = useState(initial);
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('new');
  const [kindFilter, setKindFilter] = useState<'all' | 'contact' | 'newsletter'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [converting, setConverting] = useState<{ lead: WebLeadRow; dups: Dup[] | null } | null>(null);
  const [busy, setBusy] = useState(false);

  if (loadError) {
    return (
      <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
        Website Leads isn&apos;t ready yet. Migration 122 (web_leads) needs to be applied.
      </div></div>
    );
  }

  const shown = leads.filter(l => (statusFilter === 'all' || l.status === statusFilter) && (kindFilter === 'all' || l.kind === kindFilter));
  const count = (s: LeadStatus) => leads.filter(l => l.status === s).length;
  const replace = (row: WebLeadRow) => setLeads(prev => prev.map(x => (x.id === row.id ? row : x)));

  async function patch(l: WebLeadRow, body: Record<string, unknown>) {
    const res = await fetch(`/api/web-cms/leads/${l.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(b.error ?? 'Could not update'); return; }
    replace(b.lead);
  }

  async function remove(l: WebLeadRow) {
    if (!confirm('Delete this submission permanently? This can\'t be undone.')) return;
    const res = await fetch(`/api/web-cms/leads/${l.id}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Could not delete'); return; }
    setLeads(prev => prev.filter(x => x.id !== l.id));
    setOpenId(null);
    toast.success('Deleted');
  }

  async function startConvert(l: WebLeadRow) {
    setConverting({ lead: l, dups: null });
    const res = await fetch(`/api/web-cms/leads/${l.id}/duplicates`, { cache: 'no-store' });
    const b = await res.json().catch(() => ({}));
    setConverting({ lead: l, dups: res.ok ? (b.duplicates ?? []) : [] });
  }

  async function convert(l: WebLeadRow, prospectId?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/web-cms/leads/${l.id}/convert`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prospectId ? { prospectId } : {}),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not convert'); return; }
      replace({ ...l, status: 'converted', prospect_id: b.prospectId });
      setConverting(null);
      toast.success(b.created ? 'Added to Contacts' : 'Linked to the existing Contact');
    } finally { setBusy(false); }
  }

  const chip = (active: boolean, text: string, onClick: () => void) => (
    <button key={text} className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`} onClick={onClick}>{text}</button>
  );

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {chip(statusFilter === 'all', `All (${leads.length})`, () => setStatusFilter('all'))}
        {LEAD_STATUSES.map(s => chip(statusFilter === s, `${LEAD_STATUS_LABEL[s]} (${count(s)})`, () => setStatusFilter(s)))}
        <span style={{ flex: 1 }} />
        <select className="form-select" value={kindFilter} onChange={e => setKindFilter(e.target.value as typeof kindFilter)} style={{ width: 170 }}>
          <option value="all">Contact form + Newsletter</option>
          <option value="contact">Contact form only</option>
          <option value="newsletter">Newsletter only</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--fg-subtle)' }}>
          <Inbox size={30} style={{ opacity: .4, marginBottom: 8 }} />
          <div>Nothing here. Submissions from the website contact form and newsletter box appear in this inbox.</div>
        </div></div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {shown.map(l => {
            const open = openId === l.id;
            return (
              <div key={l.id} className="card"><div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => setOpenId(open ? null : l.id)}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {l.kind === 'newsletter' ? (l.email ?? 'Newsletter signup') : (l.company || l.name || l.email)}
                      {l.kind === 'newsletter' && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-subtle)' }}>Newsletter</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 2 }}>
                      {l.kind === 'contact' && l.company && l.name ? `${l.name} · ` : ''}{fmt(l.created_at)}
                      {l.store_type ? ` · ${l.store_type}` : ''}{l.store_condition ? ` · ${l.store_condition}` : ''}
                    </div>
                  </div>
                  <Pill status={l.status} />
                </div>

                {open && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'grid', gap: 10, fontSize: 13 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                      {l.name && <div>{l.name}</div>}
                      {l.company && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Building2 size={13} /> {l.company}</div>}
                      {l.email && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Mail size={13} /> <a href={`mailto:${l.email}`}>{l.email}</a></div>}
                      {l.phone && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Phone size={13} /> <a href={`tel:${l.phone}`}>{l.phone}</a></div>}
                      {l.store_location && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><MapPin size={13} /> {l.store_location}</div>}
                    </div>
                    {l.message && <div style={{ whiteSpace: 'pre-wrap', background: 'var(--bg-subtle, #f8fafc)', borderRadius: 8, padding: 10 }}>{l.message}</div>}
                    <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>
                      Privacy notice accepted{l.consent_at ? ` ${fmt(l.consent_at)}` : ''}{l.consent_text_version ? ` (v${l.consent_text_version})` : ''}
                      {l.source_page ? ` · from ${l.source_page}` : ''}
                      {l.utm ? ` · ${Object.entries(l.utm).map(([k, v]) => `${k}=${v}`).join(', ')}` : ''}
                    </div>

                    {canEdit && (
                      <>
                        <textarea
                          className="form-input" style={{ width: '100%', minHeight: 60 }} placeholder="Internal note (not shown on the website)"
                          defaultValue={l.internal_note ?? ''}
                          onBlur={e => { if ((e.target.value.trim() || null) !== (l.internal_note ?? null)) patch(l, { internal_note: e.target.value }); }}
                        />
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {l.prospect_id ? (
                            <Link href={`/marketing/prospects/${l.prospect_id}`} className="btn btn-secondary btn-sm">Open Contact</Link>
                          ) : l.kind === 'contact' && l.status !== 'spam' && (
                            <button className="btn btn-primary btn-sm" onClick={() => startConvert(l)}><UserPlus size={13} style={{ marginRight: 4 }} /> Add to Contacts</button>
                          )}
                          {l.status !== 'converted' && (['contacted', 'spam', 'archived'] as LeadStatus[]).filter(s => s !== l.status).map(s => (
                            <button key={s} className="btn btn-ghost btn-sm" onClick={() => patch(l, { status: s })}>Mark {LEAD_STATUS_LABEL[s].toLowerCase()}</button>
                          ))}
                          {l.status !== 'converted' && l.status !== 'new' && (
                            <button className="btn btn-ghost btn-sm" onClick={() => patch(l, { status: 'new' })}>Mark new</button>
                          )}
                          <span style={{ flex: 1 }} />
                          <button className="btn btn-ghost btn-sm" onClick={() => remove(l)}><Trash2 size={13} style={{ color: '#dc2626' }} /></button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div></div>
            );
          })}
        </div>
      )}

      {converting && (
        <div onClick={() => !busy && setConverting(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-surface, #fff)', borderRadius: 14, width: 'min(520px, 100%)', padding: 22, boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Add to Contacts</div>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConverting(null)}><X size={16} /></button>
            </div>
            {converting.dups === null ? (
              <div style={{ textAlign: 'center', padding: 24 }}><Loader2 size={20} className="animate-spin" /></div>
            ) : (
              <>
                {converting.dups.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--fg-subtle)', marginBottom: 8 }}>
                      These existing Contacts look like the same person or company. Attach to one, or create a new Contact anyway.
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {converting.dups.map(d => (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '8px 12px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{d.display_name}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>Matched on {d.matchedOn.join(', ').replace(/_/g, ' ')}</div>
                          </div>
                          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => convert(converting.lead, d.id)}>Attach</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button className="btn btn-primary" disabled={busy} onClick={() => convert(converting.lead)}>
                  {busy ? 'Working…' : converting.dups.length ? 'Create new Contact anyway' : 'Create Contact'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
