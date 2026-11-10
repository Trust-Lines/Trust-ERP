// How a file can be shown in the browser, by extension — shared by the Files tab viewer and the
// streaming route that serves it inline.

export type ViewKind = 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'office' | 'none';

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/mp4',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg',
  txt: 'text/plain; charset=utf-8', csv: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8', json: 'text/plain; charset=utf-8', log: 'text/plain; charset=utf-8', xml: 'text/plain; charset=utf-8',
};
const OFFICE = new Set(['doc', 'docx', 'xls', 'xlsx', 'xlsm', 'ppt', 'pptx']);

export const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

export function viewKind(name: string): ViewKind {
  const ext = extOf(name);
  if (OFFICE.has(ext)) return 'office';
  const mime = MIME[ext];
  if (!mime) return 'none';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'text';
}

/** The inline Content-Type for a viewable file, or null when the browser can't show it. */
export function inlineMime(name: string): string | null {
  return MIME[extOf(name)] ?? null;
}
