'use client';

import { useMemo, useState, useRef } from 'react';
import { Search, Target, AlertTriangle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { PROJECT_TYPE_LABEL } from '@/lib/marketing/classification';
import { readableTextColor } from '@/lib/marketing/pillColor';
import { normalizeIndustry, INDUSTRY_COLOR } from '@/lib/marketing/industry';
import { TO_DO_COLOR, REQUEST_COLOR, SOURCE_COLOR, STATUS_OP_COLOR, PAYMENT_OPTIONS } from '@/lib/marketing/dealFieldOptions';
import { REGIONS } from '@/lib/regions';
import { ColorSelect } from './ColorSelect';
import { CurrencyCell } from './CurrencyCell';
import { useResizableColumns } from '@/lib/hooks/useResizableColumns';
import { StickyBottomScrollbar } from '@/components/platform/shared/StickyBottomScrollbar';
import { StagePill, type StageTone } from '@/components/platform/shared/StagePill';
import { InlineSelect } from '@/components/platform/shared/InlineSelect';
import { OpportunityQuickView } from './OpportunityQuickView';
import { MarketingPipelineNav } from './MarketingPipelineNav';
import type { OpportunityStage, ProjectType, LeadEntityType } from '@/types/database';

export interface DealRow {
  id: string;
  kind: 'opportunity' | 'potential';
  prospect_id: string;
  project_id: string | null;
  primary_contact_id: string | null;
  title: string;
  project_types: ProjectType[];
  stage: OpportunityStage | null;
  priority: 'low' | 'medium' | 'high';
  region: string | null;
  source_label: string | null;
  source_raw_label: string | null;
  marketing_owner_id: string | null;
  sales_owner_id: string | null;
  assigned_to: string | null;
  estimated_value: number | null;
  deposit: number | null;
  payment_raw: string | null;
  targeted: boolean;
  deadline: string | null;
  due_date: string | null;
  closed_at: string | null;
  date_done: string | null;
  industry_raw: string | null;
  brand: string | null;
  state: string | null;
  formatted_address: string | null;
  request_raw: string | null;
  to_do_raw: string | null;
  external_stage_label: string | null;
  tags: { name: string; color: string }[];
  created_at: string;
  updated_at: string;
  auto_managed: boolean;
  admin_corrected: boolean;
  lead_display_name: string;
  lead_entity_type: LeadEntityType;
  owner_name: string | null;
  contact_name: string | null;
  project_code: string | null;
}

interface Props {
  initialDeals: DealRow[];
  canEdit?: boolean;
  loadError?: boolean;
  prospectTotal: number | null;
  assignees: { id: string; full_name: string }[];
}

interface Group { key: string; label: string; tone: StageTone }

const GROUPS: Group[] = [
  { key: 'Potential', label: 'Potential', tone: 1 },
  { key: 'In Target List', label: 'In Target List', tone: 1 },
  { key: 'READY TO START', label: 'READY TO START', tone: 2 },
  { key: 'MODIFICATION REQUEST', label: 'MODIFICATION REQUEST', tone: 5 },
  { key: 'WORKING ON IT TRUST', label: 'WORKING ON IT TRUST', tone: 4 },
  { key: 'Design Proposal SENT', label: 'Design Proposal SENT', tone: 3 },
  { key: 'WAITING', label: 'WAITING', tone: 6 },
  { key: 'DEAL MISSED', label: 'DEAL MISSED', tone: 'neutral' },
  { key: 'DEAL CLOSED', label: 'DEAL CLOSED', tone: 'done' },
  { key: 'new', label: 'New / Qualifying', tone: 1 },
];
const DROP_STAGE_BY_GROUP: Partial<Record<string, OpportunityStage>> = {
  'READY TO START': 'sales_accepted', 'MODIFICATION REQUEST': 'negotiation',
  'WORKING ON IT TRUST': 'working_on_it_trust',
  'Design Proposal SENT': 'proposal', WAITING: 'on_hold',
  'DEAL CLOSED': 'closed_won', 'DEAL MISSED': 'closed_lost', new: 'marketing_qualification',
};
function groupKeyFor(d: DealRow): string {
  if (d.external_stage_label && GROUPS.some(g => g.key === d.external_stage_label)) return d.external_stage_label;
  return 'new';
}

const PRIORITY_OPTS: [string, string][] = [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];
const PRIORITY_COLOR: Record<string, string> = { high: 'var(--status-danger)', medium: 'var(--status-warning)', low: 'var(--fg-subtle)' };

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}
const todayStr = new Date().toISOString().slice(0, 10);

const cell: React.CSSProperties = {
  padding: '5px 12px', fontSize: 12, color: 'var(--fg-default)',
  borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap', verticalAlign: 'middle',
  overflow: 'hidden', textOverflow: 'ellipsis',
};

