'use client';

import { useState } from 'react';
import { ChevronDown, MoreHorizontal, Plus, Building2, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { StatusBadge } from '@/components/ui/status-badge';
import type { UserRole } from '@/types/database';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { cn } from '@/lib/utils';

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

// Figma "Clients (T-Lines regions)" (node 442:1088): one bordered card per client, a grey
// header row (chevron, name, state, service count, Add Service, "…") and 64px service rows.
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const FIELD = 'h-10 w-full min-w-0 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring';
const FORM_LABEL = 'flex min-w-0 flex-col gap-1 text-[12px] font-medium text-ui-body';
const ACCENT_BTN = 'gap-2 bg-ui-btn-accent px-8 text-[13px] font-medium text-ui-btn-accent-fg hover:bg-ui-btn-accent hover:opacity-90 dark:bg-ui-btn-accent dark:text-ui-btn-accent-fg dark:hover:bg-ui-btn-accent';

/** Figma table chip: outlined, uppercase ACTIVE (T9) / INACTIVE (T0). */
function StateChip({ active }: { active: boolean }) {
  return (
    <StatusBadge
      group="record_state" status={active ? 'active' : 'inactive'} showIcon={false}
      className="h-auto rounded-[4px] border border-current px-4 py-1 text-[12px] uppercase leading-4"
    />
  );
}

/** Price multiplier, e.g. "X 1.5": error-red outline while the service is active, grey when not. */
function MarginChip({ value, active }: { value: number; active: boolean }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-[4px] border px-4 py-1 text-[15px] font-medium leading-4 tabular-nums whitespace-nowrap',
        active ? 'border-error-normal text-error-normal' : 'border-[var(--status-t0-fg)] text-[var(--status-t0-fg)]')}
      title="Price multiplier — PO price = list price × this"
    >
      X {value}
    </span>
  );
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
    <div className="rounded-[6px] border border-ui-divider bg-ui-surface p-3">
      <div className={cn('mb-2.5 grid gap-2', showMargin ? 'grid-cols-[1fr_100px_90px]' : 'grid-cols-[1fr_120px]')}>
        <label className={FORM_LABEL}>
          Service *
          <input className={FIELD} placeholder={placeholder1} value={name} onChange={e => setName(e.target.value)} autoFocus />
        </label>
        <label className={FORM_LABEL}>
          Code
          <input className={FIELD} placeholder={placeholder2} value={code} onChange={e => setCode(e.target.value)} />
        </label>
        {showMargin && (
          <label className={FORM_LABEL}>
            Margin ×
            <input className={FIELD} type="number" placeholder="1.0" value={margin} onChange={e => setMargin(e.target.value)} min="0" step="0.05" title="Price multiplier — e.g. 1.5 means PO price = list price × 1.5" />
          </label>
        )}
      </div>
      <div className="flex gap-1.5">
        <Button onClick={handleSave} disabled={!name.trim()} loading={saving}>{saveLabel}</Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
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
      type="button" role="menuitem"
      className={cn('block w-full cursor-pointer rounded-[4px] border-0 bg-transparent px-3 py-2 text-left text-[13px] hover:bg-ui-hover-bg', danger ? 'text-error-normal' : 'text-ui-body')}
      onClick={() => { setOpen(false); onClick(); }}
    >{label}</button>
  );
  const divider = <div className="my-0.5 h-px bg-ui-divider" />;
  return (
    <div className="relative w-12 text-center" onClick={e => e.stopPropagation()}>
      <Button
        variant="ghost" size="icon-sm" aria-label="More actions" aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <MoreHorizontal />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-[6px] border border-ui-divider bg-ui-surface-elevated p-1 text-left shadow-03">
            {onEdit && menuBtn('Edit', onEdit)}
            {onEdit && divider}
            {isActive
              ? menuBtn('Deactivate', onDeactivate, true)
              : <>{menuBtn('Reactivate', onReactivate)}{divider}{menuBtn('Delete', onDelete, true)}</>}
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-[5px] leading-[1.35]">
          <PageCrumbs items={[{ label: 'Operations', href: '/production' }, { label: 'Clients', href: '/clients' }]} />
          <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Clients</h1>
          <p className="m-0 text-[13px] text-ui-body">{clients.length} Client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        {isOps && (
          <Button size="md" className={ACCENT_BTN} onClick={() => setShowAddClient(s => !s)} aria-expanded={showAddClient}>
            <Plus className="size-4" /> Add Client
          </Button>
        )}
      </div>

      {showAddClient && isOps && (
        <div className="rounded-[8px] border border-ui-divider bg-ui-page-bg p-4">
          <p className={cn('m-0 mb-3 text-[16px] font-semibold', HEADING)}>New client</p>
          <AddClientForm onSave={handleAddClient} onCancel={() => setShowAddClient(false)} />
        </div>
      )}

      {clients.length === 0 ? (
        <div className="rounded-[8px] border border-ui-divider bg-ui-page-bg">
          <EmptyState
            icon={<Building2 />}
            title="No clients yet"
            description="Clients group the services and projects you deliver for each company."
            action={isOps && <Button onClick={() => setShowAddClient(true)}><Plus /> Add first client</Button>}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {clients.map(client => {
            const isOpen = expanded.has(client.id);
            const count = client.companies.length;
            return (
              // No overflow-hidden: it would clip the "…" menus at the card edge (header rounds its own corners).
              <div key={client.id} className="rounded-[8px] border border-ui-divider bg-ui-page-bg">
                {/* ── Client header ── */}
                <div
                  role="button" tabIndex={0} aria-expanded={isOpen}
                  onClick={() => toggleExpand(client.id)}
                  onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleExpand(client.id); } }}
                  className={cn('flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-t-[7px] bg-ui-surface px-2 py-4 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ui-focus-ring', isOpen ? 'border-b border-ui-divider' : 'rounded-b-[7px]')}
                >
                  <div className="flex min-w-0 items-center">
                    <ChevronDown size={24} aria-hidden className={cn('shrink-0 text-ui-body transition-transform', !isOpen && '-rotate-90')} />
                    <div className="flex min-w-0 flex-col pl-4 pr-2">
                      <span className={cn('truncate text-[16px] font-semibold', HEADING)}>
                        {client.name}
                        {client.code && <span className="ml-2 text-[13px] font-normal text-ui-text-secondary">{client.code}</span>}
                      </span>
                      {client.notes && <span className="truncate text-[12px] text-ui-text-secondary">{client.notes}</span>}
                    </div>
                    <div className="px-2"><StateChip active={client.is_active} /></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[16px] font-semibold text-ui-text-secondary">{count} Service{count !== 1 ? 's' : ''}</span>
                    {isOps && (
                      <Button
                        size="toolbar"
                        onClick={e => { e.stopPropagation(); setAddCompanyFor(client.id); setExpanded(prev => new Set([...prev, client.id])); }}
                      >
                        <Plus className="size-4" /> Add Service
                      </Button>
                    )}
                    {isOps && (
                      <ContextMenu isActive={client.is_active}
                        onEdit={() => { setEditClientFor(client.id); setExpanded(prev => new Set([...prev, client.id])); }}
                        onDeactivate={() => deactivateClient(client.id)} onReactivate={() => reactivateClient(client.id)} onDelete={() => deleteClient(client.id, client.name)} />
                    )}
                  </div>
                </div>

                {editClientFor === client.id && isOps && (
                  <div className="border-b border-ui-divider p-4">
                    <AddClientForm initialName={client.name} initialCode={client.code ?? ''} initialNotes={client.notes ?? ''} saveLabel="Save changes"
                      onSave={(name, code, notes) => updateClient(client.id, name, code, notes)} onCancel={() => setEditClientFor(null)} />
                  </div>
                )}

                {/* ── Services ── */}
                {isOpen && (
                  <div>
                    {count === 0 && addCompanyFor !== client.id && (
                      <EmptyState size="sm" className="px-5 py-4" icon={<Briefcase />} title="No services yet." description="Add Store Maker, Premium Fitout, T Shop, Design & Build…" />
                    )}
                    {client.companies.map(company => {
                      const muted = !company.is_active;
                      const text = cn('truncate text-[15px] font-semibold', muted ? 'text-[var(--status-t0-fg)]' : HEADING);
                      return (
                        <div key={company.id} className="border-b border-ui-divider last:border-b-0">
                          <div className="flex min-h-16 items-center justify-between gap-3 px-2">
                            <div className="flex min-w-0 items-center">
                              <span className={cn('w-[215px] px-2.5', text)}>{company.name}</span>
                              <span className={cn('w-[142px] px-2.5', text)}>{company.code ?? '—'}</span>
                              <span className="px-2">{company.margin_pct != null && <MarginChip value={company.margin_pct} active={company.is_active} />}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="px-2"><StateChip active={company.is_active} /></div>
                              {isOps ? (
                                <ContextMenu isActive={company.is_active}
                                  onEdit={() => setEditCompanyFor(editCompanyFor === company.id ? null : company.id)}
                                  onDeactivate={() => deactivateCompany(client.id, company.id)} onReactivate={() => reactivateCompany(client.id, company.id)} onDelete={() => deleteCompany(client.id, company.id, company.name)} />
                              ) : <span className="w-12" />}
                            </div>
                          </div>
                          {editCompanyFor === company.id && isOps && (
                            <div className="px-4 pb-4">
                              <InlineForm placeholder1="e.g. Store Maker" placeholder2="e.g. SM"
                                initialName={company.name} initialCode={company.code ?? ''} initialMargin={company.margin_pct != null ? String(company.margin_pct) : ''} saveLabel="Save changes"
                                onSave={(name, code, margin) => updateCompany(client.id, company.id, name, code, margin)} onCancel={() => setEditCompanyFor(null)} />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {isOps && addCompanyFor === client.id && (
                      <div className={cn('p-4', count > 0 && 'border-t border-ui-divider')}>
                        <InlineForm placeholder1="e.g. Store Maker" placeholder2="e.g. SM"
                          onSave={(name, code, margin) => handleAddCompany(client.id, name, code, margin)} onCancel={() => setAddCompanyFor(null)} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
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
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_100px] gap-2.5">
        <label className={FORM_LABEL}>
          Client name *
          <input className={FIELD} placeholder="e.g. TLines NE" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </label>
        <label className={FORM_LABEL}>
          Code
          <input className={FIELD} placeholder="e.g. NE" value={code} onChange={e => setCode(e.target.value)} />
        </label>
      </div>
      <label className={FORM_LABEL}>
        Notes (optional)
        <textarea className={cn(FIELD, 'h-auto min-h-[64px] resize-y py-2')} rows={2} placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={!name.trim()} loading={saving}>{saveLabel}</Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}
