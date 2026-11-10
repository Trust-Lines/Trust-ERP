'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Re-render the server page when any of `tables` changes (Supabase Realtime) — e.g. a PDF the
 * Dropbox webhook just turned into a document row. Bursts (a whole folder synced at once) are
 * folded into one refresh after `delayMs`.
 */
export function useLiveRefresh(name: string, tables: string[], delayMs = 1500) {
  const router = useRouter();
  const key = tables.join(',');
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), delayMs);
    };
    let channel = supabase.channel(`live-${name}`);
    for (const table of key.split(',')) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, bump);
    }
    channel.subscribe();
    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(channel); };
  }, [name, key, delayMs, router]);
}
