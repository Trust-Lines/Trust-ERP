'use client';

import { useEffect, useState } from 'react';

interface Review {
  title: string | null;
  status: string;
  decision: string | null;
  requireEmailVerification: boolean;
  project: { code: string; name: string } | null;
  document: { file_name: string; doc_type: string; viewUrl: string | null } | null;
  contactName: string | null;
}

const box: React.CSSProperties = { fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', minHeight: '100vh', background: '#f4f4f2', color: '#111', display: 'flex', justifyContent: 'center', padding: '24px 16px' };
const card: React.CSSProperties = { background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,.1)', maxWidth: 720, width: '100%', overflow: 'hidden', alignSelf: 'flex-start' };

export function ReviewClient({ token }: { token: string }) {
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/public/reviews/${token}`);
        const b = await res.json().catch(() => ({}));
        if (!res.ok) { setError(b.error ?? 'This link could not be opened.'); return; }
        setReview(b);
        if (b.contactName && !name) setName(b.contactName);
        if (b.decision) setDone(b.decision);
      } catch { setError('This link could not be opened.'); }
      finally { setLoading(false); }
    })();
  }, [token]);

  async function act(action: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/public/reviews/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, name, email, comment }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { alert(b.error ?? 'Something went wrong.'); return; }
      if (action === 'comment') { setComment(''); alert('Thank you — your comment was sent.'); }
      else setDone(b.decision);
    } finally { setBusy(false); }
  }

  if (loading) return <div style={box}><div style={{ ...card, padding: 40, textAlign: 'center', color: '#666' }}>Loading…</div></div>;
  if (error) return <div style={box}><div style={{ ...card, padding: 40, textAlign: 'center' }}><h2 style={{ margin: '0 0 8px' }}>Link unavailable</h2><p style={{ color: '#666', margin: 0 }}>{error}</p></div></div>;
  if (!review) return null;

  const decided = done ?? review.decision;
  const decisionLabel: Record<string, string> = { approved: 'Approved ✓', rejected: 'Rejected', revision_requested: 'Revision requested' };

  return (
    <div style={box}>
      <div style={card}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eee', background: '#0f2e2b', color: '#fff' }}>
          <div style={{ fontSize: 13, opacity: .8 }}>Trust-Lines · Customer review</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{review.title || review.document?.file_name || 'Document review'}</div>
          {review.project && <div style={{ fontSize: 13, opacity: .85, marginTop: 2 }}>{review.project.code} — {review.project.name}</div>}
        </div>

        <div style={{ padding: 24 }}>
          {review.document ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>Document</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: '1px solid #e5e5e5', borderRadius: 8 }}>
                <span style={{ fontWeight: 600, flex: 1 }}>{review.document.file_name}</span>
                {review.document.viewUrl && <a href={review.document.viewUrl} target="_blank" rel="noreferrer" style={{ color: '#0d9488', fontWeight: 600, textDecoration: 'none' }}>Open document →</a>}
              </div>
            </div>
          ) : (
            <p style={{ color: '#666' }}>Please review the item described above.</p>
          )}

          {decided ? (
            <div style={{ padding: '16px', borderRadius: 8, background: decided === 'approved' ? '#dcfce7' : '#fef3c7', color: decided === 'approved' ? '#15803d' : '#92400e', fontWeight: 600, textAlign: 'center' }}>
              You have {decisionLabel[decided] ?? decided} this. Thank you — the Trust-Lines team has been notified.
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#666' }}>Your name *</label>
                  <input value={name} onChange={e => setName(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#666' }}>Your email {review.requireEmailVerification ? '*' : '(optional)'}</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#666' }}>Comment (optional)</label>
                <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => act('approve')} disabled={busy} style={{ ...btn, background: '#15803d', color: '#fff' }}>Approve</button>
                <button onClick={() => act('request_revision')} disabled={busy} style={{ ...btn, background: '#f59e0b', color: '#fff' }}>Request revision</button>
                <button onClick={() => act('reject')} disabled={busy} style={{ ...btn, background: '#dc2626', color: '#fff' }}>Reject</button>
                <button onClick={() => act('comment')} disabled={busy || !comment.trim()} style={{ ...btn, background: '#e5e5e5', color: '#111' }}>Send comment only</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid #d4d4d4', borderRadius: 7, fontSize: 14, marginTop: 4, boxSizing: 'border-box' };
const btn: React.CSSProperties = { padding: '10px 18px', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
