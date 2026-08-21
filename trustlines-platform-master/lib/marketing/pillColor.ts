
export const PILL_PALETTE = ['#7C3AED', '#DB2777', '#EA580C', '#0891B2', '#16A34A', '#4F46E5', '#CA8A04', '#0D9488', '#DC2626', '#9333EA'];

export function hashColor(s: string, palette: string[] = PILL_PALETTE): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function readableTextColor(bgHex: string): string {
  const hex = bgHex.replace('#', '');
  if (hex.length !== 6) return '#fff';
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1a1a1a' : '#fff';
}
