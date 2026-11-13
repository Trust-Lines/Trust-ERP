'use client';

import { useState } from 'react';
import { Flag, Clock, CheckSquare, Tag } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/status-badge';
import { OPPORTUNITY_STATUS_TAG } from '@/lib/status/tags';
import { Button } from '@/components/ui/button';
import { STATUS_ORDER, PRIORITY_COLOR, type Lead, type OpportunityStatus } from './types';
import { formatMoney } from '@/lib/sales/format';

function money(v?: number | null): string | null {
  return v == null || v === 0 ? null : formatMoney(v);
}

interface Props {
  leads: Lead[];
  onStatusChange: (id: string, status: OpportunityStatus) => void;
  onContextMenu?: (e: React.MouseEvent, lead: Lead) => void;
  onOpen?: (id: string) => void;
}

const BOARD_PAGE = 30;

export function LeadsBoard({ leads, onStatusChange, onContextMenu, onOpen }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  // Cards revealed per column — hundreds of cards at once is what froze the page.
  const [shown, setShown] = useState<Record<string, number>>({});
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
      {STATUS_ORDER.map(meta => {
        const allCards = leads.filter(l => l.opportunity_status === meta.key);
        const cap = shown[meta.key] ?? BOARD_PAGE;
        const cards = allCards.slice(0, cap);
        const isOver = overKey === meta.key && dragId != null;
        return (
          <div
            key={meta.key}
            onDragOver={e => { if (dragId) { e.preventDefault(); if (overKey !== meta.key) setOverKey(meta.key); } }}
            onDrop={e => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain') || dragId;
              setOverKey(null); setDragId(null);
              if (id) onStatusChange(id, meta.key);
            }}
            style={{
              width: 320, flexShrink: 0, borderRadius: 'var(--radius-md)',
              background: isOver ? 'color-mix(in srgb, var(--brand-teal) 8%, var(--bg-subtle))' : 'var(--bg-subtle)',
              border: `1px solid ${isOver ? 'var(--brand-teal)' : 'var(--border-subtle)'}`,
              transition: 'background 120ms, border-color 120ms',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
              <StatusBadge group="lead_stage" status={OPPORTUNITY_STATUS_TAG[meta.key] ?? meta.key} label={meta.label} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-subtle)' }}>{allCards.length}</span>
            </div>

            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 60 }}>
              {allCards.length === 0 && (
                <div style={{ fontSize: 14, color: 'var(--fg-faint)', textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>
                  {isOver ? 'Drop here' : '—'}
                </div>
              )}
              {cards.map(l => {
                const overdue = l.follow_up_date && l.follow_up_date < today;
                const dueToday = l.follow_up_date === today;
                const m = money(l.deal_size);
                return (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('text/plain', l.id); e.dataTransfer.effectAllowed = 'move'; setDragId(l.id); }}
                    onDragEnd={() => { setDragId(null); setOverKey(null); }}
                    onContextMenu={e => onContextMenu?.(e, l)}
                    onClick={() => onOpen?.(l.id)}
                    style={{
                      background: l.archived ? 'var(--bg-subtle)' : 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                      padding: '14px 14px', cursor: 'grab', opacity: dragId === l.id ? 0.5 : 1,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-default)', lineHeight: 1.3 }}>{l.name}</div>
                        <Flag size={16} color={PRIORITY_COLOR[l.priority]} fill={l.priority === 'low' ? 'none' : PRIORITY_COLOR[l.priority]} style={{ flexShrink: 0, marginTop: 2 }} />
                      </div>
                      {l.project_no && <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--fg-faint)', marginTop: 3 }}>{l.project_no}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        {l.assignee && l.assignee !== 'Unassigned' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Avatar name={l.assignee} size="sm" />
                          </span>
                        )}
                        {m && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-muted)' }}>{m}</span>}
                        {l.project_type && l.project_type !== '—' && (
                          <span style={{ fontSize: 12.5, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--bg-sunken)', color: 'var(--fg-muted)' }}>{l.project_type}</span>
                        )}
                        {(overdue || dueToday) && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 700, background: overdue ? 'var(--status-danger-bg)' : 'var(--status-warning-bg)', color: overdue ? 'var(--status-danger-fg)' : 'var(--status-warning-fg)' }}>
                            <Clock size={11} /> {overdue ? 'Overdue' : 'Today'}
                          </span>
                        )}
                        {!!l.tasks_total && (
                          <span title={`${l.tasks_done ?? 0}/${l.tasks_total} subtasks done`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: (l.tasks_done ?? 0) === l.tasks_total ? 'var(--brand-teal-600)' : 'var(--status-warning-fg)' }}>
                            <CheckSquare size={13} /> {l.tasks_done ?? 0}/{l.tasks_total}
                          </span>
                        )}
                        {!!l.checklist_total && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: (l.checklist_done ?? 0) === l.checklist_total ? 'var(--brand-teal-600)' : 'var(--fg-faint)' }}>
                            <CheckSquare size={13} /> {l.checklist_done ?? 0}/{l.checklist_total}
                          </span>
                        )}
                      </div>
                      {!!l.tags?.length && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {l.tags.slice(0, 4).map(t => (
                            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--brand-teal-100)', color: 'var(--brand-teal-600)', border: '1px solid var(--color-secondary-100)' }}>
                              <Tag size={10} /> {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {allCards.length > cards.length && (
                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={() => setShown(prev => ({ ...prev, [meta.key]: cap + BOARD_PAGE }))}
                >
                  Show {Math.min(BOARD_PAGE, allCards.length - cards.length)} more · {allCards.length - cards.length} left
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
