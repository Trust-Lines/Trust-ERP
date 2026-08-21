'use client';

import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { PortfolioRow } from '@/lib/workspace/rows';

export function PortfolioList({ rows, emptyLabel }: { rows: PortfolioRow[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <div className="card-body">
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>{emptyLabel}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rows.map(r => (
        <div key={r.projectId} className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: r.blockers.length || r.myActions.length ? 10 : 0 }}>
            <Link href={`/projects/${r.projectId}`}
              style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg-default)', textDecoration: 'none' }}>
              {r.code ?? '—'}
            </Link>
            <span style={{ fontSize: 12.5, color: 'var(--fg-subtle)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.name}
            </span>
            <span className="pill" style={{ background: 'var(--bg-sunken)', color: 'var(--fg-subtle)' }}>{r.phaseLabel}</span>
            {r.blockers.length === 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--status-success-fg)' }}>
                <CheckCircle2 size={12} /> On track
              </span>
            )}
          </div>

          {r.myActions.length > 0 && (
            <ul style={{ listStyle: 'none', margin: '0 0 8px', padding: 0, display: 'grid', gap: 5 }}>
              {r.myActions.map(a => (
                <li key={a.code}>
                  <Link href={a.href} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, textDecoration: 'none', color: 'var(--fg-default)' }}>
                    <ArrowRight size={13} style={{ color: 'var(--brand-teal)', flexShrink: 0 }} />
                    {a.action}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {r.blockers.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {r.blockers.map(b => (
                <span key={b.code} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--fg-subtle)' }}>
                  <AlertCircle size={12} style={{ color: 'var(--status-warning-fg)' }} /> {b.message}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
