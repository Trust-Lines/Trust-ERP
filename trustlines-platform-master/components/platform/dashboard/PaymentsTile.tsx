'use client';

import { useEffect, useState } from 'react';
import type { CurrencyTotals } from '@/lib/suppliers/config';
import { StatTile } from './StatTile';

// Figma "General Manager" → "Total Payments" KPI tile (node 818:31871). Real data only: the sum of
// supplier payments from the existing GET /api/suppliers (role-gated there by SUPPLIER_READ_ROLES —
// vendor cost, never shown to tlines_pm). The big number is USD; TL / EUR payments go in the sub-line
// (no exchange rate in the platform, so currencies are never added together). That endpoint has no
// payment dates, so the tile shows no "+N New" badge or sparkline.

type Totals = Record<'USD' | 'TL' | 'EUR', number>;

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export function PaymentsTile({ color, onColor }: { color: string; onColor: string }) {
  const [paid, setPaid] = useState<Totals | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/suppliers', { cache: 'no-store', signal: controller.signal })
      .then(res => { if (!res.ok) throw new Error(String(res.status)); return res.json(); })
      .then((json: { suppliers?: { totals?: CurrencyTotals }[] }) => {
        const sum: Totals = { USD: 0, TL: 0, EUR: 0 };
        for (const s of json.suppliers ?? []) {
          for (const cur of ['USD', 'TL', 'EUR'] as const) sum[cur] += Number(s.totals?.[cur]?.paid) || 0;
        }
        setPaid(sum);
      })
      .catch(e => { if (!(e instanceof DOMException && e.name === 'AbortError')) setError(true); });
    return () => controller.abort();
  }, []);

  const others = paid ? [paid.TL > 0 && `₺ ${fmt(paid.TL)}`, paid.EUR > 0 && `€ ${fmt(paid.EUR)}`].filter(Boolean).join(' · ') : '';
  const sub = error ? 'Couldn’t load payments' : !paid ? 'Loading…' : others ? `Paid to suppliers · ${others}` : 'Paid to suppliers';

  return (
    <StatTile
      label="Total Payments"
      value={paid ? `$ ${fmt(paid.USD)}` : '—'}
      icon={null}
      sub={sub}
      href="/suppliers"
      color={color}
      onColor={onColor}
    />
  );
}
