'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { hashColor, readableTextColor } from '@/lib/marketing/pillColor';

export function SourceSelect({ value, options, onChange, placeholder = '—' }: {
  value: string | null;
  options: string[];
  onChange: (next: string) => void;
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

  const filtered = options.filter(o => o.toLowerCase().includes(query.trim().toLowerCase()));
  const exactMatch = options.some(o => o.toLowerCase() === query.trim().toLowerCase());

  function select(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(s => !s)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--border-subtle)',
          borderRadius: 6, padding: '3px 8px 3px 3px', background: 'var(--bg-surface)', cursor: 'pointer', minHeight: 24,
        }}
      >
        {value ? (
          <span style={{ background: hashColor(value), color: readableTextColor(hashColor(value)), fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>
            {value}
          </span>
        ) : (
          <span style={{ fontSize: 11.5, color: 'var(--fg-faint)', padding: '0 4px' }}>{placeholder}</span>
        )}
        <ChevronDown size={12} style={{ color: 'var(--fg-faint)' }} />
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
            onKeyDown={e => { if (e.key === 'Enter' && query.trim()) select(query.trim()); if (e.key === 'Escape') setOpen(false); }}
          />
          <div style={{ maxHeight: 220, overflowY: 'auto', padding: 6, display: 'grid', gap: 3 }}>
            {query.trim() && !exactMatch && (
              <button
                onClick={() => select(query.trim())}
                style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 6px', borderRadius: 5, fontSize: 12 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                + Create &ldquo;{query.trim()}&rdquo;
              </button>
            )}
            {value && (
              <button
                onClick={() => select('')}
                style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 6px', borderRadius: 5, fontSize: 12, color: 'var(--fg-subtle)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                Clear
              </button>
            )}
            {filtered.length === 0 && !query.trim() && (
              <div style={{ fontSize: 11.5, color: 'var(--fg-faint)', padding: '5px 6px' }}>No sources yet.</div>
            )}
            {filtered.map(o => {
              const bg = hashColor(o);
              return (
                <button
                  key={o}
                  onClick={() => select(o)}
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
