'use client';

import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { hashColor, readableTextColor } from '@/lib/marketing/pillColor';

export function ColorSelect({ value, options, knownColors, onChange, placeholder = '—' }: {
  value: string | null;
  options: string[];
  knownColors: Record<string, string>;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const place = () => {
      const r = triggerRef.current!.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 220) });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => { if (open) { setQuery(''); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);

  const colorFor = (v: string) => knownColors[v] ?? hashColor(v);
  const filtered = options.filter(o => o.toLowerCase().includes(query.trim().toLowerCase()));
  const exactMatch = options.some(o => o.toLowerCase() === query.trim().toLowerCase());

  function select(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={e => { e.stopPropagation(); setOpen(s => !s); }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid transparent',
          borderRadius: 6, padding: '2px 6px 2px 2px', background: 'transparent', cursor: 'pointer', minHeight: 22,
        }}
      >
        {value ? (
          <span style={{ background: colorFor(value), color: readableTextColor(colorFor(value)), fontSize: 10.5, fontWeight: 600, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
            {value}
          </span>
        ) : (
          <span style={{ fontSize: 11.5, color: 'var(--fg-faint)', padding: '0 4px' }}>{placeholder}</span>
        )}
        <ChevronDown size={11} style={{ color: 'var(--fg-faint)', flexShrink: 0 }} />
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 10050,
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,.18)', overflow: 'hidden',
          }}
        >
          <input
            ref={inputRef}
            className="form-input"
            style={{ border: 'none', borderBottom: '1px solid var(--border-subtle)', borderRadius: 0, fontSize: 13, padding: '9px 12px' }}
            placeholder="Search…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && query.trim()) select(query.trim()); if (e.key === 'Escape') setOpen(false); }}
          />
          <div style={{ maxHeight: 260, overflowY: 'auto', padding: 6, display: 'grid', gap: 2 }}>
            {query.trim() && !exactMatch && (
              <button
                onClick={() => select(query.trim())}
                style={optionRow}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>+ Create &ldquo;{query.trim()}&rdquo;</span>
              </button>
            )}
            {filtered.length === 0 && !query.trim() && (
              <div style={{ fontSize: 12, color: 'var(--fg-faint)', padding: '8px 10px' }}>No options yet — type to create one.</div>
            )}
            {filtered.map(o => {
              const bg = colorFor(o);
              const selected = o === value;
              return (
                <button
                  key={o}
                  onClick={() => select(o)}
                  style={optionRow}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ background: bg, color: readableTextColor(bg), fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 999 }}>
                    {o}
                  </span>
                  {selected && <Check size={14} style={{ color: 'var(--brand-teal)', marginLeft: 'auto', flexShrink: 0 }} />}
                </button>
              );
            })}
            {value && (
              <>
                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 2px' }} />
                <button
                  onClick={() => select('')}
                  style={{ ...optionRow, color: 'var(--fg-subtle)', fontSize: 12 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

const optionRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 6,
  transition: 'background 80ms',
};
