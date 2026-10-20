'use client';

import * as React from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Search } from 'lucide-react';
import type { NavSection } from './Sidebar';

// Design: Figma "TRUST-LINES ERP" → "Global search" (101:12544) + "Command palette" (99:12007).
// Searches only the pages this user may open (the same list the sidebar shows) — no backend.
interface PageHit {
  label: string;
  href: string;
  group: string;
  icon: NavSection['items'][number]['icon'];
}

export function PageSearch({ sections }: { sections: NavSection[] }) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const pages = useMemo<PageHit[]>(
    () => sections.flatMap(s => s.items.map(i => ({ label: i.label, href: i.href, group: s.title, icon: i.icon }))),
    [sections],
  );
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? pages.filter(p => p.label.toLowerCase().includes(q) || p.group.toLowerCase().includes(q)) : pages;
  }, [pages, query]);

  useEffect(() => { setActive(0); }, [query]);

  // Ctrl+K / ⌘K focuses the search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function go(hit: PageHit | undefined) {
    if (!hit) return;
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(hits[active]); }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  }

  return (
    <div ref={boxRef} className="relative w-[310px] max-w-full shrink">
      <div className="flex h-9 items-center gap-2.5 rounded-md border border-primary-200 bg-white px-3 transition-colors focus-within:border-secondary-700 dark:border-secondary-500 dark:bg-primary-800 dark:focus-within:border-primary-50">
        <Search className="h-4 w-4 shrink-0 text-primary-400 dark:text-primary-200" strokeWidth={1.5} aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search pages"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && hits[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder="Search anything…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-[13px] leading-[1.4] text-primary-500 outline-none placeholder:text-primary-400 dark:text-primary-50 dark:placeholder:text-primary-200"
        />
        <kbd className="shrink-0 font-ui text-[11px] leading-[1.4] text-primary-400 dark:text-primary-200">Ctrl+K</kbd>
      </div>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-primary-100 bg-white shadow-[0_16px_48px_rgba(10,12,15,0.12)] dark:border-primary-600 dark:bg-secondary-800">
          <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto p-3">
            <p className="text-[11px] uppercase leading-[1.4] text-primary-400 dark:text-primary-200">
              Pages · {hits.length} {hits.length === 1 ? 'result' : 'results'}
            </p>
            <ul id={listId} role="listbox" aria-label="Pages" className="flex flex-col gap-1.5">
              {hits.map((h, i) => {
                const Icon = h.icon;
                const on = i === active;
                return (
                  <li
                    key={h.href}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={on}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={e => { e.preventDefault(); go(h); }}
                    className={`flex cursor-pointer items-center gap-3 rounded-md p-3 ${on ? 'bg-secondary-100 dark:bg-secondary-700' : ''}`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-primary-500 dark:text-primary-100" strokeWidth={1.5} />
                    <span className="flex min-w-0 flex-1 flex-col gap-[3px] leading-[1.4]">
                      <span className={`truncate text-[13px] text-primary-500 dark:text-primary-50 ${on ? 'font-semibold' : ''}`}>{h.label}</span>
                      <span className="truncate text-[11px] text-primary-400 dark:text-primary-200">{h.group} / {h.label}</span>
                    </span>
                    {on && <Check className="h-4 w-4 shrink-0 text-primary-500 dark:text-primary-100" strokeWidth={1.5} aria-hidden="true" />}
                  </li>
                );
              })}
            </ul>
            {hits.length === 0 && <p className="px-3 py-4 text-[13px] text-primary-400 dark:text-primary-200">No pages match “{query.trim()}”.</p>}
          </div>
          <div className="flex items-start justify-between gap-3 bg-primary-50 p-3.5 text-[11px] leading-[1.4] text-primary-400 dark:bg-primary-800 dark:text-primary-200">
            <span className="whitespace-pre">{'↑ ↓ to navigate   ↵ to open   Esc to close'}</span>
            <span className="whitespace-nowrap">Results respect your access</span>
          </div>
        </div>
      )}
    </div>
  );
}
