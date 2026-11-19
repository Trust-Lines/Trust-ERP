'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { NotificationRow } from './notificationTypes';

/** Holds the notification list and marks rows read with an optimistic update. */
export function useMarkRead(userId: string, notifications: NotificationRow[]) {
  const router = useRouter();
  const [items, setItems] = useState(notifications);
  const [busy, setBusy] = useState(false);

  // RLS "own_notifications" lets a user update only their own rows — no API route needed.
  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    setBusy(true);
    const prev = items;
    setItems(list => list.map(n => (ids.includes(n.id) ? { ...n, is_read: true } : n)));
    const { error } = await createClient()
      .from('notifications')
      .update({ is_read: true } as never)
      .eq('user_id', userId)
      .in('id', ids);
    setBusy(false);
    if (error) {
      setItems(prev);
      toast.error('Could not mark as read');
      return;
    }
    router.refresh();
  }

  return { items, busy, markRead };
}
