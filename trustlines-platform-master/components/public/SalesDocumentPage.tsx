'use client';

import { useEffect, useState } from 'react';
import { estimateTotals, formatMoney, lineTotal, type LineItem } from '@/lib/sales/documents';

// The customer's page behind an estimate / contract link (/quote/<token>, /contract/<token>).
// No login: the secure token is the key. Plain styling so it prints cleanly ("Save as PDF").

interface Doc {
  number: string; title: string; currency: string; status: string;
  line_items?: LineItem[]; discount_pct?: number; tax_pct?: number; subtotal?: number; total?: number; notes?: string | null; valid_until?: string | null;
  decided_at?: string | null; decided_by_name?: string | null;
  amount?: number; terms?: string; customer_name?: string | null; signer_name?: string | null;
  signed_at?: string | null; signed_name?: string | null; signed_title?: string | null; declined_reason?: string | null;
  sent_at?: string | null;
}
interface Data { doc: Doc; company: string | null; owner: { full_name: string | null; email: string | null } | null; expired: boolean }

const wrap: React.CSSProperties = { minHeight: '100vh', background: '#f4f4f5', padding: '32px 16px', fontFamily: 'Arial, Helvetica, sans-serif', color: '#1f2937' };
const card: React.CSSProperties = { maxWidth: 820, margin: '0 auto', background: '#fff', borderRadius: 10, padding: '32px clamp(16px, 4vw, 40px)', boxShadow: '0 2px 12px rgba(0,0,0,.08)' };
const btn = (primary: boolean): React.CSSProperties => ({
  background: primary ? '#111827' : '#fff', color: primary ? '#fff' : '#111827', border: '1px solid #111827',
  borderRadius: 6, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
});
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 6, padding: '9px 11px', fontSize: 14 };
const DAY = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const day = (iso?: string | null) => (iso ? DAY.format(new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)) : '');

