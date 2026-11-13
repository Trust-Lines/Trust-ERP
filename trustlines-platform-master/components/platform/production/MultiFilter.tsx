'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

// Trust System filter dropdown: a button with the selected count, a list with a search box on top,
// checkbox options, "Clear all (n)" at the bottom. Picks inside one filter are OR.

export interface FilterOption { value: string; label: string }

export function MultiFilter({ label, options, selected, onChange, searchPlaceholder }: {
  label: string; options: FilterOption[]; selected: Set<string>; onChange: (next: Set<string>) => void; searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const shown = options.filter(o => o.label.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (v: string) => { const n = new Set(selected); if (n.has(v)) n.delete(v); else n.add(v); onChange(n); };

  return (
    <div ref={box} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => { setOpen(o => !o); setQ(''); }}
        className={cn('inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[6px] border px-3 text-[13px] font-medium text-[var(--color-secondary-700)] hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-ui-focus-ring dark:text-ui-heading',
          selected.size ? 'border-[var(--color-secondary-700)] bg-ui-selected-bg dark:border-ui-heading' : 'border-ui-input-border bg-ui-input-bg')}>
        {label}
        {selected.size > 0 && (
          <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] bg-[var(--color-secondary-700)] px-1 text-[11px] font-semibold text-white dark:bg-ui-heading dark:text-ui-page-bg">{selected.size}</span>
        )}
        <ChevronDown size={14} aria-hidden className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-50 flex w-[260px] flex-col rounded-[6px] border border-ui-divider bg-ui-surface-elevated shadow-03">
          <label className="flex items-center gap-2 border-b border-ui-divider px-2.5 py-2">
            <Search size={14} aria-hidden className="shrink-0 text-ui-text-secondary" />
            <input autoFocus aria-label={searchPlaceholder ?? `Search ${label.toLowerCase()}`} placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}...`}
              value={q} onChange={e => setQ(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-ui-body outline-none placeholder:text-ui-text-secondary" />
          </label>
          <ul role="listbox" aria-multiselectable className="m-0 max-h-[280px] list-none overflow-y-auto p-1">
            {shown.length === 0 && <li className="px-2 py-1.5 text-[12px] text-ui-text-secondary">No matches</li>}
            {shown.map(o => (
              <li key={o.value}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-[13px] text-ui-body hover:bg-ui-hover-bg">
                  <Checkbox checked={selected.has(o.value)} onCheckedChange={() => toggle(o.value)} />
                  <span className="truncate">{o.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <button type="button" disabled={!selected.size} onClick={() => onChange(new Set())}
            className="cursor-pointer border-0 border-t border-solid border-ui-divider bg-transparent px-3 py-2 text-left text-[12px] font-medium text-error-normal hover:bg-ui-hover-bg disabled:cursor-default disabled:text-ui-text-secondary">
            Clear all ({selected.size})
          </button>
        </div>
      )}
    </div>
  );
}
