'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_HIDDEN_COLUMNS } from '../LeadsTable';
import type { OpportunityStatus } from '../types';

const STORAGE_KEY = 'leadsTable.hiddenCols.v2';

/** Hidden columns (remembered per browser) and collapsed status groups. */
export function useTableLayout() {
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set(DEFAULT_HIDDEN_COLUMNS));
  const [collapsed, setCollapsed] = useState<Set<OpportunityStatus>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHiddenCols(new Set(JSON.parse(raw) as string[]));
    } catch { /* storage unavailable — keep defaults */ }
  }, []);

  function toggleCol(name: string) {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  function toggleGroup(key: OpportunityStatus) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return { hiddenCols, toggleCol, collapsed, toggleGroup };
}
