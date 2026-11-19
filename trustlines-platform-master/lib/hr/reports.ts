import type { TimePunchKind } from '@/types/database';
import { leaveDays } from './requests';

// HR → Reports: attendance, leave and headcount for one month, worked out from the records the
// mobile app already writes (time_punches 144, hr_requests / hr_shifts 145) and profiles.
// Pure functions — the page loads the rows, these do the counting (tests/hrReports.test.ts).

export const LATE_GRACE_MIN = 10;
/** A session longer than this (a forgotten clock-out) is not counted as worked time. */
const MAX_SESSION_MS = 16 * 3600 * 1000;

/** Days are counted in the person's office time zone. USA has one office (Eastern). */
export const OFFICE_TZ: Record<string, string> = {
  turkey: 'Europe/Istanbul',
  syria: 'Asia/Damascus',
  usa: 'America/New_York',
};
export const DEFAULT_TZ = 'Europe/Istanbul';
export const tzFor = (office: string | null | undefined) => OFFICE_TZ[office ?? ''] ?? DEFAULT_TZ;

export interface ReportPerson {
  id: string;
  full_name: string | null;
  role: string | null;
  department: string | null;
  office: string | null;
  is_active: boolean;
  created_at: string | null;
}
export interface ReportPunch { user_id: string; kind: TimePunchKind; punched_at: string }
export interface ReportShift { user_id: string; shift_date: string; start_time: string }
export interface ReportLeave { user_id: string; reason: string; start_date: string; end_date: string; status: string }

export interface PersonReport {
  id: string;
  name: string;
  role: string | null;
  department: string | null;
  present: number;
  hours: number;
  late: number;
  absent: number;
  planned: number;
  vacation: number;
  sick: number;
  personal: number;
  vacationYear: number;
  pending: number;
}

export interface HeadcountReport {
  active: number;
  inactive: number;
  joinedThisMonth: number;
  byDepartment: { key: string; count: number }[];
  byRole: { key: string; count: number }[];
  /** Active people who had joined by the end of each month, oldest first. */
  trend: { month: string; count: number }[];
}

