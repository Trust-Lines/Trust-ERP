'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
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
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
}

export const LEAD_COLUMNS = [
  'Name', 'PROJECT #', 'Industry', 'Due date', 'Brand', '01-State', 'Priority',
  'Contact', 'Assignee', 'To Do', 'Status OP', 'Request', 'Project Type', 'Source',
  'Deal Size', 'Deposit', 'Payment', '11-Location', 'Date created', 'Date done', 'Targeted',
];

const COLUMNS = LEAD_COLUMNS;

// Rows revealed per step while scrolling.
const ROW_PAGE = 60;

// Columns off by default — ClickUp's own view keeps these out of the way too.
export const DEFAULT_HIDDEN_COLUMNS = ['To Do', 'Deposit', 'Payment', 'Date done', 'Targeted'];

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
  hiddenColumns?: Set<string>;
  /** Changes whenever filters/search/sort change — resets the incremental row window. */
  resetKey?: string;
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

const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const PRIORITY_PILL: Record<string, string> = { High: '#e5484d', Medium: '#f59e0b', Low: '#94a3b8' };
// People aren't colour-coded — one calm neutral pill for every name.
const NEUTRAL_PILL = (names: string[]): Record<string, string> => Object.fromEntries(names.map(n => [n, '#e6e9ef']));

