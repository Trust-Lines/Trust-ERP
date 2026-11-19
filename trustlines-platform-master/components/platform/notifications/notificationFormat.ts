import type React from 'react';
import {
  CalendarClock, CircleCheck, ClipboardCheck, Clock, Handshake, MessagesSquare, Truck,
} from 'lucide-react';

// Figma "Notifications" (node 168:25189).
export const HEADING_TEXT = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
export const CONTROL_STYLE: React.CSSProperties = {
  height: 40, fontSize: 12, borderRadius: 6, borderColor: 'var(--ui-input-border)', background: 'var(--ui-input-bg)',
};
export const RANGES = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
];
export const DAY_MS = 86_400_000;

const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' });
const DAY_LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const DAY_SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const DATE_SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "lead.followup" → "Lead followup" */
export function typeLabel(type: string): string {
  const s = type.replace(/[._]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function iconFor(type: string) {
  const t = type.toLowerCase();
  if (/(approval|review)/.test(t)) return Clock;
  if (/(followup|reminder)/.test(t)) return CalendarClock;
  if (/(lead|opportunit|deal)/.test(t)) return Handshake;
  if (/(deliver|shipment|logistic|dispatch)/.test(t)) return Truck;
  if (/(mention|comment|message|discussion)/.test(t)) return MessagesSquare;
  if (/(complete|approved|done)/.test(t)) return CircleCheck;
  return ClipboardCheck;
}

export function actionLabel(link: string): string {
  if (link.startsWith('/projects')) return 'Open project';
  if (link.startsWith('/marketing/opportunities')) return 'Open opportunity';
  if (link.startsWith('/marketing/prospects')) return 'Open contact';
  if (link.startsWith('/sales')) return 'Open lead';
  if (link.startsWith('/approvals')) return 'Review';
  return 'Open';
}

export function relativeTime(iso: string, now: number): { primary: string; secondary: string } {
  const at = new Date(iso);
  const diffMin = Math.max(0, Math.floor((now - at.getTime()) / 60_000));
  const time = TIME.format(at);
  const today = startOfDay(new Date(now));
  if (at.getTime() >= today) {
    if (diffMin < 1) return { primary: 'Just now', secondary: time };
    if (diffMin < 60) return { primary: `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`, secondary: time };
    const h = Math.floor(diffMin / 60);
    return { primary: `${h} hour${h === 1 ? '' : 's'} ago`, secondary: time };
  }
  if (at.getTime() >= today - DAY_MS) return { primary: 'Yesterday', secondary: `${DAY_SHORT.format(at)} · ${time}` };
  return { primary: DATE_SHORT.format(at), secondary: time };
}

export function groupLabel(dayStart: number, now: number): string {
  const today = startOfDay(new Date(now));
  const long = DAY_LONG.format(new Date(dayStart));
  if (dayStart === today) return `Today · ${long}`;
  if (dayStart === today - DAY_MS) return `Yesterday · ${long}`;
  return long;
}
