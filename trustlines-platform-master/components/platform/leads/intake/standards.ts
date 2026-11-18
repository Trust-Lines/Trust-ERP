import { Hammer, LampCeiling, Palette, ShelvingUnit, type LucideIcon } from 'lucide-react';
import type { StandardItem } from './StandardItemCard';
import type { Scope } from './types';

/** Trades in Figma order, with their scope-button icons. */
export const TRADES: { key: keyof Scope; label: string; Icon: LucideIcon }[] = [
  { key: 'millwork', label: 'Millwork', Icon: Hammer },
  { key: 'shelving', label: 'Shelving', Icon: ShelvingUnit },
  { key: 'ceiling', label: 'Ceiling', Icon: LampCeiling },
  { key: 'image', label: 'Image', Icon: Palette },
];

// Standard items per trade. Empty until the backend standards catalog exists — no sample data.
// TODO: load from the standards endpoint and persist quantities on the intake once available.
export const STANDARDS: Record<keyof Scope, StandardItem[]> = { millwork: [], shelving: [], ceiling: [], image: [] };

/** Picked quantity per standard item id (kept in the wizard, not saved yet). */
export type Quantities = Record<string, number>;
