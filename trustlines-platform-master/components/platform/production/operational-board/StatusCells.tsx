'use client';

import { useEffect, useMemo } from 'react';
import { CheckCheck, CircleCheck, CircleOff, Drill, Hourglass, Loader, Package, Pause, Send, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent } from '@/components/ui/popover';
import type { PItem } from '@/lib/production/boardModel';
import {
  PF_SIGN_OPTIONS, PO_SIGN_OPTIONS, STATUS_OPTIONS, currentFirst, type StatusIconName, type StatusOption,
} from '@/lib/production/statuses';

// ── Status cells (Trust System): PO SIGN STATUS (one per type group), PF SIGN STATUS and STATUS
// are filled with the status colour across the whole cell; clicking opens the list of statuses
// with their colours (current one first). Saves go to PATCH /api/production/items/:id, which sets
// the dates for a status change; a PO change is written to every row of the type, one by one.
export type EditKind = 'status' | 'pf' | 'po';
export const FIELD: Record<EditKind, string> = { status: 'status', pf: 'pf_sign_status', po: 'po_sign_status' };
export const ITEM_KEY: Record<EditKind, keyof PItem> = { status: 'status', pf: 'pfSignStatus', po: 'poSignStatus' };
const OPTIONS: Record<EditKind, StatusOption[]> = { status: STATUS_OPTIONS, pf: PF_SIGN_OPTIONS, po: PO_SIGN_OPTIONS };
const MENU_W = 240;
const MENU_MAX_H = 360;
export interface OpenMenu { kind: EditKind; ids: string[]; current: string; rect: DOMRect }

// Figma "Status Chip" (TRUST-LINES ERP 722:804 light / 722:910 dark): 14px icon + 12px medium label,
// 4px radius, 3px × 8/12px padding, coloured by the status tone (globals.css tokens, theme-aware).
const ICONS: Record<Exclude<StatusIconName, 'circle-dashed-check'>, LucideIcon> = {
  pause: Pause, 'circle-off': CircleOff, package: Package, loader: Loader, hourglass: Hourglass, drill: Drill,
  'check-check': CheckCheck, 'circle-check': CircleCheck, send: Send,
};
function StatusIcon({ name }: { name: StatusIconName }) {
  // circle-dashed-check isn't in this lucide-react version: the Figma asset, painted in the text colour.
  if (name === 'circle-dashed-check') {
    return (
      <span aria-hidden className="size-[14px] shrink-0 bg-current"
        style={{ maskImage: 'url(/icons/circle-dashed-check.svg)', WebkitMaskImage: 'url(/icons/circle-dashed-check.svg)', maskSize: '100% 100%', WebkitMaskSize: '100% 100%' }} />
    );
  }
  const Icon = ICONS[name];
  return <Icon aria-hidden className="size-[14px] shrink-0" strokeWidth={2} />;
}
export function StatusChip({ opt, className }: { opt: StatusOption; className?: string }) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1 rounded-[4px] py-[3px] pl-2 pr-3 text-[12px] font-medium leading-4 whitespace-nowrap', className)}
      style={{ background: opt.bg, color: opt.fg }}>
      <StatusIcon name={opt.icon} />
      <span className="truncate">{opt.label}</span>
    </span>
  );
}

// In the table the chip is a full box: it fills the cell (a merged PO cell from the type's first row
// to its last) with a margin on every side, icon and label centred.
export function StatusCell({ opt, rowSpan, editable, onOpen }: {
  opt: StatusOption; rowSpan?: number; editable: boolean; onOpen: (anchor: HTMLElement) => void;
}) {
  return (
    <td
      rowSpan={rowSpan}
      className={cn('group/status relative overflow-hidden whitespace-nowrap border-b border-r border-ui-divider bg-ui-page-bg p-0 align-middle',
        editable && 'cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ui-focus-ring')}
      tabIndex={editable ? 0 : undefined}
      aria-haspopup={editable ? 'listbox' : undefined}
      onClick={editable ? e => onOpen(e.currentTarget) : undefined}
      onKeyDown={editable ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(e.currentTarget); } } : undefined}
    >
      <StatusChip opt={opt} className={cn('absolute inset-[5px] max-w-none justify-center rounded-[6px] px-2', editable && 'group-hover/status:brightness-95')} />
    </td>
  );
}

export function StatusMenu({ menu, onPick, onClose }: { menu: OpenMenu; onPick: (value: string) => void; onClose: () => void }) {
  useEffect(() => {
    // Scrolling the page or the board closes the list; scrolling the list itself does not.
    // (Escape and outside clicks are handled by the shared Popover.)
    const onScroll = (e: Event) => { if (!(e.target instanceof Element && e.target.closest('[data-board-popup]'))) onClose(); };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);
  const anchor = useMemo(() => ({ getBoundingClientRect: () => menu.rect }), [menu.rect]);
  return (
    <Popover open onOpenChange={o => { if (!o) onClose(); }}>
      <PopoverContent data-board-popup backdrop role="listbox" aria-label="Choose a status" anchor={anchor} align="start" sideOffset={2}
        style={{ width: MENU_W, maxHeight: MENU_MAX_H }}
        className="gap-1 overflow-y-auto p-1.5">
        {currentFirst(OPTIONS[menu.kind], menu.current).map(o => (
          <button
            key={o.value} type="button" role="option" aria-selected={o.value === menu.current} autoFocus={o.value === menu.current}
            onClick={() => onPick(o.value)}
            className={cn('flex cursor-pointer flex-col items-start gap-0.5 rounded-[4px] border-0 bg-transparent px-1.5 py-1 text-left hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-ui-focus-ring',
              o.value === menu.current && 'bg-ui-selected-bg')}
          >
            <StatusChip opt={o} />
            {o.hint && <span className="pl-1 text-[11px] text-ui-text-secondary">{o.hint}</span>}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
