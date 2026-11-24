// IT assignment history (it_assignments, migration 159): one row per spell an item or phone line
// spends with a person. The routes call recordAssignment after every save; it closes the open
// spell when the holder (or a line's company phone) changed and opens a new one. Failures never
// block the save — before the migration runs, history is simply not kept.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type AssetKind = 'item' | 'phone_line';

interface OpenSpell { id: string; person_id: string | null; device_name: string | null }

export async function recordAssignment(admin: any, p: {
  kind: AssetKind; assetId: string; personId: string | null; deviceName?: string | null; actorId: string;
}): Promise<void> {
  try {
    const device = p.deviceName ?? null;
    const { data } = await admin.from('it_assignments').select('id, person_id, device_name')
      .eq('asset_kind', p.kind).eq('asset_id', p.assetId).is('ended_at', null).limit(5);
    const open = (data ?? []) as OpenSpell[];
    const same = open.length === 1 && open[0].person_id === p.personId && (p.kind !== 'phone_line' || (open[0].device_name ?? null) === device);
    if (same || (!open.length && !p.personId)) return;
    const now = new Date().toISOString();
    if (open.length) await admin.from('it_assignments').update({ ended_at: now }).in('id', open.map(o => o.id));
    if (p.personId) {
      await admin.from('it_assignments').insert({
        asset_kind: p.kind, asset_id: p.assetId, person_id: p.personId,
        device_name: p.kind === 'phone_line' ? device : null, started_at: now, assigned_by: p.actorId,
      });
    }
  } catch { /* history is best-effort */ }
}

/** Close the open spell (item / line deleted or retired). */
export async function endAssignment(admin: any, kind: AssetKind, assetId: string): Promise<void> {
  try {
    await admin.from('it_assignments').update({ ended_at: new Date().toISOString() })
      .eq('asset_kind', kind).eq('asset_id', assetId).is('ended_at', null);
  } catch { /* best-effort */ }
}

export interface AssignmentSpell {
  id: string;
  personId: string | null;
  personName: string;
  deviceName: string | null;
  startedAt: string;
  endedAt: string | null;
}

/** An asset's history, newest first (at most 100). Empty when the table doesn't exist yet. */
export async function loadAssignmentHistory(admin: any, kind: AssetKind, assetId: string): Promise<AssignmentSpell[]> {
  try {
    const { data, error } = await admin.from('it_assignments').select('id, person_id, device_name, started_at, ended_at')
      .eq('asset_kind', kind).eq('asset_id', assetId).order('started_at', { ascending: false }).limit(100);
    if (error) return [];
    const rows = (data ?? []) as { id: string; person_id: string | null; device_name: string | null; started_at: string; ended_at: string | null }[];
    const ids = [...new Set(rows.map(r => r.person_id).filter((v): v is string => !!v))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: ppl } = await admin.from('profiles').select('id, full_name, email').in('id', ids);
      for (const p of (ppl ?? []) as { id: string; full_name: string | null; email: string | null }[]) names.set(p.id, p.full_name || p.email || 'Unknown');
    }
    return rows.map(r => ({
      id: r.id, personId: r.person_id, personName: r.person_id ? names.get(r.person_id) ?? 'Former staff' : 'Former staff',
      deviceName: r.device_name, startedAt: r.started_at, endedAt: r.ended_at,
    }));
  } catch { return []; }
}
