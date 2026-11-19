'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { Activity, Note } from './sheetShared';

/** Notes + activity for one job. One request feeds both tabs; loaded lazily (notes === null until then). */
export function useJobFeed(jobId: string) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);

  const loadFeed = useCallback(async () => {
    try {
      const res = await fetch(`/api/design-jobs/${jobId}/notes`);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? 'Could not load notes');
      setNotes(b.notes ?? []); setActivity(b.activity ?? []);
    } catch (e) { setNotes([]); toast.error(e instanceof Error ? e.message : 'Could not load notes'); }
  }, [jobId]);

  const resetFeed = useCallback(() => { setNotes(null); setActivity([]); }, []);

  async function postNote(text: string, quiet = false): Promise<boolean> {
    const res = await fetch(`/api/design-jobs/${jobId}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) }).catch(() => null);
    const b = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) { toast.error(b.error ?? 'Could not post the note'); return false; }
    setNotes(n => [...(n ?? []), b.note]);
    if (!quiet) toast.success('Note posted');
    return true;
  }

  return { notes, activity, loadFeed, resetFeed, postNote };
}
