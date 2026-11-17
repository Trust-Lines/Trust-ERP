// Shared IT equipment types and styles (Figma "Items Library" 843:41158, item detail 880:14431).

export type ItItemCategory = 'full_set' | 'pc' | 'monitor' | 'tv' | 'keyboard_set' | 'phone' | 'laptop' | 'printer';
export type ItItemStatus = 'available' | 'repair' | 'assigned';

export interface ItItem {
  id: string;
  name: string;
  /** Short spec line shown before the date ("High Performance"). */
  model: string | null;
  category: ItItemCategory;
  /** ISO date the item was added ("7/9/2026"). */
  addedAt: string;
  /** Set the item belongs to ("PC 1"), if any. */
  setLabel: string | null;
  location: string | null;
  status: ItItemStatus;
  /** Person holding the item when `status` is `assigned`. */
  assigneeName: string | null;
  imageUrl: string | null;
}

/** Singular label, as shown in the detail's Category field ("PC"). */
export const CATEGORY_LABEL: Record<ItItemCategory, string> = {
  full_set: 'Full Set',
  pc: 'PC',
  monitor: 'Monitor',
  tv: 'TV',
  keyboard_set: 'Keyboard Set',
  phone: 'Phone',
  laptop: 'Laptop',
  printer: 'Printer',
};

/** Short chip label on small cards (Figma "MK" for a mouse + keyboard set). */
export const CATEGORY_CHIP: Record<ItItemCategory, string> = { ...CATEGORY_LABEL, keyboard_set: 'MK', full_set: 'Set' };

// Light / dark: strong text secondary-700 / secondary-50, muted primary-400 / primary-200, and the
// navy "primary-button" chips flip to near-white with dark text.
export const STRONG = 'text-secondary-700 dark:text-secondary-50';
export const MUTED = 'text-primary-400 dark:text-primary-200';
export const SOLID_CHIP = 'bg-secondary-700 text-white dark:bg-secondary-50 dark:text-primary-950';
export const OUTLINE_CHIP = 'border border-solid border-secondary-700 text-secondary-700 dark:border-secondary-50 dark:text-secondary-50';

/** "7/9/2026" (Figma card date). */
export function formatItemDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US');
}
