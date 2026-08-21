'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { MessageSquare, Loader2, Send } from 'lucide-react';
import { Avatar } from '@/components/platform/shared/Avatar';
import { formatDate } from '@/lib/formatDate';

interface ActivityRow {
  id: string;
  actor_id: string | null;
  actor_name: string;
  kind: 'comment' | 'change';
  body: string | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '';
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return formatDate(iso);
}

export function LeadActivity({ intakeId }: { intakeId: string }) {
  const [items, setItems]   = useState<ActivityRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${intakeId}/activity`);
      const data = await res.json() as { activity: ActivityRow[] };
      setItems(data.activity ?? []);
    } catch { }
    finally { setLoaded(true); }
  }, [intakeId]);

  useEffect(() => { load(); }, [load]);

  async function postComment() {
    const text = comment.trim();
    if (!text) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/leads/${intakeId}/activity`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }),
      });
      if (!res.ok) throw new Error();
      setComment('');
      await load();
    } catch { toast.error('Could not post comment'); }
    finally { setPosting(false); }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <style>{`.spin{animation:la-spin 1s linear infinite}@keyframes la-spin{to{transform:rotate(360deg)}}`}</style>
      <div className="card-head">
        <div><div className="text-eyebrow">Activity</div><div className="form-section-title">Comments &amp; history</div></div>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            className="form-input" placeholder="Write a comment…"
            value={comment} onChange={e => setComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); postComment(); } }}
          />
          <button className="btn btn-primary btn-sm" onClick={postComment} disabled={posting || !comment.trim()}>
            {posting ? <Loader2 className="spin" size={14} /> : <Send size={14} />}
          </button>
        </div>

        {!loaded ? (
          <div style={{ color: 'var(--fg-subtle)', fontSize: 13 }}><Loader2 className="spin" size={13} /> Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ color: 'var(--fg-faint)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No activity yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {a.kind === 'comment'
                  ? <Avatar name={a.actor_name} size="sm" />
                  : <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-sunken)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MessageSquare size={12} color="var(--fg-faint)" /></span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    <b>{a.actor_name}</b>{' '}
                    {a.kind === 'change'
                      ? <span style={{ color: 'var(--fg-muted)' }}>{a.body}</span>
                      : <span>{a.body}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 1 }}>{timeAgo(a.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
