'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function WatchButton({ intakeId }: { intakeId: string }) {
  const [watching, setWatching] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leads/${intakeId}/watch`).then(r => r.json()).then((d: { watching: boolean; count: number }) => {
      if (!cancelled) { setWatching(!!d.watching); setCount(d.count ?? 0); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [intakeId]);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${intakeId}/watch`, { method: 'POST' });
      const d = await res.json() as { watching: boolean };
      setWatching(d.watching);
      setCount(c => c + (d.watching ? 1 : -1));
    } catch { }
    finally { setBusy(false); }
  }

  return (
    <Button variant={watching ? 'secondary' : 'ghost'} onClick={toggle} disabled={busy} aria-pressed={watching}
      title={watching ? 'Stop watching this lead' : 'Watch this lead to get notified of changes'}>
      {watching ? <Eye size={14} /> : <EyeOff size={14} />} {watching ? 'Watching' : 'Watch'}{count > 0 ? ` · ${count}` : ''}
    </Button>
  );
}
