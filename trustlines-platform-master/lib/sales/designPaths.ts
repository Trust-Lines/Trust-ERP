// Pure path rules for a design job's Dropbox folder (no Dropbox / DB — unit tested).

/** Where versions live inside a design folder — what syncDesignVersionsFromDropbox scans. */
export const DESIGN_VERSION_BASE = '3-Design proposal/Design Proposal';
/** Sub-folders of every V{n} version folder (same names as the project's design proposal). */
export const DESIGN_VERSION_SUBFOLDERS = ['1-PDF', '2-Randers', '3-CAD', '4-SKP', '5-LUMION'];

/** Shortcuts the Files tab offers — "put it in the right place" without browsing. */
export const DESIGN_QUICK_FOLDERS: { label: string; path: string }[] = [
  { label: 'Plan layout', path: '1-Plan Layout' },
  { label: 'Estimate', path: '2-Estimate' },
  { label: 'Design proposal', path: DESIGN_VERSION_BASE },
  { label: 'Dimension plan', path: '4-Dimension Plan' },
  { label: 'Images & videos', path: '6-Images & Videos' },
  { label: 'Branding', path: '7-Branding Requirements' },
  { label: 'Equipment', path: '8-Equipment' },
];

const UNSAFE = /[\\/:*?"<>|]+/g;
// Control characters (U+0000–U+001F) by code point — a regex range trips no-control-regex.
const stripControl = (s: string) => [...s].map(c => (c.charCodeAt(0) < 32 ? ' ' : c)).join('');
const hasControl = (s: string) => [...s].some(c => c.charCodeAt(0) < 32);

/** A Dropbox-safe single folder/file name segment. */
export function safeSegment(name: string, fallback = 'Untitled'): string {
  const s = stripControl(name).replace(UNSAFE, ' ').replace(/\s+/g, ' ').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 80).trim();
  return s || fallback;
}

/** Folder for a job whose deal has no Project yet. The id prefix keeps it unique and stable. */
export function preProjectDesignRoot(jobId: string, title: string): string {
  const name = safeSegment(title.replace(/^Sales Design\s+[—-]\s+/i, ''), 'Design job');
  return `/Design/Pre-Project/${jobId.slice(0, 8)} - ${name}`;
}

/**
 * Resolve a path relative to the job's folder. Returns the absolute Dropbox path, or null when the
 * input would leave the folder ("..", absolute paths, odd characters) — every file route uses this
 * so a request can never read or write outside the job's own folder.
 */
export function resolveInside(root: string, rel: string | null | undefined): string | null {
  const parts = String(rel ?? '').split('/').map(p => p.trim()).filter(Boolean);
  for (const p of parts) {
    if (p === '.' || p === '..' || /[\\:*?"<>|]/.test(p) || hasControl(p)) return null;
  }
  return parts.length ? `${root}/${parts.join('/')}` : root;
}

/** Inverse of resolveInside, for paths Dropbox returns (case-insensitive prefix). */
export function relativeTo(root: string, abs: string): string | null {
  const r = root.toLowerCase(), a = abs.toLowerCase();
  if (a === r) return '';
  if (!a.startsWith(`${r}/`)) return null;
  return abs.slice(root.length + 1);
}

/** Next V-number given the folder names already under DESIGN_VERSION_BASE. */
export function nextVersionNo(folderNames: string[]): number {
  let max = 0;
  for (const n of folderNames) {
    const m = n.match(/^V(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}
