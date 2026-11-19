import { describe, expect, it } from 'vitest';
import { buildHeadcount, buildReport, localDay, overlapDays, parseMonth, reportCsv, shiftMonth, type ReportPerson } from '@/lib/hr/reports';

const person = (o: Partial<ReportPerson> = {}): ReportPerson => ({
  id: 'u1', full_name: 'Ayse', role: 'designer', department: 'design', office: 'turkey', is_active: true, created_at: '2025-01-10T09:00:00Z', ...o,
});

describe('month helpers', () => {
  it('parses and shifts months', () => {
    expect(parseMonth('2026-03')).toBe('2026-03');
    expect(parseMonth('2026-13', new Date('2026-11-19T10:00:00Z'))).toBe('2026-11');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
  it('counts overlapping days', () => {
    expect(overlapDays('2026-10-28', '2026-11-03', '2026-11-01', '2026-11-30')).toBe(3);
    expect(overlapDays('2026-12-01', '2026-12-03', '2026-11-01', '2026-11-30')).toBe(0);
  });
  it('uses the office time zone for days', () => {
    expect(localDay('2026-11-10T22:30:00Z', 'Europe/Istanbul')).toBe('2026-11-11');
    expect(localDay('2026-11-10T22:30:00Z', 'America/New_York')).toBe('2026-11-10');
  });
});

describe('buildReport', () => {
  const base = { month: '2026-11', today: '2026-11-19', people: [person()] };

  it('counts present days and worked hours without breaks', () => {
    const r = buildReport({
      ...base,
      punches: [
        { user_id: 'u1', kind: 'in', punched_at: '2026-11-02T06:00:00Z' },          // 09:00 Istanbul
        { user_id: 'u1', kind: 'break_start', punched_at: '2026-11-02T09:00:00Z' },
        { user_id: 'u1', kind: 'break_end', punched_at: '2026-11-02T10:00:00Z' },
        { user_id: 'u1', kind: 'out', punched_at: '2026-11-02T15:00:00Z' },
        { user_id: 'u1', kind: 'in', punched_at: '2026-11-03T06:00:00Z' },          // never clocked out
      ],
      shifts: [], leaves: [],
    });
    expect(r.people[0]).toMatchObject({ present: 2, hours: 8 });
  });

  it('marks late and absent only on planned days, excusing approved leave', () => {
    const r = buildReport({
      ...base,
      punches: [
        { user_id: 'u1', kind: 'in', punched_at: '2026-11-02T06:05:00Z' }, // 09:05 — within grace
        { user_id: 'u1', kind: 'in', punched_at: '2026-11-03T06:30:00Z' }, // 09:30 — late
      ],
      shifts: [
        { user_id: 'u1', shift_date: '2026-11-02', start_time: '09:00:00' },
        { user_id: 'u1', shift_date: '2026-11-03', start_time: '09:00:00' },
        { user_id: 'u1', shift_date: '2026-11-04', start_time: '09:00:00' }, // no punch → absent
        { user_id: 'u1', shift_date: '2026-11-05', start_time: '09:00:00' }, // on leave
        { user_id: 'u1', shift_date: '2026-11-25', start_time: '09:00:00' }, // future
      ],
      leaves: [{ user_id: 'u1', reason: 'sick', start_date: '2026-11-05', end_date: '2026-11-05', status: 'approved' }],
    });
    expect(r.people[0]).toMatchObject({ planned: 5, late: 1, absent: 1, sick: 1 });
  });

  it('sums leave by reason for the month and the year, and counts pending', () => {
    const r = buildReport({
      ...base, punches: [], shifts: [],
      leaves: [
        { user_id: 'u1', reason: 'vacation', start_date: '2026-11-28', end_date: '2026-12-02', status: 'approved' },
        { user_id: 'u1', reason: 'vacation', start_date: '2026-06-01', end_date: '2026-06-05', status: 'approved' },
        { user_id: 'u1', reason: 'vacation', start_date: '2026-11-10', end_date: '2026-11-10', status: 'rejected' },
        { user_id: 'u1', reason: 'personal', start_date: '2026-12-10', end_date: '2026-12-10', status: 'pending' },
      ],
    });
    expect(r.people[0]).toMatchObject({ vacation: 3, vacationYear: 8, pending: 1 });
  });

  it('leaves inactive people out', () => {
    const r = buildReport({ ...base, people: [person(), person({ id: 'u2', is_active: false })], punches: [], shifts: [], leaves: [] });
    expect(r.people.map(p => p.id)).toEqual(['u1']);
    expect(r.headcount).toMatchObject({ active: 1, inactive: 1 });
  });
});

describe('buildHeadcount', () => {
  it('groups active staff and builds a 6-month trend', () => {
    const h = buildHeadcount([
      person({ id: 'a', created_at: '2026-01-05T09:00:00Z' }),
      person({ id: 'b', department: 'sales', role: 'sales', created_at: '2026-11-03T09:00:00Z' }),
      person({ id: 'c', department: null, created_at: '2026-09-15T09:00:00Z' }),
    ], '2026-11');
    expect(h.joinedThisMonth).toBe(1);
    expect(h.byDepartment[0]).toEqual({ key: 'design', count: 1 });
    expect(h.byDepartment.map(d => d.key)).toEqual(['design', 'sales', '']);
    expect(h.trend.map(t => t.count)).toEqual([1, 1, 1, 2, 2, 3]);
    expect(h.trend[5].month).toBe('2026-11');
  });
});

describe('reportCsv', () => {
  it('quotes cells and starts with a BOM', () => {
    const r = buildReport({ month: '2026-11', today: '2026-11-19', people: [person({ full_name: 'A "B"' })], punches: [], shifts: [], leaves: [] });
    const csv = reportCsv(r, () => ({ role: 'Designer', department: 'Design' }));
    expect(csv.startsWith('﻿"Name"')).toBe(true);
    expect(csv).toContain('"A ""B"""');
  });
});
