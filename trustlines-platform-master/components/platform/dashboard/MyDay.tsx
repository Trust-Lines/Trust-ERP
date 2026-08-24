'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { MyDayData, MyDayItem, MyDaySection } from '@/lib/dashboard/myDay';

const TONE: Record<NonNullable<MyDayItem['tone']>, string> = {
  default: 'var(--fg-subtle)',
  warn: 'var(--status-warning-fg, #b45309)',
  danger: 'var(--status-danger, #dc2626)',
  good: 'var(--status-success-fg)',
};

export function MyDay() {
  const [data, setData] = useState<MyDayData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/my-day');
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as MyDayData;
        if (live) { setData(json); setError(false); }
      } catch {
        if (live) setError(true);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);

  if (loading) {
    return (
      <section aria-label="My Day" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>My Day</h2>
        <div className="card" style={{ padding: 16, color: 'var(--fg-subtle)', fontSize: 13 }}>Loading your day…</div>
      </section>
    );
  }

  if (error) {
    return (
      <section aria-label="My Day" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>My Day</h2>
        <div className="card" style={{ padding: 16, fontSize: 13, color: 'var(--status-danger, #dc2626)' }}>
          Couldn’t load your day. Refresh to try again.
        </div>
      </section>
    );
  }

  const sections = (data?.sections ?? []).filter(s => s.items.length > 0);

  if (sections.length === 0) {
    return (
      <section aria-label="My Day" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>My Day</h2>
        <div className="card" style={{ padding: 16, fontSize: 13, color: 'var(--fg-subtle)' }}>
          Nothing needs you right now. 🎉
        </div>
      </section>
    );
  }

  return (
    <section aria-label="My Day" style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>My Day</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {sections.map(section => (
          <SectionCard key={section.key} section={section} />
        ))}
      </div>
    </section>
  );
}

function SectionCard({ section }: { section: MyDaySection }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{section.title}</h3>
        <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{section.items.length}</span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {section.items.map((item, i) => (
          <li key={i}>
            <Link
              href={item.href}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, textDecoration: 'none', color: 'inherit', padding: '4px 0' }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: TONE[item.tone ?? 'default'] }}>
                  {item.label}
                </span>
                {item.sublabel && (
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--fg-subtle)' }}>{item.sublabel}</span>
                )}
              </span>
              {item.badge && (
                <span className="pill" style={{ fontSize: 10, background: 'var(--bg-sunken)', color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>{item.badge}</span>
              )}
              <ChevronRight size={14} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
