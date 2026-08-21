'use client';

import { useState } from 'react';
import { Flag, Clock, CheckSquare, Tag } from 'lucide-react';
import { Avatar } from '@/components/platform/shared/Avatar';
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

export function LeadsBoard({ leads, onStatusChange, onContextMenu, onOpen }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
      {STATUS_ORDER.map(meta => {
        const cards = leads.filter(l => l.opportunity_status === meta.key);
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
              width: 280, flexShrink: 0, borderRadius: 'var(--radius-md)',
              background: isOver ? 'color-mix(in srgb, var(--brand-teal) 8%, var(--bg-subtle))' : 'var(--bg-subtle)',
              border: `1px solid ${isOver ? 'var(--brand-teal)' : 'var(--border-subtle)'}`,
              transition: 'background 120ms, border-color 120ms',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 700, background: meta.bg, color: meta.fg }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.dot }} />
                {meta.label}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-subtle)' }}>{cards.length}</span>
            </div>

            <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60 }}>
              {cards.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--fg-faint)', textAlign: 'center', padding: '16px 0', fontStyle: 'italic' }}>
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
                      padding: '10px 11px', cursor: 'grab', opacity: dragId === l.id ? 0.5 : 1,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-default)', lineHeight: 1.3 }}>{l.name}</div>
                        <Flag size={13} color={PRIORITY_COLOR[l.priority]} fill={l.priority === 'low' ? 'none' : PRIORITY_COLOR[l.priority]} style={{ flexShrink: 0, marginTop: 2 }} />
                      </div>
                      {l.project_no && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-faint)', marginTop: 2 }}>{l.project_no}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {l.assignee && l.assignee !== 'Unassigned' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Avatar name={l.assignee} size="sm" />
                          </span>
                        )}
                        {m && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)' }}>{m}</span>}
                        {l.project_type && l.project_type !== '—' && (
                          <span style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 'var(--radius-pill)', background: 'var(--bg-sunken)', color: 'var(--fg-muted)' }}>{l.project_type}</span>
                        )}
                        {(overdue || dueToday) && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 'var(--radius-pill)', fontSize: 10, fontWeight: 700, background: overdue ? '#fee2e2' : '#fef3c7', color: overdue ? '#b91c1c' : '#92400e' }}>
                            <Clock size={9} /> {overdue ? 'Overdue' : 'Today'}
                          </span>
                        )}
                        {!!l.tasks_total && (
                          <span title={`${l.tasks_done ?? 0}/${l.tasks_total} subtasks done`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: (l.tasks_done ?? 0) === l.tasks_total ? 'var(--brand-teal-600)' : 'var(--status-warning-fg)' }}>
                            <CheckSquare size={11} /> {l.tasks_done ?? 0}/{l.tasks_total}
                          </span>
                        )}
                        {!!l.checklist_total && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: (l.checklist_done ?? 0) === l.checklist_total ? 'var(--brand-teal-600)' : 'var(--fg-faint)' }}>
                            <CheckSquare size={11} /> {l.checklist_done ?? 0}/{l.checklist_total}
                          </span>
                        )}
                      </div>
                      {!!l.tags?.length && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                          {l.tags.slice(0, 4).map(t => (
                            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-pill)', background: 'var(--brand-teal-100)', color: 'var(--brand-teal-600)', border: '1px solid #b2d8d8' }}>
                              <Tag size={8} /> {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
