import { BRANCHES, CONFIDENCES, EDITABLE_FIELDS, STATUSES, type EditableField } from './compute';

const TEXT_MAX: Partial<Record<EditableField, number>> = {
  project_no: 40, project_name: 120, city_state: 60, team: 200, scope: 60, pm_name: 60, blockers: 1000, notes: 2000,
};
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** One register cell from the browser → the value to store, or an error. Blank = null. */
export function cleanField(field: string, raw: unknown): { ok: true; field: EditableField; value: string | number | null } | { ok: false; error: string } {
  if (!(EDITABLE_FIELDS as readonly string[]).includes(field)) return { ok: false, error: 'Unknown column' };
  const f = field as EditableField;
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) return { ok: true, field: f, value: null };

  if (f === 'team_id') {
    const s = String(raw).trim();
    return /^[0-9a-f-]{36}$/i.test(s) ? { ok: true, field: f, value: s } : { ok: false, error: 'Unknown team' };
  }
  if (f === 'team_size') {
    const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (!Number.isInteger(n) || n < 0 || n > 500) return { ok: false, error: 'Team members must be a whole number' };
    return { ok: true, field: f, value: n };
  }
  const s = String(raw).trim();
  if (f === 'planned_start' || f === 'planned_finish') {
    if (!isoDate.test(s) || Number.isNaN(Date.parse(s))) return { ok: false, error: 'Not a date' };
    return { ok: true, field: f, value: s };
  }
  if (f === 'branch') return (BRANCHES as readonly string[]).includes(s.toUpperCase()) ? { ok: true, field: f, value: s.toUpperCase() } : { ok: false, error: 'Branch must be NE, SE, NW or CVW' };
  if (f === 'status') return (STATUSES as readonly string[]).includes(s) ? { ok: true, field: f, value: s } : { ok: false, error: 'Unknown status' };
  if (f === 'confidence') return (CONFIDENCES as readonly string[]).includes(s) ? { ok: true, field: f, value: s } : { ok: false, error: 'Unknown confidence' };
  return { ok: true, field: f, value: s.slice(0, TEXT_MAX[f] ?? 200) };
}

/** A whole set of cells (PATCH body / new row). */
export function cleanPatch(body: Record<string, unknown>) {
  const patch: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(body)) {
    const c = cleanField(k, v);
    if (!c.ok) return { error: `${k}: ${c.error}` } as const;
    patch[c.field] = c.value;
  }
  return { patch } as const;
}
