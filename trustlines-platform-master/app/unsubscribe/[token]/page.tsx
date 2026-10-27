'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

// Public page behind every campaign's "Unsubscribe" link. One button, no login. The address
// isn't shown (the link may have been forwarded), and nothing happens until the button is pressed.
const wrap: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  fontFamily: 'Arial, Helvetica, sans-serif', background: '#f4f4f5', color: '#1f2937',
};
const card: React.CSSProperties = { maxWidth: 440, width: '100%', background: '#fff', borderRadius: 10, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,.08)', textAlign: 'center' };

export default function UnsubscribePage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const isTest = token === 'test';

  async function confirm() {
    setState('busy');
    try {
      const res = await fetch(`/api/public/email/unsubscribe/${encodeURIComponent(token)}`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Something went wrong');
      setState('done');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong');
      setState('error');
    }
  }

  return (
    <main style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Trust-Lines</div>
        {isTest ? (
          <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>This is the unsubscribe link of a test email — in a real campaign, the recipient unsubscribes here.</p>
        ) : state === 'done' ? (
          <>
            <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>You’re unsubscribed</h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>You won’t receive these emails from us again. If this was a mistake, just reply to any of our emails.</p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Unsubscribe from our emails?</h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>We’ll stop sending marketing emails to this address.</p>
            <button
              type="button" onClick={confirm} disabled={state === 'busy'}
              style={{ background: '#111827', color: '#fff', border: 0, borderRadius: 6, padding: '11px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: state === 'busy' ? 0.6 : 1 }}
            >
              {state === 'busy' ? 'Unsubscribing…' : 'Unsubscribe'}
            </button>
            {state === 'error' && <p role="alert" style={{ color: '#b91c1c', fontSize: 13, marginTop: 14 }}>{message}</p>}
          </>
        )}
      </div>
    </main>
  );
}
