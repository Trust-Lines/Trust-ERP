import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api } from './api';

/** GET `path` (null = skip); loads on focus, so it also refreshes when the user comes back. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async (mode: 'refresh' | 'silent' = 'silent') => {
    if (!path) return;
    const n = ++seq.current;
    if (mode === 'refresh') setRefreshing(true);
    try {
      const res = await api<T>(path);
      if (n === seq.current) { setData(res); setError(null); }
    } catch (e) {
      if (n === seq.current) setError(e instanceof Error ? e.message : 'Bilinmeyen hata');
    } finally {
      if (n === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [path]);

  useFocusEffect(useCallback(() => { void load('silent'); }, [load]));

  return { data, error, loading: loading && !data, refreshing, reload: () => load('refresh'), setData };
}
