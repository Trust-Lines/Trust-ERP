'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { MessageSquare, Loader2, Send, Activity } from 'lucide-react';
import { Avatar } from '@/components/platform/shared/Avatar';
import { formatDate } from '@/lib/formatDate';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { FIELD, HEADING, PANEL, PANEL_HEAD, PANEL_TITLE } from './panelStyles';

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

export function ActivityFeed({ apiBasePath }: { apiBasePath: string }) {
  const [items, setItems]   = useState<ActivityRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBasePath}/activity`);
      const data = await res.json() as { activity: ActivityRow[] };
      setItems(data.activity ?? []);
    } catch { }
    finally { setLoaded(true); }
  }, [apiBasePath]);

  useEffect(() => { load(); }, [load]);

  async function postComment() {
    const text = comment.trim();
    if (!text) return;
    setPosting(true);
    try {
      const res = await fetch(`${apiBasePath}/activity`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }),
      });
      if (!res.ok) throw new Error();
      setComment('');
      await load();
    } catch { toast.error('Could not post comment'); }
    finally { setPosting(false); }
  }

  return (
    <section aria-label="Comments and history" className={PANEL}>
      <div className={PANEL_HEAD}>
        <h3 className={PANEL_TITLE}>Comments &amp; history</h3>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void postComment(); }}>
          <input aria-label="Comment" placeholder="Write a comment…" value={comment} onChange={e => setComment(e.target.value)} className={FIELD} />
          <Button type="submit" size="icon-md" className="shrink-0" disabled={posting || !comment.trim()} aria-label="Post comment">
            {posting ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          </Button>
        </form>

        {!loaded ? (
          <p className="m-0 inline-flex items-center gap-2 text-[13px] text-ui-text-secondary"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading…</p>
        ) : items.length === 0 ? (
          <EmptyState size="sm" className="justify-center py-4" icon={<Activity />} title="No activity yet." />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {items.map(a => (
              <li key={a.id} className="flex items-start gap-2.5">
                {a.kind === 'comment'
                  ? <Avatar name={a.actor_name} size="sm" />
                  : <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ui-surface text-ui-text-secondary"><MessageSquare className="size-3" aria-hidden /></span>}
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[13px] leading-[1.5] text-ui-body">
                    <b className={HEADING}>{a.actor_name}</b>{' '}
                    <span className={a.kind === 'change' ? 'text-ui-text-secondary' : undefined}>{a.body}</span>
                  </p>
                  <p className="m-0 mt-px text-[11px] text-ui-text-secondary">{timeAgo(a.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
