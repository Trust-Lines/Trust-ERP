'use client';

import { useState } from 'react';
import { ChevronDown, MoreHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Pill } from '@/components/platform/shared/Pill';
import type { UserRole } from '@/types/database';

async function auditLog(action: string, resource: string, newValue?: unknown) {
  await fetch('/api/audit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, resource, newValue }),
  }).catch(() => null);
}

interface CompanyRow {
  id: string;
  client_id: string | null;
  name: string;
  code: string | null;
  margin_pct: number | null;
  is_active: boolean;
}

interface ClientRow {
  id: string;
  name: string;
  code: string | null;
  notes: string | null;
  is_active: boolean;
  companies: CompanyRow[];
}

interface Props {
  initialClients: ClientRow[];
  userRole: UserRole;
  canEdit?: boolean;
}

function CodePill({ code }: { code: string | null }) {
  if (!code) return null;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: 'var(--bg-sunken)', color: 'var(--fg-subtle)', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)' }}>
      {code}
    </span>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return <Pill variant={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Inactive'}</Pill>;
}

function InlineForm({
  placeholder1, placeholder2, onSave, onCancel,
  initialName = '', initialCode = '', initialMargin = '', saveLabel = 'Save', showMargin = true,
}: {
  placeholder1: string; placeholder2: string;
  onSave: (name: string, code: string, margin: string) => Promise<void>;
  onCancel: () => void;
  initialName?: string; initialCode?: string; initialMargin?: string; saveLabel?: string; showMargin?: boolean;
}) {
  const [name, setName]     = useState(initialName);
  const [code, setCode]     = useState(initialCode);
  const [margin, setMargin] = useState(initialMargin);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim(), code.trim(), showMargin ? margin.trim() : '');
    setSaving(false);
  }

  return (
    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '12px 14px', marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: showMargin ? '1fr 100px 90px' : '1fr 120px', gap: 8, marginBottom: 10 }}>
        <div>
          <label className="form-label" style={{ fontSize: 11 }}>Service *</label>
          <input className="form-input" style={{ fontSize: 13 }} placeholder={placeholder1} value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="form-label" style={{ fontSize: 11 }}>Code</label>
          <input className="form-input" style={{ fontSize: 13 }} placeholder={placeholder2} value={code} onChange={e => setCode(e.target.value)} />
        </div>
        {showMargin && (
          <div>
            <label className="form-label" style={{ fontSize: 11 }}>Margin ×</label>
            <input className="form-input" style={{ fontSize: 13 }} type="number" placeholder="1.0" value={margin} onChange={e => setMargin(e.target.value)} min="0" step="0.05" title="Price multiplier — e.g. 1.5 means PO price = list price × 1.5" />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!name.trim() || saving}>{saving ? 'Saving…' : saveLabel}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function ContextMenu({ isActive, onEdit, onDeactivate, onReactivate, onDelete }: {
  isActive: boolean; onEdit?: () => void; onDeactivate: () => void; onReactivate: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuBtn = (label: string, onClick: () => void, danger = false) => (
    <button
      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: danger ? 'var(--status-danger)' : 'var(--fg-default)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = danger ? 'var(--status-danger-bg)' : 'var(--bg-subtle)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      onClick={() => { setOpen(false); onClick(); }}
    >{label}</button>
  );
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px', color: 'var(--fg-subtle)' }} onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 20, background: 'white', border: '1px solid var(--border-subtle)', borderRadius: 6, boxShadow: 'var(--shadow-sm)', minWidth: 140, overflow: 'hidden' }}>
            {onEdit && menuBtn('Edit', onEdit)}
            {onEdit && <div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 0' }} />}
            {isActive
              ? menuBtn('Deactivate', onDeactivate, true)
              : <>{menuBtn('Reactivate', onReactivate)}<div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 0' }} />{menuBtn('Delete', onDelete, true)}</>}
          </div>
        </>
      )}
    </div>
  );
}

export function ClientsPageClient({ initialClients, userRole, canEdit }: Props) {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const isOps = canEdit ?? (userRole === 'ops_manager');

  const [clients, setClients]   = useState<ClientRow[]>(initialClients);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(initialClients.map(c => c.id)));
  const [showAddClient, setShowAddClient] = useState(false);

  const [addCompanyFor, setAddCompanyFor]   = useState<string | null>(null);
  const [editClientFor, setEditClientFor]   = useState<string | null>(null);
  const [editCompanyFor, setEditCompanyFor] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleAddClient(name: string, code: string, notes: string) {
    const { data, error } = await sb.from('clients')
      .insert({ name, code: code || null, notes: notes || null, is_active: true })
      .select('id, name, code, notes, is_active').single();
    if (error || !data) { toast.error('Failed to save client'); return; }
    const nc = { ...(data as ClientRow), companies: [] };
    setClients(prev => [...prev, nc].sort((a, b) => a.name.localeCompare(b.name)));
    setExpanded(prev => new Set([...prev, nc.id]));
    setShowAddClient(false);
    toast.success(`Client "${name}" added`);
    await auditLog('client.created', `client: ${name}`, { name, code });
  }

  async function updateClient(id: string, name: string, code: string, notes: string) {
    const { error } = await sb.from('clients').update({ name, code: code || null, notes: notes || null }).eq('id', id);
    if (error) { toast.error('Failed to update client'); return; }
    setClients(prev => prev.map(c => c.id === id ? { ...c, name, code: code || null, notes: notes || null } : c));
    setEditClientFor(null);
    toast.success('Client updated');
  }

  async function deactivateClient(id: string) { await sb.from('clients').update({ is_active: false }).eq('id', id); setClients(p => p.map(c => c.id === id ? { ...c, is_active: false } : c)); toast.success('Client deactivated'); }
  async function reactivateClient(id: string) { await sb.from('clients').update({ is_active: true }).eq('id', id); setClients(p => p.map(c => c.id === id ? { ...c, is_active: true } : c)); toast.success('Client reactivated'); }
  async function deleteClient(id: string, name: string) {
    if (!window.confirm(`Delete "${name}" permanently? This cannot be undone.`)) return;
    const { error } = await sb.from('clients').delete().eq('id', id);
    if (error) { toast.error('Cannot delete — client may have linked projects'); return; }
    setClients(p => p.filter(c => c.id !== id));
    toast.success('Client deleted');
  }

  async function handleAddCompany(clientId: string, name: string, code: string, margin: string) {
    const marginPct = margin ? parseFloat(margin) : null;
    const { data, error } = await sb.from('client_companies')
      .insert({ client_id: clientId, name, code: code || null, margin_pct: marginPct, is_active: true })
      .select('id, client_id, name, code, margin_pct, is_active').single();
    if (error || !data) { toast.error('Failed to save service'); return; }
    const nc = data as CompanyRow;
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, companies: [...c.companies, nc] } : c));
    setAddCompanyFor(null);
    toast.success(`Service "${name}" added`);
  }

  async function updateCompany(clientId: string, companyId: string, name: string, code: string, margin: string) {
    const marginPct = margin ? parseFloat(margin) : null;
    const { error } = await sb.from('client_companies').update({ name, code: code || null, margin_pct: marginPct }).eq('id', companyId);
    if (error) { toast.error('Failed to update service'); return; }
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, companies: c.companies.map(co => co.id === companyId ? { ...co, name, code: code || null, margin_pct: marginPct } : co) } : c));
    setEditCompanyFor(null);
    toast.success('Service updated');
  }

  function patchCompany(clientId: string, companyId: string, patch: Partial<CompanyRow>) {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, companies: c.companies.map(co => co.id === companyId ? { ...co, ...patch } : co) } : c));
  }
  async function deactivateCompany(clientId: string, companyId: string) { await sb.from('client_companies').update({ is_active: false }).eq('id', companyId); patchCompany(clientId, companyId, { is_active: false }); toast.success('Service deactivated'); }
  async function reactivateCompany(clientId: string, companyId: string) { await sb.from('client_companies').update({ is_active: true }).eq('id', companyId); patchCompany(clientId, companyId, { is_active: true }); toast.success('Service reactivated'); }
  async function deleteCompany(clientId: string, companyId: string, name: string) {
    if (!window.confirm(`Delete service "${name}" permanently?`)) return;
    const { error } = await sb.from('client_companies').delete().eq('id', companyId);
    if (error) { toast.error('Cannot delete — service may have linked projects'); return; }
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, companies: c.companies.filter(co => co.id !== companyId) } : c));
    toast.success('Service deleted');
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Clients</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        {isOps && <button className="btn btn-primary" onClick={() => setShowAddClient(s => !s)}>+ Add client</button>}
      </div>

      {showAddClient && isOps && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><div className="form-section-title">New client</div></div>
          <div className="card-body">
            <AddClientForm onSave={handleAddClient} onCancel={() => setShowAddClient(false)} />
          </div>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>No clients yet.{isOps && ' Click "Add client" to create the first one.'}</div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clients.map(client => {
            const isOpen = expanded.has(client.id);
            return (
              <div key={client.id} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer', borderBottom: isOpen ? '1px solid var(--border-subtle)' : 'none' }} onClick={() => toggleExpand(client.id)}>
                  <ChevronDown size={16} style={{ color: 'var(--fg-subtle)', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{client.name}</span>
                      <CodePill code={client.code} />
                      <StatusPill active={client.is_active} />
                    </div>
                    {client.notes && <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 2 }}>{client.notes}</div>}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{client.companies.length} service{client.companies.length !== 1 ? 's' : ''}</span>
                  {isOps && (
                    <div onClick={e => e.stopPropagation()}>
                      <ContextMenu isActive={client.is_active}
                        onEdit={() => { setEditClientFor(client.id); setExpanded(prev => new Set([...prev, client.id])); }}
                        onDeactivate={() => deactivateClient(client.id)} onReactivate={() => reactivateClient(client.id)} onDelete={() => deleteClient(client.id, client.name)} />
                    </div>
                  )}
                </div>

                {editClientFor === client.id && isOps && (
                  <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <AddClientForm initialName={client.name} initialCode={client.code ?? ''} initialNotes={client.notes ?? ''} saveLabel="Save changes"
                      onSave={(name, code, notes) => updateClient(client.id, name, code, notes)} onCancel={() => setEditClientFor(null)} />
                  </div>
                )}

                {isOpen && (
                  <div style={{ padding: '8px 18px 16px' }}>
                    {client.companies.length === 0 && (
                      <div style={{ fontSize: 13, color: 'var(--fg-faint)', padding: '8px 0 4px 4px' }}>No services yet — add Store Maker, Premium Fitout, T Shop, Design &amp; Build…</div>
                    )}
                    {client.companies.map((company, ci) => (
                      <div key={company.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, paddingBottom: 8, borderBottom: ci < client.companies.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                          <div style={{ width: 2, height: 16, background: 'var(--border-default)', borderRadius: 1, flexShrink: 0 }} />
                          <span style={{ fontSize: 14, fontWeight: 500, color: company.is_active ? 'var(--fg-default)' : 'var(--fg-subtle)' }}>{company.name}</span>
                          <CodePill code={company.code} />
                          {!company.is_active && <StatusPill active={false} />}
                          {company.margin_pct != null && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--status-danger)' }}>×{company.margin_pct}</span>}
                          <div style={{ flex: 1 }} />
                          {isOps && (
                            <ContextMenu isActive={company.is_active}
                              onEdit={() => setEditCompanyFor(editCompanyFor === company.id ? null : company.id)}
                              onDeactivate={() => deactivateCompany(client.id, company.id)} onReactivate={() => reactivateCompany(client.id, company.id)} onDelete={() => deleteCompany(client.id, company.id, company.name)} />
                          )}
                        </div>
                        {editCompanyFor === company.id && isOps && (
                          <div style={{ paddingLeft: 10, paddingTop: 4, paddingBottom: 4 }}>
                            <InlineForm placeholder1="e.g. Store Maker" placeholder2="e.g. SM"
                              initialName={company.name} initialCode={company.code ?? ''} initialMargin={company.margin_pct != null ? String(company.margin_pct) : ''} saveLabel="Save changes"
                              onSave={(name, code, margin) => updateCompany(client.id, company.id, name, code, margin)} onCancel={() => setEditCompanyFor(null)} />
                          </div>
                        )}
                      </div>
                    ))}

                    {isOps && (addCompanyFor === client.id ? (
                      <div style={{ paddingTop: 8 }}>
                        <InlineForm placeholder1="e.g. Store Maker" placeholder2="e.g. SM"
                          onSave={(name, code, margin) => handleAddCompany(client.id, name, code, margin)} onCancel={() => setAddCompanyFor(null)} />
                      </div>
                    ) : (
                      <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, fontSize: 12, color: 'var(--brand-teal)', padding: '4px 8px' }} onClick={() => setAddCompanyFor(client.id)}>
                        <Plus size={11} /> Add service
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function AddClientForm({ onSave, onCancel, initialName = '', initialCode = '', initialNotes = '', saveLabel = 'Save client' }: {
  onSave: (name: string, code: string, notes: string) => Promise<void>;
  onCancel: () => void;
  initialName?: string; initialCode?: string; initialNotes?: string; saveLabel?: string;
}) {
  const [name, setName]   = useState(initialName);
  const [code, setCode]   = useState(initialCode);
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim(), code.trim(), notes.trim());
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10, marginBottom: 10 }}>
        <div>
          <label className="form-label required" style={{ fontSize: 12 }}>Client name</label>
          <input className="form-input" placeholder="e.g. TLines NE" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="form-label" style={{ fontSize: 12 }}>Code</label>
          <input className="form-input" placeholder="e.g. NE" value={code} onChange={e => setCode(e.target.value)} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label className="form-label" style={{ fontSize: 12 }}>Notes (optional)</label>
        <textarea className="form-input" rows={2} placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!name.trim() || saving}>{saving ? 'Saving…' : saveLabel}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
