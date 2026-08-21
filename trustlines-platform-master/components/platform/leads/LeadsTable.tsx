'use client';

import { useState, useRef } from 'react';
import { ChevronDown, ChevronRight, Flag } from 'lucide-react';
import { Avatar } from '@/components/platform/shared/Avatar';
import { StickyBottomScrollbar } from '@/components/platform/shared/StickyBottomScrollbar';
import { LeadNameCell } from './LeadNameCell';
import {
  STATUS_ORDER, STATUS_OP_OPTIONS, PRIORITY_COLOR,
  type Lead, type OpportunityStatus, type Priority,
} from './types';
import { readableTextColor } from '@/lib/marketing/pillColor';
import { INDUSTRY_OPTIONS, INDUSTRY_COLOR } from '@/lib/marketing/industry';
import { useResizableColumns } from '@/lib/hooks/useResizableColumns';
import { ColorSelect } from '@/components/platform/marketing/ColorSelect';
import { TO_DO_COLOR, SOURCE_COLOR, REQUEST_COLOR, PROJECT_TYPE_RAW_COLOR, STATUS_OP_COLOR, PAYMENT_OPTIONS } from '@/lib/marketing/dealFieldOptions';
import { CurrencyCell } from '@/components/platform/marketing/CurrencyCell';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const COLUMNS = [
  'Name', 'PROJECT #', 'Industry', 'Due date', 'Brand', '01-State', 'Priority',
  'Contact', 'Assignee', 'To Do', 'Status OP', 'Request', 'Project Type', 'Source',
  'Deal Size', 'Deposit', 'Payment', '11-Location', 'Date created', 'Date done', 'Targeted',
];

const COLUMN_WIDTHS = [
  380, 100, 170, 100, 150, 80, 120, 150, 150, 140, 160, 150, 150, 120,
  110, 100, 110, 170, 110, 110, 90,
];

const cell: React.CSSProperties = {
  padding: '5px 12px', fontSize: 12, color: 'var(--fg-default)',
  borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap', verticalAlign: 'middle',
  height: 34, overflow: 'hidden', textOverflow: 'ellipsis',
};
const headCell: React.CSSProperties = {
  padding: '7px 12px', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.03em',
  textTransform: 'uppercase', color: 'var(--fg-subtle)', textAlign: 'left',
  borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap', background: 'var(--bg-subtle)',
  position: 'sticky', top: 0, zIndex: 3,
};
const resizeHandle: React.CSSProperties = {
  position: 'absolute', top: 0, right: -4, width: 8, height: '100%',
  cursor: 'col-resize', userSelect: 'none', zIndex: 1,
};

function TextPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-pill)',
      fontSize: 11, fontWeight: 600, background: 'var(--bg-sunken)', color: 'var(--fg-muted)',
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

interface Props {
  leads: Lead[];
  assignees?: { id: string; full_name: string }[];
  marketingAssignees?: { id: string; full_name: string }[];
  collapsed: Set<OpportunityStatus>;
  onToggleGroup: (key: OpportunityStatus) => void;
  onStatusChange: (id: string, status: OpportunityStatus) => void;
  onPriorityChange?: (id: string, priority: Priority) => void;
  onAssigneeChange?: (id: string, assigneeId: string) => void;
  onIndustryChange?: (id: string, industry: string) => void;
  onToDoChange?: (id: string, value: string) => void;
  onRequestChange?: (id: string, value: string) => void;
  onProjectTypeRawChange?: (id: string, value: string) => void;
  onSourceRawChange?: (id: string, value: string) => void;
  onTargetedChange?: (id: string, value: boolean) => void;
  onPaymentChange?: (id: string, value: string) => void;
  onDealSizeChange?: (id: string, value: number | null) => void;
  onDepositChange?: (id: string, value: number | null) => void;
  onContextMenu?: (e: React.MouseEvent, lead: Lead) => void;
  onOpen?: (id: string) => void;
}

const inlineSelect: React.CSSProperties = {
  fontSize: 12, padding: '3px 6px', borderRadius: 6, maxWidth: 150,
};

