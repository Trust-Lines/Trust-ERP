'use client';

import { useLiveRefresh } from '@/hooks/use-live-refresh';

/** Drop into a server page to re-render it when these tables change (see useLiveRefresh). */
export function LiveRefresh({ name, tables }: { name: string; tables: string[] }) {
  useLiveRefresh(name, tables);
  return null;
}
