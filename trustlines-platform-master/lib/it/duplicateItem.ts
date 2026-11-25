import type { ItemRow } from './server';

/** Most copies one Duplicate makes. */
export const MAX_DUPLICATES = 20;

/**
 * The it_items rows for `count` copies of an item: everything that describes the thing itself
 * (name, type, category, office, notes, specs, photo) is kept; everything that belongs to one unit
 * (holder, set, remote address) is cleared, so each copy starts available.
 */
export function duplicateRows(source: ItemRow, count: number, actorId: string, now: string) {
  return Array.from({ length: count }, () => ({
    name: source.name,
    model: source.model,
    category: source.category,
    location: source.location,
    status: 'available' as const,
    assignee_id: null,
    assigned_at: null,
    set_label: null,
    notes: source.notes,
    specs: source.specs ?? {},
    remote_address: null,
    image_path: source.image_path,
    image_updated_at: source.image_path ? now : null,
    created_by: actorId,
  }));
}
