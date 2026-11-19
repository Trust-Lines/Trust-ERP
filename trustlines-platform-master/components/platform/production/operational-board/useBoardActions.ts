'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { PItem, PProject, PSection } from '@/lib/production/boardModel';
import { FIELD, ITEM_KEY, type EditKind, type OpenMenu } from './StatusCells';

export interface TypeGroupRef { type: string; projectId: string | null; caseId: string | null; customTypeCode: string | null }

/**
 * The board's writes: row edits, status changes, adding / deleting rows and deleting a project.
 * Picked values show at once (`view`) until the reloaded board (`onSaved`) has them.
 */
export function useBoardActions({ sections, canStatus, onSaved }: {
  sections: PSection[]; canStatus: boolean; onSaved?: () => void;
}) {
  // Picked values show at once, until the reloaded board has them.
  const [pending, setPending] = useState<Record<string, Partial<PItem>>>({});
  useEffect(() => { setPending({}); }, [sections]);
  const view = (it: PItem): PItem => (it.id && pending[it.id] ? { ...it, ...pending[it.id] } : it);

  /** PATCH one row; the reloaded board shows what the server saved (PF code included). */
  async function patchItem(id: string, body: Record<string, unknown>, show?: Partial<PItem>) {
    if (show) setPending(p => ({ ...p, [id]: { ...p[id], ...show } }));
    const res = await fetch(`/api/production/items/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    const b = await res?.json().catch(() => ({}));
    onSaved?.();
    if (!res?.ok) { const msg = b?.error ?? 'Could not save'; toast.error(msg); throw new Error(msg); }
  }
  const pickVendor = (item: PItem, v: { id: string; code: string | null; name: string } | null) =>
    patchItem(item.id!, { vendor_id: v?.id ?? null }, { vendorId: v?.id ?? null, vendor: v ? { code: v.code, name: v.name } : null }).catch(() => {});
  const pickOrderType = (item: PItem, name: string | null) =>
    patchItem(item.id!, { order_type: name }, { orderType: name }).catch(() => {});

  async function addItem(g: TypeGroupRef): Promise<string | null> {
    const res = await fetch('/api/production/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: g.caseId ? undefined : g.projectId, caseId: g.caseId ?? undefined, type: g.type, customTypeCode: g.customTypeCode ?? undefined }),
    }).catch(() => null);
    const b = await res?.json().catch(() => ({}));
    if (!res?.ok) { toast.error(b?.error ?? 'Could not add the item'); return null; }
    onSaved?.();
    return b.item?.id ?? null;
  }
  async function deleteItem(item: PItem) {
    const res = await fetch(`/api/production/items/${item.id}`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) { toast.error('Could not delete the row'); throw new Error('delete'); }
    toast.success('Row moved to the trash');
    onSaved?.();
  }
  async function deleteProject(p: PProject) {
    const res = await fetch(`/api/production/blocks/${p.id}?kind=${p.kind ?? 'project'}`, { method: 'DELETE' }).catch(() => null);
    const b = await res?.json().catch(() => ({}));
    if (!res?.ok) { toast.error(b?.error ?? 'Could not delete the project'); throw new Error('delete'); }
    toast.success('Project moved to the trash');
    onSaved?.();
  }

  // ── Status list (STATUS / PF SIGN / PO SIGN cells).
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  function openMenu(kind: EditKind, ids: string[], current: string, anchor: HTMLElement) {
    if (!canStatus || !ids.length) return;
    setMenu({ kind, ids, current, rect: anchor.getBoundingClientRect() });
  }
  async function pickStatus(value: string) {
    if (!menu) return;
    const { kind, ids, current } = menu;
    setMenu(null);
    if (value === current) return;
    setPending(p => ({ ...p, ...Object.fromEntries(ids.map(id => [id, { ...p[id], [ITEM_KEY[kind]]: value }])) }));
    let failed = 0;
    // One row after another, never in parallel (PF codes are numbered as rows change).
    for (const id of ids) {
      const res = await fetch(`/api/production/items/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [FIELD[kind]]: value }),
      }).catch(() => null);
      if (!res?.ok) failed++;
    }
    if (failed) toast.error(failed === ids.length ? 'Could not save the status' : `${failed} of ${ids.length} rows could not be saved`);
    onSaved?.();
  }

  return {
    pending, view, patchItem, pickVendor, pickOrderType, addItem, deleteItem, deleteProject,
    menu, openMenu, closeMenu: () => setMenu(null), pickStatus,
  };
}