const BOARD_COLUMNS = [
  'Name', 'PROJECT #', 'Industry', 'Due date', 'Brand', '01-State', 'Priority',
  'Contact', 'Assignee', 'To Do', 'Status OP', 'Request', 'Project Type', 'Source',
  'Deal Size', 'Deposit', 'Payment', '11-Location', 'Date created', 'Date done', 'Targeted',
];
const BASE_COLUMN_WIDTHS = [380, 100, 170, 100, 150, 80, 120, 150, 150, 140, 160, 150, 150, 120, 110, 100, 110, 170, 110, 110, 90];
const resizeHandle: React.CSSProperties = {
  position: 'absolute', top: 0, right: -4, width: 8, height: '100%',
  cursor: 'col-resize', userSelect: 'none', zIndex: 1,
};

export function OpportunitiesPageClient({ initialDeals, canEdit, loadError, prospectTotal, assignees }: Props) {
  const [deals, setDeals] = useState<DealRow[]>(initialDeals);
  const [query, setQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [handingOff, setHandingOff] = useState<string | null>(null);
  const [open, setOpen] = useState<{ id: string; kind: 'opportunity' | 'potential' } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const { widths, startResize } = useResizableColumns('opportunitiesBoard.columnWidths.v1', BASE_COLUMN_WIDTHS);
  const scrollRef = useRef<HTMLDivElement>(null);

  const opportunityTotal = deals.filter(d => d.kind === 'opportunity').length;
  const potentialTotal = deals.filter(d => d.kind === 'potential').length;

  async function patch(row: DealRow, body: Record<string, unknown>) {
    const base = row.kind === 'potential' ? '/api/marketing/potentials' : '/api/marketing/opportunities';
    const res = await fetch(`${base}/${row.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const resBody = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(resBody.error ?? 'Could not save'); return false; }
    const updated = resBody.opportunity ?? resBody.potential;
    setDeals(prev => prev.map(d => (d.id === row.id ? { ...d, ...updated } : d)));
    return true;
  }

  function dropOnGroup(id: string, groupKey: string) {
    const row = deals.find(d => d.id === id);
    if (!row || row.kind !== 'opportunity') return;
    if (groupKeyFor(row) === groupKey) return;
    const dropStage = DROP_STAGE_BY_GROUP[groupKey];
    if (!dropStage) return;
    const reason = window.prompt(`Move "${row.lead_display_name}" to "${groupKey}" — why?`);
    if (!reason?.trim()) return;
    patch(row, { stage: dropStage, admin_correction_reason: reason.trim() });
  }

  async function handOff(row: DealRow) {
    if (row.kind !== 'opportunity') return;
    setHandingOff(row.id);
    const res = await fetch(`/api/marketing/opportunities/${row.id}/handoff`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => ({}));
    setHandingOff(null);
    if (!res.ok) { toast.error(body.error ?? 'Failed to hand off'); return; }
    setDeals(prev => prev.map(d => (d.id === row.id ? { ...d, stage: body.opportunity.stage } : d)));
    toast.success('Handed off to Sales');
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals.filter(d => {
      if (regionFilter !== 'all' && d.region !== regionFilter) return false;
      if (!q) return true;
      return d.title.toLowerCase().includes(q)
        || d.lead_display_name.toLowerCase().includes(q)
        || (d.brand ?? '').toLowerCase().includes(q)
        || (d.owner_name ?? '').toLowerCase().includes(q);
    });
  }, [deals, query, regionFilter]);

  if (loadError) {
    return (
      <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
        <AlertTriangle size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
        <div>Opportunities aren&apos;t ready yet. Migration 075 needs to be applied.</div>
      </div></div>
    );
  }

  return (
    <>
      <MarketingPipelineNav
        current="opportunities"
        prospectCount={prospectTotal} potentialCount={potentialTotal} opportunityCount={opportunityTotal}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Opportunities NE</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
            {deals.length} record{deals.length !== 1 ? 's' : ''} — click a row to open it, drag an Opportunity between groups to move its stage
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ position: 'relative', maxWidth: 360, flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)' }} />
          <input
            className="form-input" style={{ paddingLeft: 32, fontSize: 13 }}
            placeholder="Search…" value={query} onChange={e => setQuery(e.target.value)}
            aria-label="Search Opportunities"
          />
        </div>
        <select
          className="form-input" style={{ fontSize: 13, maxWidth: 200 }}
          value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
          aria-label="Filter by region"
        >
          <option value="all">All regions</option>
          {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
      </div>

      {deals.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
          <Target size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <div>Nothing here yet. Opportunities/Potentials appear automatically as Leads qualify.</div>
        </div></div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--fg-subtle)' }}>
          No records match &quot;{query}&quot;.
        </div></div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div ref={scrollRef} className="scroll-x-hidden" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1900, tableLayout: 'fixed' }}>
              <colgroup>
                {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
                {canEdit && <col style={{ width: 100 }} />}
              </colgroup>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--fg-subtle)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, background: 'var(--bg-subtle)' }}>
                  {BOARD_COLUMNS.map((label, i) => (
                    <th
                      key={label}
                      style={{
                        padding: '7px 12px', fontWeight: 600, position: 'sticky', top: 0,
                        background: 'var(--bg-subtle)', zIndex: i === 0 ? 5 : 3,
                        ...(i === 0 ? { left: 0 } : {}),
                      }}
                    >
                      {label}
                      <span className="col-resize-handle" onMouseDown={e => startResize(i, e)} style={resizeHandle} title="Drag to resize" />
                    </th>
                  ))}
                  {canEdit && <th style={{ padding: '7px 12px', fontWeight: 600, position: 'sticky', top: 0, background: 'var(--bg-subtle)', zIndex: 3 }}></th>}
                </tr>
              </thead>
              {GROUPS.map(group => {
                const rows = filtered.filter(d => groupKeyFor(d) === group.key);
                if (rows.length === 0 && (query.trim() || group.key === 'new')) return null;
                const isCollapsed = collapsed.has(group.key);
                const isDropTarget = dragOverKey === group.key && dragId != null;
                const colSpan = canEdit ? 21 : 20;
                return (
                  <tbody
                    key={group.key}
                    onDragOver={e => { if (dragId) { e.preventDefault(); if (dragOverKey !== group.key) setDragOverKey(group.key); } }}
                    onDrop={e => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData('text/plain') || dragId;
                      setDragOverKey(null); setDragId(null);
                      if (id && canEdit) dropOnGroup(id, group.key);
                    }}
                  >
                    <tr>
                      <td
                        colSpan={colSpan}
                        onClick={() => setCollapsed(prev => { const n = new Set(prev); n.has(group.key) ? n.delete(group.key) : n.add(group.key); return n; })}
                        style={{
                          padding: '9px 12px', cursor: 'pointer',
                          background: isDropTarget ? 'color-mix(in srgb, var(--brand-teal) 16%, transparent)' : 'var(--bg-subtle)',
                          borderBottom: isDropTarget ? '1px solid var(--brand-teal)' : '1px solid var(--border-default)',
                          borderTop: '1px solid var(--border-default)', transition: 'background 120ms',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, position: 'sticky', left: 12 }}>
                          <StagePill tone={group.tone}>{group.label}</StagePill>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-subtle)' }}>{rows.length}</span>
                        </span>
                      </td>
                    </tr>

                    {!isCollapsed && rows.length === 0 && (
                      <tr>
                        <td colSpan={colSpan} style={{ ...cell, textAlign: 'center', color: isDropTarget ? 'var(--brand-teal-600)' : 'var(--fg-faint)', fontStyle: 'italic' }}>
                          {isDropTarget ? 'Drop here to move to this group' : 'Nothing in this group'}
                        </td>
                      </tr>
                    )}

                    {!isCollapsed && rows.map(d => (
                      <tr
                        key={d.id}
                        className="lead-row"
                        draggable={!!canEdit && d.kind === 'opportunity'}
                        onDragStart={e => { e.dataTransfer.setData('text/plain', d.id); e.dataTransfer.effectAllowed = 'move'; setDragId(d.id); }}
                        onDragEnd={() => { setDragId(null); setDragOverKey(null); }}
                        style={{ cursor: canEdit && d.kind === 'opportunity' ? 'grab' : 'default', opacity: dragId === d.id ? 0.5 : 1 }}
                      >
                        <td className="sticky-col" style={{ ...cell, minWidth: 220 }}>
                          <div onClick={() => setOpen({ id: d.id, kind: d.kind })} style={{ cursor: 'pointer' }}>
                            <div style={{ fontWeight: 600, color: 'var(--brand-teal-600)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {d.title}
                              {d.tags.map(t => (
                                <span key={t.name} style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 4, background: t.color || 'var(--bg-subtle)', color: readableTextColor(t.color || '#888888') }}>
                                  {t.name}
                                </span>
                              ))}
                            </div>
                            {d.admin_corrected && <span className="pill" style={{ marginTop: 2, background: 'var(--status-warning-bg, #fef3c7)', color: 'var(--status-warning-fg, #92400e)', fontSize: 9 }}>manually moved</span>}
                          </div>
                        </td>

                        <td style={cell}>{d.project_code ?? '—'}</td>
                        <td style={cell}>
                          {(() => {
                            const industry = normalizeIndustry(d.industry_raw);
                            if (!industry) return '—';
                            const bg = INDUSTRY_COLOR[industry];
                            return <span style={{ fontWeight: 700, fontSize: 11, padding: '3px 10px', borderRadius: 999, background: bg, color: readableTextColor(bg) }}>{industry}</span>;
                          })()}
                        </td>
                        {(() => {
                          const due = d.kind === 'opportunity' ? d.deadline : d.due_date;
                          const overdue = !!due && due.slice(0, 10) < todayStr;
                          return <td style={{ ...cell, color: overdue ? 'var(--status-danger)' : undefined, fontWeight: overdue ? 600 : undefined }}>{formatDate(due)}</td>;
                        })()}
                        <td style={cell}>{d.brand ?? '—'}</td>
                        <td style={cell}>{d.state ?? '—'}</td>

                        <td style={cell}>
                          {canEdit ? (
                            <InlineSelect value={d.priority} onChange={v => patch(d, { priority: v })} options={PRIORITY_OPTS}
                              style={{ color: PRIORITY_COLOR[d.priority], fontWeight: 600 }} />
                          ) : (
                            <span style={{ color: PRIORITY_COLOR[d.priority], fontWeight: 600, textTransform: 'capitalize' }}>{d.priority}</span>
                          )}
                        </td>

                        <td style={cell}>{d.contact_name ?? '—'}</td>
                        <td style={cell}>{d.owner_name ?? '—'}</td>
                        <td style={cell}>
                          <ColorSelect value={d.to_do_raw} options={Object.keys(TO_DO_COLOR)} knownColors={TO_DO_COLOR} onChange={v => patch(d, { to_do_raw: v || null })} />
                        </td>
                        <td style={cell}>
                          {(() => {
                            const bg = STATUS_OP_COLOR[d.external_stage_label ?? ''];
                            if (!d.external_stage_label) return '—';
                            return <span style={{ fontWeight: 700, fontSize: 11, padding: '3px 10px', borderRadius: 999, background: bg ?? 'var(--bg-sunken)', color: bg ? readableTextColor(bg) : 'var(--fg-faint)' }}>{d.external_stage_label}</span>;
                          })()}
                        </td>
                        <td style={cell}>
                          <ColorSelect value={d.request_raw} options={Object.keys(REQUEST_COLOR)} knownColors={REQUEST_COLOR} onChange={v => patch(d, { request_raw: v || null })} />
                        </td>
                        <td style={cell}>
                          {d.project_types.length === 0 ? '—' : d.project_types.slice(0, 2).map(t => PROJECT_TYPE_LABEL[t] ?? t).join(', ')}
                        </td>
                        <td style={cell}>
                          <ColorSelect value={d.source_raw_label ?? d.source_label} options={Object.keys(SOURCE_COLOR)} knownColors={SOURCE_COLOR} onChange={v => patch(d, { source_raw_label: v || null })} />
                        </td>
                        <td style={{ ...cell, overflow: 'visible' }}>
                          <CurrencyCell value={d.estimated_value} onSave={v => patch(d, { estimated_value: v })} />
                        </td>
                        <td style={{ ...cell, overflow: 'visible' }}>
                          <CurrencyCell value={d.deposit} onSave={v => patch(d, { deposit: v })} />
                        </td>
                        <td style={cell}>
                          <ColorSelect value={d.payment_raw} options={PAYMENT_OPTIONS} knownColors={{}} onChange={v => patch(d, { payment_raw: v || null })} />
                        </td>
                        <td style={{ ...cell, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.formatted_address ?? '—'}</td>
                        <td style={{ ...cell, color: 'var(--fg-subtle)' }}>{formatDate(d.created_at)}</td>
                        <td style={{ ...cell, color: 'var(--fg-subtle)' }}>{formatDate(d.kind === 'opportunity' ? d.closed_at : d.date_done)}</td>
                        <td style={{ ...cell, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={!!d.targeted} onChange={e => patch(d, { targeted: e.target.checked })}
                            style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--brand-teal)' }} />
                        </td>

                        {canEdit && (
                          <td style={cell} onClick={e => e.stopPropagation()}>
                            {d.kind === 'opportunity' && ['new', 'marketing_qualification'].includes(d.stage ?? '') && (
                              <button className="btn btn-secondary btn-sm" disabled={handingOff === d.id} onClick={() => handOff(d)}>
                                <Send size={12} /> {handingOff === d.id ? 'Sending…' : 'Hand off'}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                );
              })}
            </table>
          </div>
          <StickyBottomScrollbar targetRef={scrollRef} />
        </div>
      )}

      {open && (
        <OpportunityQuickView
          opportunityId={open.id}
          kind={open.kind}
          assignees={assignees}
          onClose={() => setOpen(null)}
          onChanged={patch2 => setDeals(prev => prev.map(d => (d.id === open.id ? { ...d, ...patch2 } : d)))}
        />
      )}
    </>
  );
}
