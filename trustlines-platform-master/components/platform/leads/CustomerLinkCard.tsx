'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, UserPlus, X, Contact } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LinkedCustomer { id: string; name: string }
interface Props {
  intakeId: string;
  initialCustomer: LinkedCustomer | null;
  delivered?: boolean;
}

interface SearchHit { id: string; name: string; code: string | null; industry: string | null }

export function CustomerLinkCard({ intakeId, initialCustomer, delivered = false }: Props) {
  const [linked, setLinked] = useState<LinkedCustomer | null>(initialCustomer);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  async function runSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) { setHits([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(q.trim())}`);
      const body = await res.json().catch(() => ({}));
      setHits(res.ok ? (body.customers ?? []) : []);
    } finally { setSearching(false); }
  }

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${intakeId}/link-customer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Failed'); return null; }
      return body;
    } finally { setBusy(false); }
  }

  async function linkExisting(hit: SearchHit) {
    const body = await post({ customerId: hit.id });
    if (!body) return;
    toast.success(`Linked to ${hit.name} — customer info filled in below`);
    window.location.reload();
  }

  async function createFromLead() {
    const body = await post({ create: true });
    if (!body?.customer) return;
    toast.success(`Customer "${body.customer.name}" linked`);
    window.location.reload();
  }

  async function unlink() {
    const body = await post({ customerId: null });
    if (!body) return;
    setLinked(null);
    toast.success('Customer unlinked');
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head"><div className="form-section-title">Customer</div></div>
      <div className="card-body">
        {linked ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Contact size={16} style={{ color: 'var(--fg-subtle)' }} />
            <Link href={`/customers/${linked.id}`} style={{ fontWeight: 600, fontSize: 14 }}>{linked.name}</Link>
            <div style={{ flex: 1 }} />
            <Button variant="ghost" className="text-error-normal" onClick={unlink} disabled={busy}>
              <X size={13} /> Unlink
            </Button>
          </div>
        ) : (
          <div>
            {delivered && (
              <div
                role="alert"
                style={{ fontSize: 12, color: 'var(--status-warning-fg)', background: 'var(--status-warning-bg)', border: '1px solid var(--color-warning-normal)', borderRadius: 6, padding: '8px 10px', marginBottom: 10 }}
              >
                This project was delivered to Trust-Lines with no customer linked. Create one from the lead in one click below — it won’t block anything, but the project won’t have customer contacts until you do.
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 10px' }}>
              Link this lead to a structured End Customer, or create one from the lead’s details.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: hits.length ? 8 : 0 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-primary-400" />
                <Input type="search" className="pl-8" placeholder="Search customers…"
                  value={query} onChange={e => runSearch(e.target.value)} aria-label="Search customers to link" />
              </div>
              <Button onClick={createFromLead} disabled={busy} title="Create a customer from this lead's name/brand/contact">
                <UserPlus size={13} /> Create from lead
              </Button>
            </div>
            {searching && <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>Searching…</div>}
            {hits.length > 0 && (
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden' }}>
                {hits.map(h => (
                  <Button key={h.id} variant="ghost" onClick={() => linkExisting(h)} disabled={busy}
                    className="h-auto w-full justify-start rounded-none border-b border-ui-divider px-3 py-2 text-[13px] font-normal text-primary-800">
                    <span className="font-semibold">{h.name}</span>
                    {h.industry && <span className="text-primary-500"> · {h.industry}</span>}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
