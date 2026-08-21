'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Hash, List, LayoutGrid, Calendar, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { toast } from 'sonner';
import { LeadsTable } from './LeadsTable';
import { LeadsBoard } from './LeadsBoard';
import { LeadsCalendar } from './LeadsCalendar';
import { LeadQuickView } from './LeadQuickView';
import { OpportunityQuickView } from '@/components/platform/marketing/OpportunityQuickView';
import { formatMoney } from '@/lib/sales/format';
import { STATUS_ORDER, STATUS_META, type Lead, type OpportunityStatus } from './types';
import { STATUS_TO_STAGE } from '@/lib/marketing/opportunityRows';
import { REGIONS } from '@/lib/regions';

type ViewMode = 'list' | 'board' | 'calendar';

interface Props {
  initialLeads: Lead[];
  assignees?: { id: string; full_name: string }[];
  marketingAssignees?: { id: string; full_name: string }[];
  currentUserId?: string;
  canManageNumber?: boolean;
  nextNumber?: number;
  truncatedAt?: number;
  canSeeLeadIntake?: boolean;
}

export function LeadsClient({ initialLeads, assignees = [], marketingAssignees = [], currentUserId, canManageNumber, nextNumber = 1, truncatedAt, canSeeLeadIntake = true }: Props) {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/sales/run-reminders', { method: 'POST' }).catch(() => {});
  }, []);

  const [mine, setMine] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);

  function handleOpen(id: string) {
    setQuickViewId(id);
  }

  const [menu, setMenu] = useState<{ x: number; y: number; lead: Lead } | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); window.removeEventListener('keydown', onKey); };
  }, [menu]);

  function openMenu(e: React.MouseEvent, lead: Lead) {
    e.preventDefault();
    if (lead.origin === 'opportunity' || lead.origin === 'potential') return;
    setMenu({ x: Math.min(e.clientX, window.innerWidth - 210), y: e.clientY, lead });
  }

  async function archiveLead(lead: Lead, archived: boolean) {
    setMenu(null);
    setLeads(prev => prev.map(l => (l.id === lead.id ? { ...l, archived } : l)));
    const res = await fetch(`/api/leads/${lead.id}/archive`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived }),
    }).catch(() => null);
    if (!res || !res.ok) { toast.error('Could not archive'); router.refresh(); }
    else toast.success(archived ? 'Archived' : 'Unarchived');
  }

  async function trashLead(lead: Lead) {
    setMenu(null);
    if (!window.confirm(`Move "${lead.name}" to trash? It stays there for 30 days.`)) return;
    setLeads(prev => prev.filter(l => l.id !== lead.id));
    const res = await fetch(`/api/leads/${lead.id}/trash`, { method: 'POST' }).catch(() => null);
    if (!res || !res.ok) { toast.error('Could not move to trash'); router.refresh(); }
    else toast.success('Moved to trash');
  }

  const [numEdit, setNumEdit]   = useState(String(nextNumber));
  const [savingNum, setSavingNum] = useState(false);
  async function saveNumber() {
    const val = parseInt(numEdit, 10);
    if (!Number.isFinite(val) || val < 1) { toast.error('Enter a valid number (1 or more)'); return; }
    setSavingNum(true);
    try {
      const res = await fetch('/api/sales/sequences', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next_number: val }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Saved — the next project number is ${data.nextNumber}.`);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to set number'); }
    finally { setSavingNum(false); }
  }
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [collapsed, setCollapsed] = useState<Set<OpportunityStatus>>(new Set());

  useEffect(() => { setLeads(initialLeads); }, [initialLeads]);

  const [view, setView]             = useState<ViewMode>('list');
  const [search, setSearch]         = useState('');
  const [fPriority, setFPriority]   = useState('');
  const [fAssignee, setFAssignee]   = useState('');
  const [fTag, setFTag]             = useState('');
  const [fRegion, setFRegion]       = useState('');
  const [sortBy, setSortBy]         = useState('created_desc');

  const allTags = useMemo(() => [...new Set(initialLeads.flatMap(l => l.tags ?? []))].sort(), [initialLeads]);

  const assigneeName = (id?: string | null) => assignees.find(a => a.id === id)?.full_name;

  const marketingAssigneeName = (id?: string | null) => marketingAssignees.find(a => a.id === id)?.full_name;

  function updateField(id: string, patch: Partial<Lead>, body: Record<string, unknown>) {
    const before = leads.find(l => l.id === id);
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
    fetch(`/api/leads/${id}/update`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(res => { if (!res.ok) throw new Error(); }).catch(() => {
      toast.error('Could not save');
      if (before) setLeads(prev => prev.map(l => (l.id === id ? before : l)));
    });
  }

  function patchOpportunity(id: string, patch: Partial<Lead>, body: Record<string, unknown>, base: 'opportunities' | 'potentials' = 'opportunities') {
    const before = leads.find(l => l.id === id);
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
    fetch(`/api/marketing/${base}/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(res => { if (!res.ok) throw new Error(); }).catch(() => {
      toast.error('Could not save');
      if (before) setLeads(prev => prev.map(l => (l.id === id ? before : l)));
    });
  }

  function handlePriorityChange(id: string, priority: Lead['priority']) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { priority }, { priority }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { priority }, { priority });
    else updateField(id, { priority }, { priority });
  }
  function handleIndustryChange(id: string, industry: string) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { industry }, { industry_raw: industry || null }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { industry }, { industry_raw: industry || null });
    else updateField(id, { industry }, { industry: industry || null });
  }
  function handleToDoChange(id: string, to_do: string) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { to_do }, { to_do_raw: to_do || null }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { to_do }, { to_do_raw: to_do || null });
  }
  function handleRequestChange(id: string, request: string) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { request }, { request_raw: request || null }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { request }, { request_raw: request || null });
  }
  function handleProjectTypeRawChange(id: string, project_type: string) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { project_type }, { project_type_raw: project_type || null }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { project_type }, { project_type_raw: project_type || null });
  }
  function handleSourceRawChange(id: string, source: string) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { source }, { source_raw_label: source || null }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { source }, { source_raw_label: source || null });
  }
  function handlePaymentChange(id: string, payment_raw: string) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, {}, { payment_raw: payment_raw || null }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, {}, { payment_raw: payment_raw || null });
  }
  function handleDealSizeChange(id: string, deal_size: number | null) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { deal_size }, { estimated_value: deal_size }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { deal_size }, { estimated_value: deal_size });
    else updateField(id, { deal_size }, { deal_size });
  }
  function handleDepositChange(id: string, deposit: number | null) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { deposit }, { deposit }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { deposit }, { deposit });
  }
  function handleTargetedChange(id: string, targeted: boolean) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { targeted }, { targeted }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { targeted }, { targeted });
  }
  function handleAssigneeChange(id: string, assignee_id: string) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') {
      patchOpportunity(id, { assignee_id: assignee_id || null, assignee: marketingAssigneeName(assignee_id) || 'Unassigned' }, { assigned_to: assignee_id || null }, 'potentials');
    } else if (lead?.origin === 'opportunity') {
      const field = lead.opportunity_status === 'new_opportunity' ? 'marketing_owner_id' : 'sales_owner_id';
      patchOpportunity(id, { assignee_id: assignee_id || null, assignee: marketingAssigneeName(assignee_id) || 'Unassigned' }, { [field]: assignee_id || null });
    } else {
      updateField(id, { assignee_id: assignee_id || null, assignee: assigneeName(assignee_id) || 'Unassigned' }, { assignee_id });
    }
  }

  function handleStatusChange(id: string, status: OpportunityStatus) {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;

    if (lead.origin === 'opportunity') {
      if (status === lead.opportunity_status) return;
      const nextStage = STATUS_TO_STAGE[status];
      if (!nextStage) { toast.error(`"${STATUS_META[status].label}" isn't available for Marketing-origin deals yet`); return; }
      const reason = window.prompt(`Move "${lead.name}" to "${STATUS_META[status].label}" — why?`);
      if (!reason?.trim()) return;
      patchOpportunity(id, { opportunity_status: status }, { stage: nextStage, admin_correction_reason: reason.trim() });
      return;
    }

    if (lead.origin === 'potential') {
      if (status === 'potential' || status === 'in_target_list') {
        patchOpportunity(id, { opportunity_status: status }, { external_stage_label: STATUS_META[status].label }, 'potentials');
        return;
      }
      toast.error('Potentials convert to Opportunities automatically once a document or link is attached — open the Lead and add one there.');
      return;
    }

    const prevStatus = lead.opportunity_status;
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, opportunity_status: status } : l)));
    fetch(`/api/leads/${id}/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunity_status: status }),
    }).then(async res => {
      if (!res.ok) throw new Error();
    }).catch(() => {
      toast.error('Could not save status');
      if (prevStatus) setLeads(prev => prev.map(l => (l.id === id ? { ...l, opportunity_status: prevStatus } : l)));
    });
  }

  function toggleGroup(key: OpportunityStatus) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visibleLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = leads.filter(l => {
      if (!showArchived && l.archived) return false;
      if (mine && l.assignee_id !== currentUserId) return false;
      if (fPriority && l.priority !== fPriority) return false;
      if (fAssignee === '__none__' && l.assignee_id) return false;
      if (fAssignee && fAssignee !== '__none__' && l.assignee_id !== fAssignee) return false;
      if (fTag && !(l.tags ?? []).includes(fTag)) return false;
      if (fRegion && l.region !== fRegion) return false;
      if (q) {
        const hay = `${l.name} ${l.brand} ${l.project_no ?? ''} ${l.contact} ${l.location}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const rank = { high: 0, medium: 1, low: 2 };
    out = [...out].sort((a, b) => {
      if (sortBy === 'created_asc')  return (a.date_created).localeCompare(b.date_created);
      if (sortBy === 'deal_desc')    return (b.deal_size ?? 0) - (a.deal_size ?? 0);
      if (sortBy === 'priority')     return rank[a.priority] - rank[b.priority];
      return (b.date_created).localeCompare(a.date_created);
    });
    return out;
  }, [leads, mine, showArchived, currentUserId, search, fPriority, fAssignee, fTag, fRegion, sortBy]);

  const archivedCount = useMemo(() => leads.filter(l => l.archived).length, [leads]);

  const myCount = useMemo(() => leads.filter(l => l.assignee_id === currentUserId).length, [leads, currentUserId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[l.opportunity_status] = (c[l.opportunity_status] ?? 0) + 1;
    return c;
  }, [leads]);

  const pipelineValue = useMemo(() => leads.reduce((s, l) => s + (l.deal_size ?? 0), 0), [leads]);
  const fmtMoney = formatMoney;
  const todayStr = new Date().toISOString().slice(0, 10);
  const overdueCount = useMemo(() => leads.filter(l => l.follow_up_date && l.follow_up_date < todayStr).length, [leads, todayStr]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>CRM</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
            {leads.length} opportunit{leads.length === 1 ? 'y' : 'ies'}
            {pipelineValue > 0 && <> · <b style={{ color: 'var(--fg-default)' }}>{fmtMoney(pipelineValue)}</b> in pipeline</>}
            {overdueCount > 0 && <> · <b style={{ color: 'var(--status-danger)' }}>{overdueCount} follow-up{overdueCount === 1 ? '' : 's'} overdue</b></>}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {canManageNumber && (
            <div title="Starting project number (applies to all projects — Trust & Sales)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 6px 3px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-pill)', background: 'var(--bg-surface)' }}>
              <Hash size={13} color="var(--fg-subtle)" />
              <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>Next #</span>
              <input
                type="number" min="1" step="1" value={numEdit}
                onChange={e => setNumEdit(e.target.value)}
                style={{ width: 74, fontFamily: 'var(--font-mono)', fontSize: 13, padding: '4px 6px', border: '1px solid var(--border-subtle)', borderRadius: 6 }}
              />
              <button className="btn btn-primary btn-sm" disabled={savingNum || numEdit.trim() === String(nextNumber)} onClick={saveNumber} style={{ padding: '4px 10px' }}>
                {savingNum ? '…' : 'Set'}
              </button>
            </div>
          )}
          {canSeeLeadIntake && (
            <>
              <Link href="/leads/new" className="btn btn-primary btn-sm" title="Already a real, ready deal — creates the project immediately">
                <Plus size={14} /> Quick Deal (Sales)
              </Link>
              <Link href="/leads/trash" className="btn btn-ghost btn-sm" title="Trash (kept 30 days)"><Trash2 size={14} /> Trash</Link>
            </>
          )}
          {STATUS_ORDER.map(s => (
            <span
              key={s.key}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 11px', borderRadius: 'var(--radius-pill)',
                fontSize: 12, fontWeight: 600, background: s.bg, color: s.fg,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot }} />
              {s.label}
              <span style={{ fontWeight: 700 }}>{counts[s.key] ?? 0}</span>
            </span>
          ))}
        </div>
      </div>

      {truncatedAt && (
        <div className="info-box" style={{ marginBottom: 12, background: 'var(--status-warning-bg)', borderColor: 'var(--status-warning)', color: 'var(--status-warning-fg)', fontSize: 13 }}>
          ⚠ Showing the newest <b>{truncatedAt}</b> leads — there are more. Counts, the
          pipeline total and search only cover what&apos;s loaded. Archive or trash old
          leads, or ask for server-side paging.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          {([['list', List, 'List'], ['board', LayoutGrid, 'Board'], ['calendar', Calendar, 'Calendar']] as const).map(([v, Icon, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              title={label}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', fontSize: 12.5, fontWeight: 600,
                border: 'none', cursor: 'pointer', borderRight: v !== 'calendar' ? '1px solid var(--border-default)' : 'none',
                background: view === v ? 'var(--brand-teal)' : 'var(--bg-surface)',
                color: view === v ? '#fff' : 'var(--fg-muted)',
              }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        {currentUserId && (
          <button
            onClick={() => setMine(m => !m)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12.5, fontWeight: 600,
              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              border: `1px solid ${mine ? 'var(--brand-teal)' : 'var(--border-default)'}`,
              background: mine ? 'var(--brand-teal)' : 'var(--bg-surface)',
              color: mine ? '#fff' : 'var(--fg-muted)',
            }}
          >
            Assigned to me{myCount > 0 ? ` · ${myCount}` : ''}
          </button>
        )}
        <input
          className="form-input"
          placeholder="Search customer, brand, project #…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280, fontSize: 13 }}
        />
        <select className="form-input form-select" value={fPriority} onChange={e => setFPriority(e.target.value)} style={{ width: 150, fontSize: 13 }}>
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="form-input form-select" value={fAssignee} onChange={e => setFAssignee(e.target.value)} style={{ width: 180, fontSize: 13 }}>
          <option value="">All assignees</option>
          <option value="__none__">Unassigned</option>
          {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
        {allTags.length > 0 && (
          <select className="form-input form-select" value={fTag} onChange={e => setFTag(e.target.value)} style={{ width: 150, fontSize: 13 }}>
            <option value="">All tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <select className="form-input form-select" value={fRegion} onChange={e => setFRegion(e.target.value)} style={{ width: 190, fontSize: 13 }}>
          <option value="">All regions</option>
          {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
        <select className="form-input form-select" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 170, fontSize: 13 }}>
          <option value="created_desc">Newest first</option>
          <option value="created_asc">Oldest first</option>
          <option value="deal_desc">Deal size (high→low)</option>
          <option value="priority">Priority (high→low)</option>
        </select>
        {archivedCount > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived(a => !a)} title="Archived leads are hidden by default">
            <Archive size={13} /> {showArchived ? 'Hide' : 'Show'} archived · {archivedCount}
          </button>
        )}
        {(search || fPriority || fAssignee || fTag || fRegion) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFPriority(''); setFAssignee(''); setFTag(''); setFRegion(''); }}>Clear</button>
        )}
        <span style={{ fontSize: 12, color: 'var(--fg-faint)', marginLeft: 'auto' }}>{visibleLeads.length} shown</span>
      </div>

      {view === 'list' && (
        <LeadsTable
          leads={visibleLeads}
          assignees={assignees}
          marketingAssignees={marketingAssignees}
          collapsed={collapsed}
          onToggleGroup={toggleGroup}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onIndustryChange={handleIndustryChange}
          onToDoChange={handleToDoChange}
          onRequestChange={handleRequestChange}
          onProjectTypeRawChange={handleProjectTypeRawChange}
          onSourceRawChange={handleSourceRawChange}
          onTargetedChange={handleTargetedChange}
          onPaymentChange={handlePaymentChange}
          onDealSizeChange={handleDealSizeChange}
          onDepositChange={handleDepositChange}
          onAssigneeChange={handleAssigneeChange}
          onContextMenu={openMenu}
          onOpen={handleOpen}
        />
      )}
      {view === 'board' && <LeadsBoard leads={visibleLeads} onStatusChange={handleStatusChange} onContextMenu={openMenu} onOpen={handleOpen} />}
      {view === 'calendar' && <LeadsCalendar leads={visibleLeads} />}

      {quickViewId && (() => {
        const origin = leads.find(l => l.id === quickViewId)?.origin;
        if (origin === 'opportunity' || origin === 'potential') {
          return (
            <OpportunityQuickView
              opportunityId={quickViewId}
              kind={origin}
              assignees={marketingAssignees}
              onClose={() => { setQuickViewId(null); router.refresh(); }}
            />
          );
        }
        return (
          <LeadQuickView
            intakeId={quickViewId}
            assignees={assignees}
            onClose={() => { setQuickViewId(null); router.refresh(); }}
          />
        );
      })()}

      {menu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', top: menu.y, left: menu.x, zIndex: 10001, minWidth: 200, padding: 4,
            background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)', boxShadow: '0 6px 24px rgba(0,0,0,0.16)',
          }}
        >
          <div style={{ padding: '6px 10px 4px', fontSize: 11, color: 'var(--fg-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{menu.lead.name}</div>
          <button onClick={() => archiveLead(menu.lead, !menu.lead.archived)} style={ctxItem}>
            {menu.lead.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            {menu.lead.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button onClick={() => trashLead(menu.lead)} style={{ ...ctxItem, color: 'var(--status-danger)' }}>
            <Trash2 size={14} /> Move to trash
          </button>
        </div>
      )}
    </>
  );
}

const ctxItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px',
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
  color: 'var(--fg-default)', textAlign: 'left', borderRadius: 6,
};
