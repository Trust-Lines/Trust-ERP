'use client';

import { formatDateTime } from '@/lib/formatDate';
import { HEADING } from '../designShared';
import type { Activity } from './sheetShared';

/** `loading` is true until the notes feed (which also carries activity) has loaded. */
export function ActivityTab({ loading, activity }: { loading: boolean; activity: Activity[] }) {
  if (loading) return <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p>;
  if (activity.length === 0) return <p className="m-0 text-[13px] text-ui-text-secondary">Nothing yet.</p>;
  return (
    <ol className="m-0 flex list-none flex-col gap-0 p-0">
      {activity.map(a => (
        <li key={a.id} className="flex gap-3 border-b border-ui-divider py-2.5 text-[13px] last:border-0">
          <span className="w-[130px] shrink-0 text-[12px] text-ui-text-secondary">{formatDateTime(a.created_at)}</span>
          <span className="text-ui-body"><b className={HEADING}>{a.actor_name}</b> {a.kind === 'comment' ? 'wrote: ' : ''}{a.body}</span>
        </li>
      ))}
    </ol>
  );
}
