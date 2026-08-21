'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PRIORITY_COLOR, type Lead } from './types';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }

export function LeadsCalendar({ leads }: { leads: Lead[] }) {
  const [offset, setOffset] = useState(0);
  const base = new Date();
  const view = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const todayStr = ymd(new Date());

  const byDate = new Map<string, Lead[]>();
  for (const l of leads) {
    if (!l.follow_up_date) continue;
    const arr = byDate.get(l.follow_up_date) ?? [];
    arr.push(l);
    byDate.set(l.follow_up_date, arr);
  }
  const withoutDate = leads.filter(l => !l.follow_up_date).length;

  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{monthLabel}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {withoutDate > 0 && <span style={{ fontSize: 12, color: 'var(--fg-faint)', marginRight: 8 }}>{withoutDate} without a follow-up date</span>}
          <button className="btn btn-ghost btn-sm" onClick={() => setOffset(o => o - 1)}><ChevronLeft size={15} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => setOffset(0)} disabled={offset === 0}>Today</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setOffset(o => o + 1)}><ChevronRight size={15} /></button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
        {DOW.map(d => (
          <div key={d} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--fg-faint)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)' }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          const dateStr = day ? ymd(new Date(year, month, day)) : '';
          const dayLeads = day ? (byDate.get(dateStr) ?? []) : [];
          const isToday = dateStr === todayStr;
          return (
            <div key={i} style={{
              minHeight: 96, padding: 6, borderRight: (i % 7 !== 6) ? '1px solid var(--border-subtle)' : 'none',
              borderBottom: '1px solid var(--border-subtle)', background: day ? 'var(--bg-surface)' : 'var(--bg-subtle)',
            }}>
              {day && (
                <>
                  <div style={{
                    fontSize: 12, fontWeight: isToday ? 700 : 500, marginBottom: 4,
                    color: isToday ? '#fff' : 'var(--fg-subtle)',
                    ...(isToday ? { background: 'var(--brand-teal)', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}),
                  }}>{day}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {dayLeads.slice(0, 4).map(l => (
                      <Link key={l.id} href={`/leads/${l.id}`} title={l.name} style={{
                        display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none',
                        fontSize: 11, padding: '2px 5px', borderRadius: 4, background: 'var(--bg-sunken)', color: 'var(--fg-default)',
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_COLOR[l.priority], flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</span>
                      </Link>
                    ))}
                    {dayLeads.length > 4 && <span style={{ fontSize: 10, color: 'var(--fg-faint)' }}>+{dayLeads.length - 4} more</span>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
