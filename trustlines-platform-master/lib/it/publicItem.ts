// The public page an IT item's QR label opens for someone without an account (/item/<id>): the item's
// details and a short form to fill them in — name, type, office, notes, specs (computers), photo and
// a phone's number. The item id (an unguessable UUID printed on the label) is the only key, so the
// page shows nothing more than the label holder needs: no ids of people, no remote address, no
// secrets, no holder change. Every save is rate-limited per IP and audit-logged (actor null + IP hash).
import { COMPUTER_CATEGORIES, IT_LOCATIONS, SPEC_KEYS, SPEC_LABEL, type ItemCategory, type ItemStatus } from './constants';
import type { ItContext } from './server';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface PublicItem {
  id: string;
  name: string;
  model: string | null;
  category: ItemCategory;
  location: string | null;
  status: ItemStatus;
  /** Who holds it (name only), when assigned. */
  holderName: string | null;
  setLabel: string | null;
  notes: string | null;
  specs: Record<string, string>;
  imageUrl: string | null;
  createdAt: string;
  /** A phone's line number (migration 163), if linked. */
  phoneNumber: string | null;
}

const COLS = 'id, name, model, category, location, status, assignee_id, set_label, notes, specs, image_path, image_updated_at, created_at, updated_at';

export const publicImageUrl = (r: { id: string; image_path: string | null; image_updated_at: string | null; updated_at: string }) =>
  r.image_path ? `/api/public/it-items/${r.id}/image?v=${Date.parse(r.image_updated_at ?? r.updated_at) || 0}` : null;

export async function loadPublicItem(admin: any, id: string): Promise<PublicItem | null> {
  const { data } = await admin.from('it_items').select(COLS).eq('id', id).is('deleted_at', null).maybeSingle();
  if (!data) return null;
  const r = data as {
    id: string; name: string; model: string | null; category: ItemCategory; location: string | null; status: ItemStatus;
    assignee_id: string | null; set_label: string | null; notes: string | null; specs: Record<string, string> | null;
    image_path: string | null; image_updated_at: string | null; created_at: string; updated_at: string;
  };
  const [holder, line] = await Promise.all([
    r.status === 'assigned' && r.assignee_id
      ? admin.from('profiles').select('full_name').eq('id', r.assignee_id).maybeSingle()
      : Promise.resolve({ data: null }),
    r.category === 'phone'
      ? admin.from('it_phone_lines').select('number').eq('item_id', r.id).is('deleted_at', null).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    id: r.id, name: r.name, model: r.model, category: r.category, location: r.location, status: r.status,
    holderName: (holder.data as { full_name: string | null } | null)?.full_name ?? (r.status === 'assigned' ? 'Assigned' : null),
    setLabel: r.set_label, notes: r.notes, specs: r.specs ?? {}, imageUrl: publicImageUrl(r), createdAt: r.created_at,
    phoneNumber: (line.data as { number: string } | null)?.number ?? null,
  };
}

const text = (v: unknown, max: number, label: string): { value: string | null } | { error: string } => {
  if (v == null) return { value: null };
  if (typeof v !== 'string') return { error: `${label} must be text` };
  const t = v.trim();
  if (t.length > max) return { error: `${label} is too long (max ${max} characters)` };
  return { value: t || null };
};

/** The fields a label holder may fill in → item columns. Category decides whether specs apply. */
export function cleanPublicItemEdit(body: unknown, category: ItemCategory): { value: Record<string, unknown> } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = text(b.name, 120, 'Name');
  if ('error' in name) return name;
  if (!name.value) return { error: 'Enter the item name' };
  const model = text(b.model, 120, 'Type');
  if ('error' in model) return model;
  const location = text(b.location, 60, 'Location');
  if ('error' in location) return location;
  if (location.value && !(IT_LOCATIONS as readonly string[]).includes(location.value)) return { error: 'Choose an office' };
  const notes = text(b.notes, 2000, 'Notes');
  if ('error' in notes) return notes;
  const out: Record<string, unknown> = { name: name.value, model: model.value, location: location.value, notes: notes.value };
  if (COMPUTER_CATEGORIES.includes(category)) {
    const specs: Record<string, string> = {};
    const raw = (b.specs && typeof b.specs === 'object' ? b.specs : {}) as Record<string, unknown>;
    for (const k of SPEC_KEYS) {
      const v = text(raw[k], 120, SPEC_LABEL[k]);
      if ('error' in v) return v;
      if (v.value) specs[k] = v.value;
    }
    out.specs = specs;
  }
  return { value: out };
}

/** For lib/it/phoneItemLink when the label page saves a phone's number: no signed-in actor. */
export const publicItContext = (admin: any): ItContext => ({
  userId: null as unknown as string, role: null, admin, canRequest: false, canManage: false, canEdit: false,
});
