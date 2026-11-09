'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { HrAgendaItem, HrCalendarEvent, HrContainer, HrOrder, HrUnavailable } from './types';
import { dayKey, daysUntil } from './tones';

// Data for the HR pages. Containers come from the existing GET /api/containers. Everything else
// (events, orders, unavailable staff) has no backend yet: what people add through the HR forms
// lives in this tab's memory only — it survives moving between HR pages, not a reload — until
// HR endpoints exist. Nothing here is sample data.

// ── Containers (real) ──────────────────────────────────────────────────────────────────────
interface ContainerRow {
  id: string;
  container_no: string | null;
  booking_no: string | null;
  estimated_arrival_date: string | null;
  item_count: number | null;
}

export interface HrContainerFeed {
  events: HrCalendarEvent[];
  agenda: HrAgendaItem[];
  upcoming: HrContainer[];
  /** False when this role can't read containers (the API answered 401/403). */
  allowed: boolean;
  loading: boolean;
  error: string | null;
}

export function useHrContainers(today: Date, upcomingCount = 3): HrContainerFeed {
  const [rows, setRows] = useState<ContainerRow[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/containers', { cache: 'no-store' });
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) return;
        if (!res.ok) throw new Error(`Containers could not be loaded (${res.status}).`);
        const body = await res.json() as { containers?: ContainerRow[] };
        if (cancelled) return;
        setRows(body.containers ?? []);
        setAllowed(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Containers could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return useMemo(() => {
    const dated = rows
      .filter((c): c is ContainerRow & { estimated_arrival_date: string } => !!c.estimated_arrival_date)
      .map(c => ({ ...c, label: c.container_no || c.booking_no || 'Container', date: c.estimated_arrival_date.slice(0, 10) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const todayKey = dayKey(today);
    return {
      events: dated.map(c => ({ id: `c:${c.id}`, date: c.date, kind: 'container' as const, label: c.label })),
      agenda: dated.filter(c => c.date === todayKey).map(c => ({
        id: `c:${c.id}`, time: null, kind: 'container' as const, title: c.label,
        detail: c.item_count ? `${c.item_count} Item${c.item_count === 1 ? '' : 's'} · Arriving` : 'Arriving',
      })),
      upcoming: dated.filter(c => daysUntil(c.date, today) >= 0).slice(0, upcomingCount)
        .map(c => ({ id: c.id, label: c.label, itemCount: c.item_count, dueDate: c.date })),
      allowed, loading, error,
    };
  }, [rows, today, upcomingCount, allowed, loading, error]);
}

// ── Entries added in this tab (no backend yet) ─────────────────────────────────────────────
export interface HrLocalEvent extends HrCalendarEvent {
  /** "10:30"; null = all day. */
  time: string | null;
  detail?: string | null;
}

interface LocalState {
  events: HrLocalEvent[];
  orders: HrOrder[];
  unavailable: HrUnavailable[];
}

let state: LocalState = { events: [], orders: [], unavailable: [] };
const EMPTY = state;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const setState = (next: Partial<LocalState>) => { state = { ...state, ...next }; listeners.forEach(fn => fn()); };
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export function useHrLocal() {
  const s = useSyncExternalStore(subscribe, () => state, () => EMPTY);
  return {
    ...s,
    addEvent: (e: Omit<HrLocalEvent, 'id'>) => setState({ events: [...state.events, { ...e, id: newId() }] }),
    addOrder: (o: Omit<HrOrder, 'id'>) => setState({ orders: [...state.orders, { ...o, id: newId() }] }),
    addUnavailable: (u: Omit<HrUnavailable, 'id'>) => setState({ unavailable: [...state.unavailable, { ...u, id: newId() }] }),
  };
}

/** Today's agenda entries from locally added events, by time (all-day last). */
export function localAgenda(events: HrLocalEvent[], today: Date): HrAgendaItem[] {
  const key = dayKey(today);
  return events
    .filter(e => e.date === key)
    .sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))
    .map(e => ({ id: e.id, time: e.time, kind: e.kind, title: e.label, detail: e.detail ?? null }));
}

export const byDate = <T extends { dueDate?: string; date?: string }>(a: T, b: T) =>
  (a.dueDate ?? a.date ?? '').localeCompare(b.dueDate ?? b.date ?? '');
