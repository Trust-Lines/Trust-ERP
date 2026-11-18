import { formatDate } from '@/lib/formatDate';

// Small display formatters shared by platform screens. Each one replaces copies that were
// pasted into several components with identical output, so behaviour is unchanged.

/** Up to two initials from the first two words of a name ("Ada Lovelace King" → "AL"). */
export function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

/** Initials from the name, or the first two letters of the email when the name is blank. */
export function initialsOrEmail(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length) return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

/** "just now" / "5m ago" / "3h ago", then the plain date once a day has passed. */
export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '';
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return formatDate(iso);
}

/** Dropbox-style size: "512 B", "1.5 KB", "2.3 MB"; blank when unknown. */
export function formatFileSize(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A `YYYY-MM-DD…` value as `MM/DD/YYYY`; `null` when empty, the raw value when it isn't a date. */
export function isoDateToUS(d: string | null | undefined): string | null {
  if (!d) return null;
  const [y, m, day] = d.slice(0, 10).split('-');
  return y && m && day ? `${m}/${day}/${y}` : d;
}
