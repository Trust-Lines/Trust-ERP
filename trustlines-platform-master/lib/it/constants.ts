// IT tickets and equipment: the fixed lists the API checks and the screens show (migration 155).
// Client-safe — no server imports.

/** Offices an item (and so the person holding it) can be at. Add one here; no migration needed. */
export const IT_LOCATIONS = ['Istanbul', 'USA', 'Syria'] as const;
export type ItLocation = (typeof IT_LOCATIONS)[number];

export const TICKET_CATEGORIES = ['email', 'password_reset', 'hardware', 'software', 'network', 'printer', 'access', 'other'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  email: 'Email',
  password_reset: 'Password Reset',
  hardware: 'Hardware',
  software: 'Software',
  network: 'Network / Internet',
  printer: 'Printer',
  access: 'Access / Account',
  other: 'Other',
};

/** Chip colour per category (Figma: Mail = green with an envelope, Reset = teal with a reset arrow). */
export function ticketCategoryTone(c: TicketCategory): 'success' | 'teal' | 'neutral' {
  if (c === 'email') return 'success';
  if (c === 'password_reset') return 'teal';
  return 'neutral';
}

export const TICKET_PRIORITIES = ['important', 'medium', 'low'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_STATUSES = ['open', 'solved', 'not_solved'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const ITEM_CATEGORIES = ['full_set', 'pc', 'monitor', 'tv', 'keyboard_set', 'phone', 'laptop', 'printer'] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const ITEM_STATUSES = ['available', 'repair', 'assigned'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** Items that are a computer: they get specs and a remote address for "Access Computer". */
export const COMPUTER_CATEGORIES: readonly ItemCategory[] = ['full_set', 'pc', 'laptop'];

export const SPEC_KEYS = ['cpu', 'gpu', 'ram', 'storage'] as const;
export type SpecKey = (typeof SPEC_KEYS)[number];
export const SPEC_LABEL: Record<SpecKey, string> = { cpu: 'CPU', gpu: 'GPU', ram: 'RAM', storage: 'Storage' };

/** Upload limits: one file per request, under Vercel's 4.5 MB body limit. */
export const IT_FILE_MAX_BYTES = 4_000_000;
export const IT_TICKET_MAX_FILES = 6;
export const IT_IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
