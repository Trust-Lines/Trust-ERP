'use client';

import { useCallback, useEffect, useState } from 'react';
import { sendJson } from '@/components/platform/marketing/pr/shared';
import type { Detail } from './campaignData';

/** Loads one campaign (with a page of recipients) and polls every 15 s while it's sending. */
export function useCampaignDetail(id: string) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilterState] = useState('');

  const load = useCallback(async () => {
    try {
      setDetail(await sendJson<Detail>(`/api/marketing/email-campaigns/${id}?page=${page}&filter=${filter}`, 'GET'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the campaign');
    }
  }, [id, page, filter]);
  useEffect(() => { load(); }, [load]);

  // While it's sending, refresh the numbers every 15 seconds.
  const status = detail?.campaign.status;
  useEffect(() => {
    if (status !== 'sending') return;
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [status, load]);

  /** Changing the recipient filter goes back to page 1. */
  const setFilter = (f: string) => { setFilterState(f); setPage(1); };

  return { detail, error, page, setPage, filter, setFilter, load };
}
