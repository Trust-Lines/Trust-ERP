const TR = 'tr-TR';
export const dayLong = (d: Date) => d.toLocaleDateString(TR, { weekday: 'long', day: 'numeric', month: 'long' });
export const dayShort = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString(TR, { day: 'numeric', month: 'short' }) : '—';
export const clock = (iso: string | Date) => new Date(iso).toLocaleTimeString(TR, { hour: '2-digit', minute: '2-digit' });
export const initials = (name: string | null | undefined) =>
  (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toLocaleUpperCase(TR)).join('') || '?';
export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
}
/** "2g önce" style relative age. */
export function ago(iso: string | null | undefined) {
  if (!iso) return '';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 60) return `${Math.max(1, m)} dk önce`;
  if (m < 1440) return `${Math.round(m / 60)} sa önce`;
  return `${Math.round(m / 1440)}g önce`;
}
