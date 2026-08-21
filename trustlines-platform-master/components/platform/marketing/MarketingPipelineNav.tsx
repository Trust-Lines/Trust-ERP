'use client';

import Link from 'next/link';
import { Users, Clock, Target, ArrowRight } from 'lucide-react';

interface Props {
  current: 'prospects' | 'potentials' | 'opportunities';
  prospectCount: number | null;
  potentialCount: number | null;
  opportunityCount: number | null;
}

const SEGMENTS = [
  { key: 'prospects' as const, href: '/marketing/prospects', label: 'Lead Cloud', icon: Users },
  { key: 'potentials' as const, href: '/marketing/potentials', label: 'Potentials', icon: Clock },
  { key: 'opportunities' as const, href: '/leads', label: 'Opportunities', icon: Target },
];

function countFor(key: Props['current'], p: Props): string {
  const n = key === 'prospects' ? p.prospectCount : key === 'potentials' ? p.potentialCount : p.opportunityCount;
  return n === null ? '' : String(n);
}

export function MarketingPipelineNav(props: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
      {SEGMENTS.map((s, i) => {
        const Icon = s.icon;
        const isCurrent = s.key === props.current;
        const count = countFor(s.key, props);
        const inner = (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 7,
            background: isCurrent ? 'var(--bg-subtle)' : 'transparent',
            color: isCurrent ? 'var(--brand-navy)' : 'var(--fg-muted)',
            fontWeight: isCurrent ? 700 : 500, fontSize: 12.5,
          }}>
            <Icon size={13} />
            <span>{s.label}</span>
            {count !== '' && <span style={{ fontSize: 11, opacity: 0.75 }}>({count})</span>}
          </div>
        );
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {isCurrent ? inner : (
              <Link href={s.href} style={{ textDecoration: 'none' }}>{inner}</Link>
            )}
            {i < SEGMENTS.length - 1 && <ArrowRight size={12} style={{ color: 'var(--fg-subtle)' }} />}
          </div>
        );
      })}
    </div>
  );
}
