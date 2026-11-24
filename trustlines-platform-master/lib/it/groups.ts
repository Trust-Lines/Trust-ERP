// IT item sets ("PC 1"): items with the same set_label are grouped. Shared by the group API and UI.

export const MAX_GROUP_ITEMS = 50;
export const MAX_SET_LABEL = 40;

type Clean = { value: string | null; error?: undefined } | { value?: undefined; error: string };

/** Absent / empty → null (keep the current name); otherwise trimmed, single-spaced, at most 40 chars. */
export function cleanSetLabel(v: unknown): Clean {
  if (v === undefined || v === null) return { value: null };
  if (typeof v !== 'string') return { error: 'Set name must be text' };
  const s = v.replace(/\s+/g, ' ').trim();
  if (!s) return { value: null };
  if (s.length > MAX_SET_LABEL) return { error: `Set name is at most ${MAX_SET_LABEL} characters` };
  return { value: s };
}

/** Next free "Set N" name among the labels in use. */
export function nextSetName(labels: (string | null)[]): string {
  const used = new Set(labels.filter((l): l is string => !!l).map(l => l.toLowerCase()));
  let n = 1;
  while (used.has(`set ${n}`)) n++;
  return `Set ${n}`;
}

/** The "scan to group" started on one item, kept in this browser until finished. */
export interface PendingGroup { anchorId: string; anchorName: string; setLabel: string; startedAt: number }
export const PENDING_GROUP_KEY = 'it.pendingGroup.v1';
export const PENDING_GROUP_MAX_AGE = 2 * 60 * 60 * 1000;

export function parsePendingGroup(raw: string | null, now = Date.now()): PendingGroup | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<PendingGroup>;
    if (typeof p.anchorId !== 'string' || typeof p.anchorName !== 'string' || typeof p.setLabel !== 'string' || typeof p.startedAt !== 'number') return null;
    if (now - p.startedAt > PENDING_GROUP_MAX_AGE) return null;
    return p as PendingGroup;
  } catch { return null; }
}
