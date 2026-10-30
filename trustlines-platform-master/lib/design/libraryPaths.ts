// Dropbox homes of the Design library (browser-safe constants + pure helpers).
import { safeSegment } from '@/lib/sales/designPaths';

export const LIBRARY_ROOT = '/Design/Library';
export const BRAND_KITS_ROOT = '/Design/Brand Kits';
export const MATERIALS_ROOT = '/Design/Materials';

export const ASSET_KINDS = [
  { value: 'template', label: 'Templates', folder: 'Templates' },
  { value: 'cad_block', label: 'CAD blocks', folder: 'CAD Blocks' },
  { value: 'render', label: 'Render setups', folder: 'Renders' },
  { value: 'detail', label: 'Standard details', folder: 'Details' },
  { value: 'other', label: 'Other', folder: 'Other' },
] as const;
export type AssetKind = typeof ASSET_KINDS[number]['value'];

export const MATERIAL_CATEGORIES = [
  'laminate', 'paint', 'wood', 'metal', 'fabric', 'stone', 'glass', 'acrylic', 'lighting', 'other',
] as const;
export type MaterialCategory = typeof MATERIAL_CATEGORIES[number];

export function assetFolder(kind: string): string {
  return `${LIBRARY_ROOT}/${ASSET_KINDS.find(k => k.value === kind)?.folder ?? 'Other'}`;
}

/** A brand kit's own folder; the id prefix keeps two kits with the same name apart. */
export function brandKitFolder(id: string, name: string): string {
  return `${BRAND_KITS_ROOT}/${safeSegment(name, 'Brand')} - ${id.slice(0, 8)}`;
}

/** Tags from a comma/space separated input: lower-case, unique, max 12. */
export function parseTags(input: unknown): string[] {
  const raw = Array.isArray(input) ? input.map(String) : String(input ?? '').split(/[,\n]/);
  return [...new Set(raw.map(t => t.trim().toLowerCase()).filter(Boolean).map(t => t.slice(0, 40)))].slice(0, 12);
}

/** #RGB / #RRGGBB → #RRGGBB upper-case, else null. */
export function normalizeHex(v: unknown): string | null {
  const s = String(v ?? '').trim().replace(/^#?/, '#');
  if (/^#[0-9a-f]{3}$/i.test(s)) return `#${s.slice(1).split('').map(c => c + c).join('')}`.toUpperCase();
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toUpperCase() : null;
}

/** Brand colours from the client: valid hex only, max 24. */
export function cleanColors(v: unknown): { name: string; hex: string }[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap(c => {
    const hex = normalizeHex((c as { hex?: unknown })?.hex);
    return hex ? [{ name: String((c as { name?: unknown })?.name ?? '').trim().slice(0, 40) || hex, hex }] : [];
  }).slice(0, 24);
}
/** Font names from a list or comma/new-line text, max 12. */
export function cleanFonts(v: unknown): string[] {
  const raw = Array.isArray(v) ? v.map(String) : String(v ?? '').split(/[,\n]/);
  return [...new Set(raw.map(f => f.trim()).filter(Boolean).map(f => f.slice(0, 60)))].slice(0, 12);
}

export const MATERIAL_COLS = 'id, category, name, code, supplier_id, supplier_name, finish, color_hex, unit, price, currency, image_path, notes, is_active, created_by, created_at, updated_at';

/**
 * Validates a material from the client. `partial` (PATCH) only checks the fields present.
 * The photo path must sit under `photosRoot` (it was uploaded through our one-shot link).
 */
export function materialFields(b: Record<string, unknown>, photosRoot: string, partial = false):
  { value: Record<string, unknown> } | { error: string } {
  const v: Record<string, unknown> = {};
  const has = (k: string) => !partial || k in b;
  const text = (k: string, max: number) => { const s = String(b[k] ?? '').trim().slice(0, max); return s || null; };
  if (has('name')) { const n = text('name', 160); if (!n) return { error: 'Name the material' }; v.name = n; }
  if (has('category')) v.category = (MATERIAL_CATEGORIES as readonly string[]).includes(String(b.category)) ? b.category : 'other';
  for (const [k, max] of [['code', 80], ['supplier_name', 160], ['finish', 120], ['unit', 30], ['notes', 2000]] as const) if (has(k)) v[k] = text(k, max);
  if (has('supplier_id')) v.supplier_id = typeof b.supplier_id === 'string' && b.supplier_id ? b.supplier_id : null;
  if (has('color_hex')) v.color_hex = b.color_hex ? normalizeHex(b.color_hex) : null;
  if (has('price')) {
    if (b.price === '' || b.price == null) v.price = null;
    else { const n = Number(b.price); if (!Number.isFinite(n) || n < 0) return { error: 'Price must be a positive number' }; v.price = Math.round(n * 100) / 100; }
  }
  if (has('currency')) v.currency = /^[A-Z]{3}$/.test(String(b.currency ?? '')) ? b.currency : 'USD';
  if (has('is_active')) v.is_active = b.is_active !== false;
  if (has('image_path')) {
    const p = String(b.image_path ?? '').trim();
    if (p && (p.includes('..') || !p.toLowerCase().startsWith(`${photosRoot.toLowerCase()}/`))) return { error: 'Invalid photo' };
    v.image_path = p || null;
  }
  return { value: v };
}
