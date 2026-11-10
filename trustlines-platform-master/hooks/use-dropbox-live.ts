'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DROPBOX_CHANGED } from '@/lib/realtime/broadcast';

/**
 * Call `onChange` when the Dropbox webhook reports a change under this topic (a project's or a
 * design job's folder — see lib/realtime/broadcast). Bursts fold into one call after `delayMs`.
 */
export function useDropboxLive(topic: string | null, onChange: () => void, delayMs = 800) {
  const cb = useRef(onChange);
  useEffect(() => { cb.current = onChange; });
  useEffect(() => {
    if (!topic) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase.channel(topic)
      .on('broadcast', { event: DROPBOX_CHANGED }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => cb.current(), delayMs);
      })
      .subscribe();
    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(channel); };
  }, [topic, delayMs]);
}
