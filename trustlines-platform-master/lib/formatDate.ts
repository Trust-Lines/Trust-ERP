
const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(value: string | Date | null | undefined, fallback = '—'): string {
  if (!value) return fallback;

  if (typeof value === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) {
      const [, y, m, d] = dateOnly;
      return `${d}/${m}/${y}`;
    }
  }

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;

  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function formatDateTime(value: string | Date | null | undefined, fallback = '—'): string {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return `${formatDate(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
