'use client';

import { useMemo, useState } from 'react';
import { DAY_MS, startOfDay } from './notificationFormat';
import type { NotificationGroup, NotificationRow, NotificationTab } from './notificationTypes';

/** Tab / search / type / date-range filtering plus day grouping. */
export function useNotificationFilters(items: NotificationRow[], now: number) {
  const [tab, setTab] = useState<NotificationTab>('all');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [rangeDays, setRangeDays] = useState(7);

  const inRange = useMemo(() => items.filter(n => new Date(n.created_at).getTime() >= now - rangeDays * DAY_MS), [items, now, rangeDays]);
  const unreadCount = inRange.filter(n => !n.is_read).length;
  const types = useMemo(() => [...new Set(items.map(n => n.type))].sort(), [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inRange
      .filter(n => tab === 'all' || !n.is_read)
      .filter(n => !typeFilter || n.type === typeFilter)
      .filter(n => !q || [n.title, n.body ?? '', n.project?.code ?? '', n.project?.name ?? ''].some(v => v.toLowerCase().includes(q)));
  }, [inRange, tab, typeFilter, query]);

  const groups = useMemo(() => {
    const out: NotificationGroup[] = [];
    for (const n of visible) {
      const day = startOfDay(new Date(n.created_at));
      const last = out[out.length - 1];
      if (last && last.day === day) last.rows.push(n);
      else out.push({ day, rows: [n] });
    }
    return out;
  }, [visible]);

  return {
    tab, setTab, query, setQuery, typeFilter, setTypeFilter, rangeDays, setRangeDays,
    inRange, unreadCount, types, visible, groups,
    hasActiveFilters: !!query.trim() || !!typeFilter,
  };
}
