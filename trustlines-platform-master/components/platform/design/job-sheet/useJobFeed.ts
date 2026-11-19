'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { errorText, fetchJson } from '@/lib/client/fetchJson';
import type { Activity, Note } from './sheetShared';

/** Notes + activity for one job. One request feeds both tabs; loaded lazily (notes === null until then). */
export function useJobFeed(jobId: string) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);

  const loadFeed = useCallback(async () => {
    try {
      const b = await fetchJson<{ notes?: Note[]; activity?: Activity[] }>(`/api/design-jobs/${jobId}/notes`, { errorMessage: 'Could not load notes' });
      setNotes(b.notes ?? []); setActivity(b.activity ?? []);
    } catch (e) { setNotes([]); toast.error(errorText(e, 'Could not load notes')); }
  }, [jobId]);

  const resetFeed = useCallback(() => { setNotes(null); setActivity([]); }, []);

  async function postNote(text: string, quiet = false): Promise<boolean> {
    try {
      const b = await fetchJson<{ note: Note }>(`/api/design-jobs/${jobId}/notes`, { method: 'POST', body: { body: text }, errorMessage: 'Could not post the note' });
      setNotes(n => [...(n ?? []), b.note]);
      if (!quiet) toast.success('Note posted');
      return true;
    } catch (e) {
      toast.error(errorText(e, 'Could not post the note'));
      return false;
    }
  }

  return { notes, activity, loadFeed, resetFeed, postNote };
}
