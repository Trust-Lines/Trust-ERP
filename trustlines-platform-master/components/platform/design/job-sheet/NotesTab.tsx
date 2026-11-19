'use client';

import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/lib/formatDate';
import { cn } from '@/lib/utils';
import type { Note } from './sheetShared';

/** The deal's own notes, shared with the CRM. Ctrl/Cmd+Enter posts. */
export function NotesTab({ notes, me, onPost }: { notes: Note[] | null; me: string; onPost: (text: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [notes?.length]);

  async function send() {
    const t = draft.trim();
    if (!t || sending) return;
    setSending(true);
    if (await onPost(t)) setDraft('');
    setSending(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[14px] text-ui-text-secondary">The same notes Sales sees on the deal in the CRM — a note here notifies Sales, a note there notifies the designer.</p>
      <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto rounded-[8px] bg-ui-surface p-4">
        {notes === null ? <p className="m-0 text-[14px] text-ui-text-secondary">Loading…</p>
          : notes.length === 0 ? <p className="m-0 text-[14px] text-ui-text-secondary">No notes yet. Ask Sales a question or leave an update.</p>
            : notes.map(n => {
              const mine = n.author_id === me;
              return (
                <div key={n.id} className={cn('flex max-w-[85%] flex-col gap-1', mine && 'self-end items-end')}>
                  <span className="text-[13px] text-ui-text-secondary">{n.author_name ?? 'Someone'} · {formatDateTime(n.created_at)}</span>
                  <p className={cn('m-0 whitespace-pre-wrap rounded-[8px] px-3 py-2 text-[14px]', mine ? 'bg-[var(--color-secondary-700)] text-white dark:bg-primary-50 dark:text-primary-950' : 'bg-ui-surface-elevated text-ui-body')}>{n.body}</p>
                </div>
              );
            })}
        <div ref={endRef} />
      </div>
      <div className="flex flex-col gap-2">
        <Textarea
          aria-label="New note" className="text-[14px] leading-[1.5]" placeholder="Write a note… (Ctrl+Enter to send)" rows={3} value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }}
        />
        <Button size="md" className="self-end" disabled={!draft.trim() || sending} onClick={() => void send()}><Send /> {sending ? 'Sending…' : 'Post note'}</Button>
      </div>
    </div>
  );
}