export function SalesDocumentPage({ kind, token }: { kind: 'estimate' | 'contract'; token: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [agree, setAgree] = useState(false);
  const [mode, setMode] = useState<'answer' | 'decline' | 'reject'>('answer');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/public/sales/${kind}/${encodeURIComponent(token)}`);
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { setError(b.error ?? 'This link isn’t valid any more'); return; }
    setData(b);
    if (b.doc?.signer_name) setName(n => n || b.doc.signer_name);
  }
  useEffect(() => { load(); }, [kind, token]);

  async function submit(action: string) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/public/sales/${kind}/${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, name, title, note, agree }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(b.error ?? 'Something went wrong'); return; }
      await load();
    } finally { setBusy(false); }
  }

  if (error) return <main style={wrap}><div style={{ ...card, textAlign: 'center' }}><div style={{ fontWeight: 700, marginBottom: 8 }}>Trust-Lines</div><p style={{ margin: 0 }}>{error}</p></div></main>;
  if (!data) return <main style={wrap}><div style={{ ...card, textAlign: 'center' }}>Loading…</div></main>;
  const d = data.doc;
  const open = d.status === 'sent' && !data.expired;
  const t = estimateTotals(d.line_items ?? [], Number(d.discount_pct ?? 0), Number(d.tax_pct ?? 0));

  return (
    <main style={wrap}>
      <style>{'@media print { .no-print { display: none !important } main { background: #fff !important; padding: 0 !important } }'}</style>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', borderBottom: '2px solid #111827', paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Trust-Lines Design &amp; Supply</div>
            {data.owner && <div style={{ fontSize: 13, color: '#4b5563', marginTop: 4 }}>{data.owner.full_name}{data.owner.email ? ` · ${data.owner.email}` : ''}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{kind === 'estimate' ? 'Estimate' : 'Contract'} {d.number}</div>
            {d.sent_at && <div style={{ fontSize: 13, color: '#4b5563' }}>{day(d.sent_at)}</div>}
            {kind === 'estimate' && d.valid_until && <div style={{ fontSize: 13, color: '#4b5563' }}>Valid until {day(d.valid_until)}</div>}
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Prepared for</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{d.customer_name || data.company || '—'}</div>
          <div style={{ fontSize: 15, marginTop: 6 }}>{d.title}</div>
        </div>

        {kind === 'estimate' ? (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>Item</th><th style={{ padding: 8, textAlign: 'right' }}>Qty</th><th style={{ padding: 8, textAlign: 'right' }}>Unit price</th><th style={{ padding: 8, textAlign: 'right' }}>Total</th>
              </tr></thead>
              <tbody>
                {(d.line_items ?? []).map((i, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: 8 }}>{i.description}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{i.quantity}{i.unit ? ` ${i.unit}` : ''}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{formatMoney(i.unit_price, d.currency)}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{formatMoney(lineTotal(i), d.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginLeft: 'auto', maxWidth: 300, marginTop: 12, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Subtotal</span><span>{formatMoney(Number(d.subtotal), d.currency)}</span></div>
              {Number(d.discount_pct) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Discount ({d.discount_pct}%)</span><span>−{formatMoney(t.discount, d.currency)}</span></div>}
              {Number(d.tax_pct) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Tax ({d.tax_pct}%)</span><span>{formatMoney(t.tax, d.currency)}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #111827', fontWeight: 700, fontSize: 16 }}><span>Total</span><span>{formatMoney(Number(d.total), d.currency)}</span></div>
            </div>
            {d.notes && <div style={{ marginTop: 20, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>{d.notes}</div>}
          </>
        ) : (
          <>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7 }}>{d.terms}</div>
            <div style={{ marginTop: 16, fontSize: 15, fontWeight: 700 }}>Contract amount: {formatMoney(Number(d.amount), d.currency)}</div>
          </>
        )}

        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #e5e7eb' }}>
          {d.status === 'accepted' && <p style={{ margin: 0, fontWeight: 600, color: '#15803d' }}>Accepted by {d.decided_by_name} on {day(d.decided_at)}. Thank you — we’ll be in touch about the next step.</p>}
          {d.status === 'rejected' && <p style={{ margin: 0, color: '#b91c1c' }}>This estimate was declined on {day(d.decided_at)}.</p>}
          {d.status === 'signed' && <p style={{ margin: 0, fontWeight: 600, color: '#15803d' }}>Signed electronically by {d.signed_name}{d.signed_title ? `, ${d.signed_title}` : ''} on {day(d.signed_at)}.</p>}
          {d.status === 'declined' && <p style={{ margin: 0, color: '#b91c1c' }}>This contract was declined.</p>}
          {(d.status === 'expired' || data.expired) && <p style={{ margin: 0, color: '#92400e' }}>This estimate has expired — please ask us for an updated one.</p>}

          {open && (
            <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {kind === 'estimate' ? (
                <>
                  <label style={{ fontSize: 13 }}>Your name<input style={input} value={name} onChange={e => setName(e.target.value)} /></label>
                  <label style={{ fontSize: 13 }}>Note (optional)<textarea style={{ ...input, minHeight: 70 }} value={note} onChange={e => setNote(e.target.value)} /></label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" style={btn(true)} disabled={busy} onClick={() => submit('accept')}>Accept estimate</button>
                    <button type="button" style={btn(false)} disabled={busy} onClick={() => submit('reject')}>Decline</button>
                    <button type="button" style={{ ...btn(false), border: 0 }} onClick={() => window.print()}>Print / save as PDF</button>
                  </div>
                </>
              ) : mode === 'decline' ? (
                <>
                  <label style={{ fontSize: 13 }}>Why are you declining?<textarea style={{ ...input, minHeight: 70 }} value={note} onChange={e => setNote(e.target.value)} /></label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" style={btn(true)} disabled={busy} onClick={() => submit('decline')}>Decline contract</button>
                    <button type="button" style={btn(false)} onClick={() => setMode('answer')}>Back</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <label style={{ fontSize: 13 }}>Full name (your signature)<input style={{ ...input, fontFamily: 'Georgia, serif', fontSize: 16 }} value={name} onChange={e => setName(e.target.value)} /></label>
                    <label style={{ fontSize: 13 }}>Title (optional)<input style={input} value={title} placeholder="e.g. Owner" onChange={e => setTitle(e.target.value)} /></label>
                  </div>
                  <label style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
                    I have read this contract and agree to it. Typing my name and pressing “Sign” is my electronic signature.
                  </label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" style={btn(true)} disabled={busy || !agree || name.trim().length < 3} onClick={() => submit('sign')}>Sign contract</button>
                    <button type="button" style={btn(false)} onClick={() => setMode('decline')}>Decline</button>
                    <button type="button" style={{ ...btn(false), border: 0 }} onClick={() => window.print()}>Print / save as PDF</button>
                  </div>
                </>
              )}
              {msg && <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: 13 }}>{msg}</p>}
            </div>
          )}
          {!open && <button type="button" className="no-print" style={{ ...btn(false), marginTop: 14 }} onClick={() => window.print()}>Print / save as PDF</button>}
        </div>
      </div>
    </main>
  );
}
