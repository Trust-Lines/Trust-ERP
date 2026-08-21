'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { hashColor, readableTextColor } from '@/lib/marketing/pillColor';

export function TagMultiSelect({ values, options, onChange, placeholder = 'Add…' }: {
  values: string[];
  options: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => { if (open) { setQuery(''); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);

  const available = options.filter(o => !values.includes(o));
  const filtered = available.filter(o => o.toLowerCase().includes(query.trim().toLowerCase()));
  const exactMatch = options.some(o => o.toLowerCase() === query.trim().toLowerCase());

  function add(v: string) {
    if (!values.includes(v)) onChange([...values, v]);
    setQuery('');
    inputRef.current?.focus();
  }
  function remove(v: string) {
    onChange(values.filter(x => x !== v));
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
      {values.map(v => {
        const bg = hashColor(v);
        return (
          <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: bg, color: readableTextColor(bg), fontSize: 10.5, fontWeight: 600, padding: '2px 4px 2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
            {v}
            <button onClick={() => remove(v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', padding: 0, opacity: 0.8 }} aria-label={`Remove ${v}`}>
              <X size={11} />
            </button>
          </span>
        );
      })}
      <button
        onClick={() => setOpen(s => !s)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: '1px dashed var(--border-subtle)', borderRadius: 4, padding: '2px 7px', background: 'none', cursor: 'pointer', fontSize: 10.5, color: 'var(--fg-faint)' }}
      >
        <Plus size={11} /> {values.length === 0 ? placeholder : ''}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, width: 220, zIndex: 50,
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.15)', overflow: 'hidden',
        }}>
          <input
            ref={inputRef}
            className="form-input"
            style={{ border: 'none', borderBottom: '1px solid var(--border-subtle)', borderRadius: 0, fontSize: 12.5 }}
            placeholder="Search or type new…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && query.trim()) add(query.trim()); if (e.key === 'Escape') setOpen(false); }}
          />
          <div style={{ maxHeight: 220, overflowY: 'auto', padding: 6, display: 'grid', gap: 3 }}>
            {query.trim() && !exactMatch && (
              <button
                onClick={() => add(query.trim())}
                style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 6px', borderRadius: 5, fontSize: 12 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                + Create &ldquo;{query.trim()}&rdquo;
              </button>
            )}
            {filtered.length === 0 && !query.trim() && (
              <div style={{ fontSize: 11.5, color: 'var(--fg-faint)', padding: '5px 6px' }}>
                {available.length === 0 ? 'No more options.' : 'No matches.'}
              </div>
            )}
            {filtered.map(o => {
              const bg = hashColor(o);
              return (
                <button
                  key={o}
                  onClick={() => add(o)}
                  style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 5 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ background: bg, color: readableTextColor(bg), fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>
                    {o}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