export function LeadsTable({
  leads, assignees = [], marketingAssignees = [], collapsed, hiddenColumns, resetKey, onToggleGroup, onStatusChange,
  onPriorityChange, onAssigneeChange, onIndustryChange, onToDoChange, onRequestChange,
  onProjectTypeRawChange, onSourceRawChange, onTargetedChange, onPaymentChange,
  onDealSizeChange, onDepositChange, onContextMenu, onOpen,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const { widths, startResize } = useResizableColumns('leadsTable.columnWidths.v1', COLUMN_WIDTHS);
  const assigneePool = (l: Lead) => (l.origin === 'opportunity' || l.origin === 'potential' ? marketingAssignees : assignees);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLTableRowElement>(null);

  // ── Never render hundreds of rows at once ─────────────────────────────────────────────
  // The full list is already in memory, but each row carries ~16 interactive cells (selects,
  // colour pills, currency inputs) — mounting 700 of them in one go is what froze the page.
  // Rows are revealed a window at a time as the user scrolls toward the bottom.
  const [limit, setLimit] = useState(ROW_PAGE);
  useEffect(() => { setLimit(ROW_PAGE); scrollRef.current?.scrollTo({ top: 0 }); }, [resetKey]);

  const { buckets, shownByGroup, hasMore, renderedCount } = useMemo(() => {
    const buckets = new Map<OpportunityStatus, Lead[]>(STATUS_ORDER.map(m => [m.key, []]));
    for (const l of leads) buckets.get(l.opportunity_status)?.push(l);
    let budget = limit, total = 0;
    const shownByGroup = new Map<OpportunityStatus, number>();
    for (const m of STATUS_ORDER) {
      const rows = buckets.get(m.key) ?? [];
      if (collapsed.has(m.key)) { shownByGroup.set(m.key, 0); continue; }
      const n = Math.min(rows.length, budget);
      shownByGroup.set(m.key, n); budget -= n; total += rows.length;
    }
    return { buckets, shownByGroup, hasMore: limit - budget < total, renderedCount: limit - budget };
  }, [leads, collapsed, limit]);

  useEffect(() => {
    const el = sentinelRef.current, root = scrollRef.current;
    if (!hasMore || !el || !root) return;
    const io = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) setLimit(l => l + ROW_PAGE);
    }, { root, rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, limit]);

  // Fill the screen down to the bottom edge (the table scrolls inside itself, header stays put).
  const [boxHeight, setBoxHeight] = useState<number | null>(null);
  useEffect(() => {
    function fit() {
      const el = scrollRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setBoxHeight(Math.max(360, Math.round(window.innerHeight - top - 12)));
    }
    fit();
    const raf = requestAnimationFrame(fit);
    window.addEventListener('resize', fit);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', fit); };
  }, []);

  const hidden = hiddenColumns ?? new Set<string>();
  const visibleIdx = COLUMNS.map((_, i) => i).filter(i => !hidden.has(COLUMNS[i]));
  const visibleCount = visibleIdx.length;
  // Hide by CSS nth-child so the row markup stays one flat list of cells.
  const hideCss = COLUMNS.map((c, i) => (hidden.has(c) && i > 0 ? `.leads-tbl th:nth-child(${i + 1}),.leads-tbl tr.lead-row > td:nth-child(${i + 1}){display:none}` : '')).join('');
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <style>{hideCss}</style>
      <div ref={scrollRef} className="scroll-x-hidden" style={{ overflow: 'auto', height: boxHeight ?? 'calc(100vh - 300px)' }}>
        <table className="leads-tbl" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200, tableLayout: 'fixed' }}>
          <colgroup>
            {visibleIdx.map(i => <col key={COLUMNS[i]} style={{ width: widths[i] }} />)}
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
            const rows = buckets.get(meta.key) ?? [];
            const shownRows = rows.slice(0, shownByGroup.get(meta.key) ?? 0);
            const isCollapsed = collapsed.has(meta.key);
            // Empty groups are noise — only show them while dragging (they're drop targets).
            if (rows.length === 0 && dragId == null) return null;
            const clickupColor = Object.entries(STATUS_OP_COLOR).find(([k]) => k.toUpperCase() === meta.label.toUpperCase())?.[1];
            const groupBg = clickupColor ?? meta.bg;
            const groupFg = clickupColor ? readableTextColor(clickupColor) : meta.fg;

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
                    colSpan={visibleCount}
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
                        padding: '3px 12px', borderRadius: 6,
                        fontSize: 12, fontWeight: 700, background: groupBg, color: groupFg,
                      }}>
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
                    <td colSpan={visibleCount} style={{ ...cell, textAlign: 'center', color: isDropTarget ? 'var(--brand-teal-600)' : 'var(--fg-faint)', fontStyle: 'italic' }}>
                      {isDropTarget ? 'Drop here to move to this status' : 'No leads in this group'}
                    </td>
                  </tr>
                )}

                {!isCollapsed && shownRows.map(l => (
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
                      <ColorSelect
                        value={l.industry && (INDUSTRY_OPTIONS as readonly string[]).includes(l.industry) ? l.industry : null}
                        options={[...INDUSTRY_OPTIONS]}
                        knownColors={INDUSTRY_COLOR}
                        allowCreate={false} searchable={false}
                        onChange={v => onIndustryChange?.(l.id, v)}
                      />
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
                        <ColorSelect
                          value={PRIORITY_LABEL[l.priority]}
                          options={['High', 'Medium', 'Low']}
                          knownColors={PRIORITY_PILL}
                          allowCreate={false} searchable={false} clearable={false}
                          onChange={v => onPriorityChange?.(l.id, v.toLowerCase() as Priority)}
                        />
                      </span>
                    </td>

                    <td style={cell}>{l.contact}</td>

                    <td style={cell}>
                      {assigneePool(l).length > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                          <Avatar name={l.assignee} size="sm" />
                          <ColorSelect
                            value={l.assignee_id && l.assignee !== 'Unassigned' ? l.assignee : null}
                            options={assigneePool(l).map(a => a.full_name)}
                            knownColors={NEUTRAL_PILL(assigneePool(l).map(a => a.full_name))}
                            allowCreate={false} placeholder="Unassigned"
                            onChange={name => onAssigneeChange?.(l.id, assigneePool(l).find(a => a.full_name === name)?.id ?? '')}
                          />
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
                        <ColorSelect
                          value={STATUS_OP_OPTIONS.find(([k]) => k === l.opportunity_status)?.[1] ?? l.external_stage_label ?? null}
                          options={STATUS_OP_OPTIONS.map(([, label]) => label)}
                          knownColors={STATUS_OP_COLOR}
                          allowCreate={false} searchable={false} clearable={false}
                          onChange={label => { const key = STATUS_OP_OPTIONS.find(([, lb]) => lb === label)?.[0]; if (key) onStatusChange(l.id, key); }}
                        />
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
          {hasMore && (
            <tbody>
              <tr ref={sentinelRef}>
                <td colSpan={visibleCount} style={{ ...cell, textAlign: 'center', color: 'var(--fg-faint)', height: 44 }}>
                  Loading more… ({renderedCount} of {leads.length})
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
      <StickyBottomScrollbar targetRef={scrollRef} />
    </div>
  );
}
