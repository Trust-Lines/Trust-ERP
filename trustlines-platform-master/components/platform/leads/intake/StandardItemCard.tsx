'use client';

import { CircleDollarSign, Minus, Package, Palette, Plus, SwatchBook } from 'lucide-react';

/** A standard (STD) item offered for a trade. Will come from the backend standards catalog. */
export interface StandardItem {
  id: string;
  name: string;
  color: string | null;
  style: string | null;
  price: number | null;
  image_url: string | null;
}

// Figma "New lead · Scope of work" card (node 919:28310): photo tile, name, color / style / price rows,
// and a +/qty/− stepper. A card with quantity > 0 turns green (status t9).
export function StandardItemCard({ item, qty, onChange }: {
  item: StandardItem;
  qty: number;
  onChange: (qty: number) => void;
}) {
  const on = qty > 0;
  const fg = on ? 'text-[var(--status-t9-fg)]' : 'text-[var(--color-secondary-700)] dark:text-ui-heading';
  const stepBtn = 'flex flex-1 items-center justify-center rounded-[4px] px-3 py-1 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-secondary-700)] disabled:cursor-not-allowed';
  const meta = [
    { Icon: Palette, text: item.color },
    { Icon: SwatchBook, text: item.style },
    { Icon: CircleDollarSign, text: item.price != null ? `$ ${item.price.toLocaleString()}` : null },
  ].filter(m => m.text);

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-4 overflow-hidden rounded-[8px] border border-ui-divider py-2 pl-2 pr-3 ${
        on ? 'bg-[var(--status-t9-bg)]' : 'bg-ui-input-bg'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex size-[81px] shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-white p-1">
          {item.image_url
            // eslint-disable-next-line @next/next/no-img-element -- catalog photos come from arbitrary hosts
            ? <img src={item.image_url} alt={item.name} className="size-full object-contain" />
            : <Package size={32} className="text-ui-body" aria-hidden />}
        </div>
        <div className={`flex min-w-0 flex-1 flex-col gap-2 ${fg}`}>
          <p className="m-0 truncate text-[16px] font-semibold leading-4">{item.name}</p>
          <div className="flex flex-col gap-1">
            {meta.map(({ Icon, text }, i) => (
              <span key={i} className="inline-flex items-start gap-1 text-[12px] font-medium leading-4 tracking-[0.36px] opacity-80">
                <Icon size={16} strokeWidth={1.5} aria-hidden className="shrink-0" />
                <span className="truncate">{text}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex w-[53px] shrink-0 flex-col gap-1 self-stretch">
        <button
          type="button"
          aria-label={`Add one ${item.name}`}
          onClick={() => onChange(qty + 1)}
          className={`${stepBtn} text-white ${on ? 'bg-[var(--status-t9-fg)]' : 'bg-[var(--color-secondary-700)] dark:bg-primary-50 dark:text-primary-950'}`}
        >
          <Plus size={12} aria-hidden />
        </button>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          aria-label={`${item.name} quantity`}
          value={qty}
          onChange={e => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className={`h-[25px] w-full rounded-[4px] bg-ui-input-bg px-1 text-center text-[14px] font-semibold leading-[1.5] tracking-[-0.308px] [appearance:textfield] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-secondary-700)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
            on ? 'border-0' : 'border border-[var(--ui-input-border)]'
          } ${fg}`}
        />
        <button
          type="button"
          aria-label={`Remove one ${item.name}`}
          disabled={!on}
          onClick={() => onChange(qty - 1)}
          className={`${stepBtn} ${on ? 'bg-[var(--status-t9-fg)] text-white' : 'bg-[var(--status-t0-bg)] text-[var(--status-t0-fg)]'}`}
        >
          <Minus size={12} aria-hidden />
        </button>
      </div>
    </div>
  );
}