export interface HrReport {
  month: string;
  people: PersonReport[];
  headcount: HeadcountReport;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** YYYY-MM from ?month=, falling back to the current month. */
export function parseMonth(v: string | null | undefined, now = new Date()): string {
  if (v && MONTH.test(v)) return v;
  return localDay(now.toISOString(), DEFAULT_TZ).slice(0, 7);
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthBounds(month: string): { first: string; last: string } {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(lastDay).padStart(2, '0')}` };
}

const dayFmt = new Map<string, Intl.DateTimeFormat>();
const timeFmt = new Map<string, Intl.DateTimeFormat>();

/** YYYY-MM-DD of an instant in a time zone. */
export function localDay(iso: string, tz: string): string {
  let f = dayFmt.get(tz);
  if (!f) dayFmt.set(tz, f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }));
  return f.format(new Date(iso));
}

/** Minutes after local midnight of an instant in a time zone. */
export function localMinutes(iso: string, tz: string): number {
  let f = timeFmt.get(tz);
  if (!f) timeFmt.set(tz, f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
  const [h, m] = f.format(new Date(iso)).split(':').map(Number);
  return h * 60 + m;
}

const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Calendar days of [start, end] that fall inside [first, last]. */
export function overlapDays(start: string, end: string, first: string, last: string): number {
  const a = start > first ? start : first;
  const b = end < last ? end : last;
  return b < a ? 0 : leaveDays(a, b);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * One month for each person.
 * - present  days with a clock-in (office time zone)
 * - hours    clocked time, in → break / out, breaks excluded; open or >16 h sessions skipped
 * - late     planned days where the first clock-in was more than LATE_GRACE_MIN after the shift start
 * - absent   planned days up to today with no clock-in and no approved leave
 * - leave    approved leave days in the month by reason; vacationYear = Jan 1 → month end
 */
export function buildReport(input: {
  month: string;
  today: string;
  people: ReportPerson[];
  punches: ReportPunch[];
  shifts: ReportShift[];
  leaves: ReportLeave[];
}): HrReport {
  const { month, today } = input;
  const { first, last } = monthBounds(month);
  const yearFirst = `${month.slice(0, 4)}-01-01`;

  const punchesBy = groupBy(input.punches, p => p.user_id);
  const shiftsBy = groupBy(input.shifts, s => s.user_id);
  const leavesBy = groupBy(input.leaves, l => l.user_id);

  const people: PersonReport[] = input.people.filter(p => p.is_active).map(p => {
    const tz = tzFor(p.office);
    const punches = [...(punchesBy.get(p.id) ?? [])].sort((a, b) => a.punched_at.localeCompare(b.punched_at));

    // First clock-in per local day, and worked time credited to the day the session started.
    const firstIn = new Map<string, number>();
    let workedMs = 0;
    let openAt: string | null = null;
    for (const pu of punches) {
      if (pu.kind === 'in') {
        const day = localDay(pu.punched_at, tz);
        if (day >= first && day <= last && !firstIn.has(day)) firstIn.set(day, localMinutes(pu.punched_at, tz));
      }
      if (pu.kind === 'in' || pu.kind === 'break_end') {
        openAt = pu.punched_at;
      } else if (openAt) {
        const ms = Date.parse(pu.punched_at) - Date.parse(openAt);
        const day = localDay(openAt, tz);
        if (ms > 0 && ms <= MAX_SESSION_MS && day >= first && day <= last) workedMs += ms;
        openAt = null;
      }
    }

    const approved = (leavesBy.get(p.id) ?? []).filter(l => l.status === 'approved');
    const onLeave = (day: string) => approved.some(l => l.start_date <= day && l.end_date >= day);

    let late = 0, absent = 0, planned = 0;
    const shiftDays = new Map<string, number>();
    for (const s of shiftsBy.get(p.id) ?? []) {
      if (s.shift_date < first || s.shift_date > last) continue;
      const start = timeToMinutes(s.start_time);
      const prev = shiftDays.get(s.shift_date);
      if (prev === undefined || start < prev) shiftDays.set(s.shift_date, start);
    }
    for (const [day, start] of shiftDays) {
      planned++;
      const inAt = firstIn.get(day);
      if (inAt !== undefined) {
        if (inAt > start + LATE_GRACE_MIN) late++;
      } else if (day <= today && !onLeave(day)) {
        absent++;
      }
    }

    const leaveIn = (reason: string, from: string, to: string) =>
      approved.filter(l => l.reason === reason).reduce((n, l) => n + overlapDays(l.start_date, l.end_date, from, to), 0);

    return {
      id: p.id,
      name: p.full_name || 'Unnamed',
      role: p.role,
      department: p.department,
      present: firstIn.size,
      hours: round1(workedMs / 3600e3),
      late,
      absent,
      planned,
      vacation: leaveIn('vacation', first, last),
      sick: leaveIn('sick', first, last),
      personal: leaveIn('personal', first, last),
      vacationYear: leaveIn('vacation', yearFirst, last),
      pending: (leavesBy.get(p.id) ?? []).filter(l => l.status === 'pending').length,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return { month, people, headcount: buildHeadcount(input.people, month) };
}

export function buildHeadcount(people: ReportPerson[], month: string): HeadcountReport {
  const active = people.filter(p => p.is_active);
  const { first, last } = monthBounds(month);
  const joinDay = (p: ReportPerson) => (p.created_at ? localDay(p.created_at, tzFor(p.office)) : null);

  const tally = (key: (p: ReportPerson) => string) => {
    const m = new Map<string, number>();
    for (const p of active) m.set(key(p), (m.get(key(p)) ?? 0) + 1);
    // Unset (empty key) goes last.
    return [...m].map(([k, count]) => ({ key: k, count }))
      .sort((a, b) => Number(!a.key) - Number(!b.key) || b.count - a.count || a.key.localeCompare(b.key));
  };

  const trend: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const mo = shiftMonth(month, -i);
    const end = monthBounds(mo).last;
    trend.push({ month: mo, count: active.filter(p => { const d = joinDay(p); return !d || d <= end; }).length });
  }

  return {
    active: active.length,
    inactive: people.length - active.length,
    joinedThisMonth: active.filter(p => { const d = joinDay(p); return !!d && d >= first && d <= last; }).length,
    byDepartment: tally(p => p.department ?? ''),
    byRole: tally(p => p.role ?? ''),
    trend,
  };
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r); else m.set(k, [r]);
  }
  return m;
}

/** CSV of the per-person table (Excel-friendly: BOM + quoted cells). */
export function reportCsv(report: HrReport, label: (p: PersonReport) => { role: string; department: string }): string {
  const head = ['Name', 'Department', 'Role', 'Days present', 'Hours worked', 'Planned days', 'Late', 'Absent', 'Vacation', 'Sick', 'Personal', `Vacation ${report.month.slice(0, 4)}`, 'Pending requests'];
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = report.people.map(p => {
    const l = label(p);
    return [p.name, l.department, l.role, p.present, p.hours, p.planned, p.late, p.absent, p.vacation, p.sick, p.personal, p.vacationYear, p.pending].map(q).join(',');
  });
  return '﻿' + [head.map(q).join(','), ...rows].join('\r\n');
}