export function LeadsTable({
  leads, assignees = [], marketingAssignees = [], collapsed, onToggleGroup, onStatusChange,
  onPriorityChange, onAssigneeChange, onIndustryChange, onToDoChange, onRequestChange,
  onProjectTypeRawChange, onSourceRawChange, onTargetedChange, onPaymentChange,
  onDealSizeChange, onDepositChange, onContextMenu, onOpen,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const { widths, startResize } = useResizableColumns('leadsTable.columnWidths.v1', COLUMN_WIDTHS);
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div ref={scrollRef} className="scroll-x-hidden" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200, tableLayout: 'fixed' }}>
          <colgroup>
            {widths.map((w, i) => <col key={COLUMNS[i]} style={{ width: w }} />)}
          </colgroup>
          <thead>
            <tr>
              {COLUMNS.map((c, i) => (
                <th key={c} style={{ ...headCell, ...(i === 0 ? { left: 0, zIndex: 5 } : {}) }}>
                  {c}
                  <span
                    className="col-resize-handle"
                    onMouseDown={e => startResize(i, e)}
                    style={resizeHandle}
                    title="Drag to resize"
                  />
                </th>
              ))}
            </tr>
          </thead>

          {STATUS_ORDER.map(meta => {
            const rows = leads.filter(l => l.opportunity_status === meta.key);
            const isCollapsed = collapsed.has(meta.key);

            const isDropTarget = dragOverKey === meta.key && dragId != null;

            return (
              <tbody
                key={meta.key}
                onDragOver={e => { if (dragId) { e.preventDefault(); if (dragOverKey !== meta.key) setDragOverKey(meta.key); } }}
                onDrop={e => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain') || dragId;
                  setDragOverKey(null); setDragId(null);
                  if (id) onStatusChange(id, meta.key);
                }}
              >
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    onClick={() => onToggleGroup(meta.key)}
                    style={{
                      padding: '9px 12px', cursor: 'pointer',
                      background: isDropTarget ? 'color-mix(in srgb, var(--brand-teal) 16%, transparent)' : 'var(--bg-subtle)',
                      borderBottom: isDropTarget ? '1px solid var(--brand-teal)' : '1px solid var(--border-default)',
                      borderTop: '1px solid var(--border-default)',
                      transition: 'background 120ms',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, position: 'sticky', left: 12 }}>
                      {isCollapsed ? <ChevronRight size={15} color="var(--fg-subtle)" /> : <ChevronDown size={15} color="var(--fg-subtle)" />}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                        fontSize: 12, fontWeight: 700, background: meta.bg, color: meta.fg,
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.dot }} />
                        {meta.label}
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-subtle)' }}>
                        {rows.length}
                      </span>
                    </span>
                  </td>
                </tr>

                {!isCollapsed && rows.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length} style={{ ...cell, textAlign: 'center', color: isDropTarget ? 'var(--brand-teal-600)' : 'var(--fg-faint)', fontStyle: 'italic' }}>
                      {isDropTarget ? 'Drop here to move to this status' : 'No leads in this group'}
                    </td>
                  </tr>
                )}

                {!isCollapsed && rows.map(l => (
                  <tr
                    key={l.id}
                    className="lead-row"
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('text/plain', l.id); e.dataTransfer.effectAllowed = 'move'; setDragId(l.id); }}
                    onDragEnd={() => { setDragId(null); setDragOverKey(null); }}
                    onContextMenu={e => onContextMenu?.(e, l)}
                    style={{ cursor: 'grab', opacity: dragId === l.id ? 0.5 : 1, background: l.archived ? 'var(--bg-subtle)' : undefined }}
                  >
                    <td className="sticky-col" style={{ ...cell, whiteSpace: 'normal', overflow: 'visible', verticalAlign: 'top' }}>
                      <LeadNameCell lead={l} today={today} assignees={l.origin === 'opportunity' || l.origin === 'potential' ? marketingAssignees : assignees}
                        onOpen={() => onOpen?.(l.id)} onEdit={() => onOpen?.(l.id)} />
                    </td>

                    <td style={cell}>{l.project_no ?? '—'}</td>

                    <td style={cell}>
                      {(() => {
                        const value = l.industry && (INDUSTRY_OPTIONS as readonly string[]).includes(l.industry) ? l.industry as typeof INDUSTRY_OPTIONS[number] : '';
                        const bg = value ? INDUSTRY_COLOR[value] : undefined;
                        return (
                          <select
                            className="pill-select"
                            value={value}
                            onChange={e => onIndustryChange?.(l.id, e.target.value)}
                            style={{
                              ...inlineSelect, border: 'none', borderRadius: 'var(--radius-pill)',
                              fontWeight: 700, fontSize: 11.5, padding: '4px 12px',
                              background: bg ?? 'var(--bg-sunken)', color: bg ? readableTextColor(bg) : 'var(--fg-faint)',
                            }}
                          >
                            <option value="">—</option>
                            {INDUSTRY_OPTIONS.map(o => <option key={o} value={o} style={{ background: INDUSTRY_COLOR[o], color: readableTextColor(INDUSTRY_COLOR[o]) }}>{o}</option>)}
                          </select>
                        );
                      })()}
                    </td>

                    <td style={{ ...cell, color: l.due_date && l.due_date.slice(0, 10) < today ? 'var(--status-danger)' : undefined, fontWeight: l.due_date && l.due_date.slice(0, 10) < today ? 600 : undefined }}>
                      {formatDate(l.due_date)}
                    </td>

                    <td style={cell}>{l.brand}</td>
                    <td style={cell}>
                      <span style={{ fontWeight: 600, color: 'var(--fg-muted)' }}>{l.state}</span>
                    </td>

                    <td style={cell}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Flag size={13} color={PRIORITY_COLOR[l.priority]} fill={l.priority === 'low' ? 'none' : PRIORITY_COLOR[l.priority]} />
                        <select
                          value={l.priority}
                          onChange={e => onPriorityChange?.(l.id, e.target.value as Priority)}
                          style={{ ...inlineSelect, color: PRIORITY_COLOR[l.priority], fontWeight: 600 }}
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </span>
                    </td>

                    <td style={cell}>{l.contact}</td>

                    <td style={cell}>
                      {(l.origin === 'opportunity' ? marketingAssignees : assignees).length > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                          <Avatar name={l.assignee} size="sm" />
                          <select
                            value={l.assignee_id ?? ''}
                            onChange={e => onAssigneeChange?.(l.id, e.target.value)}
                            style={inlineSelect}
                          >
                            <option value="">Unassigned</option>
                            {(l.origin === 'opportunity' ? marketingAssignees : assignees).map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                          </select>
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                          <Avatar name={l.assignee} size="sm" />
                          <span style={{ color: 'var(--fg-muted)' }}>{l.assignee}</span>
                        </span>
                      )}
                    </td>

                    <td style={cell}>
                      {l.origin === 'opportunity' || l.origin === 'potential' ? (
                        <ColorSelect value={l.to_do || null} options={Object.keys(TO_DO_COLOR)} knownColors={TO_DO_COLOR} onChange={v => onToDoChange?.(l.id, v)} />
                      ) : <TextPill>{l.to_do}</TextPill>}
                    </td>

                    <td style={cell}>
                      {l.origin === 'opportunity' || l.origin === 'potential' ? (
                        <select
                          value={l.opportunity_status}
                          onChange={e => onStatusChange(l.id, e.target.value as OpportunityStatus)}
                          className="pill-select"
                          style={{
                            ...inlineSelect, border: 'none', borderRadius: 999, fontWeight: 700, fontSize: 11,
                            padding: '3px 10px', background: STATUS_OP_COLOR[l.external_stage_label ?? ''] ?? 'var(--bg-sunken)',
                            color: STATUS_OP_COLOR[l.external_stage_label ?? ''] ? readableTextColor(STATUS_OP_COLOR[l.external_stage_label ?? '']) : 'var(--fg-faint)',
                          }}
                        >
                          {STATUS_OP_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                      ) : (l.external_stage_label ?? meta.label)}
                    </td>

                    <td style={cell}>
                      {l.origin === 'opportunity' || l.origin === 'potential' ? (
                        <ColorSelect value={l.request || null} options={Object.keys(REQUEST_COLOR)} knownColors={REQUEST_COLOR} onChange={v => onRequestChange?.(l.id, v)} />
                      ) : l.request}
                    </td>
                    <td style={cell}>
                      {l.origin === 'opportunity' || l.origin === 'potential' ? (
                        <ColorSelect value={l.project_type || null} options={Object.keys(PROJECT_TYPE_RAW_COLOR)} knownColors={PROJECT_TYPE_RAW_COLOR} onChange={v => onProjectTypeRawChange?.(l.id, v)} />
                      ) : l.project_type}
                    </td>
                    <td style={cell}>
                      {l.origin === 'opportunity' || l.origin === 'potential' ? (
                        <ColorSelect value={l.source || null} options={Object.keys(SOURCE_COLOR)} knownColors={SOURCE_COLOR} onChange={v => onSourceRawChange?.(l.id, v)} />
                      ) : l.source}
                    </td>
                    <td style={{ ...cell, overflow: 'visible' }}>
                      <CurrencyCell value={l.deal_size ?? null} onSave={v => onDealSizeChange?.(l.id, v)} />
                    </td>
                    <td style={{ ...cell, overflow: 'visible' }}>
                      {l.origin === 'opportunity' || l.origin === 'potential' ? (
                        <CurrencyCell value={l.deposit ?? null} onSave={v => onDepositChange?.(l.id, v)} />
                      ) : '—'}
                    </td>
                    <td style={cell}>
                      {l.origin === 'opportunity' || l.origin === 'potential' ? (
                        <ColorSelect value={l.payment_raw ?? null} options={PAYMENT_OPTIONS} knownColors={{}} onChange={v => onPaymentChange?.(l.id, v)} />
                      ) : (l.payment_raw ?? '—')}
                    </td>
                    <td style={{ ...cell, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.location}</td>
                    <td style={{ ...cell, color: 'var(--fg-subtle)' }}>{formatDate(l.date_created)}</td>
                    <td style={{ ...cell, color: 'var(--fg-subtle)' }}>{formatDate(l.date_done)}</td>

                    <td style={{ ...cell, textAlign: 'center' }}>
                      <input
                        type="checkbox" checked={!!l.targeted}
                        disabled={l.origin !== 'opportunity' && l.origin !== 'potential'}
                        onChange={e => onTargetedChange?.(l.id, e.target.checked)}
                        onClick={e => e.stopPropagation()}
                        style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--brand-teal)' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
      <StickyBottomScrollbar targetRef={scrollRef} />
    </div>
  );
}
