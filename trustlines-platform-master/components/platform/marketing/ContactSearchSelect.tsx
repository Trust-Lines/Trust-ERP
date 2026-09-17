'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface ContactResult { id: string; name: string; prospectId: string; companyName: string | null }

// Unlike a plain <select>, this searches ALL Contacts platform-wide (not just the ones
// already linked to the current record) — lets a Potential get re-linked to the real
// person once found, instead of staying stuck on a placeholder.
export function ContactSearchSelect({ value, valueLabel, onChange, disabled }: {
  value: string;
  valueLabel: string;
  onChange: (contactId: string | null, contactName?: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContactResult[]>([]);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 0); }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/marketing/prospect-contacts/search?q=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(b => setResults(b.results ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  function select(c: ContactResult) {
    onChange(c.id, c.name);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(s => !s)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          border: 'none', background: 'transparent', padding: '3px 4px', cursor: disabled ? 'default' : 'pointer',
          fontSize: 13, fontWeight: 600, color: value ? 'var(--fg-default)' : 'var(--fg-faint)', textAlign: 'left',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value ? valueLabel : '— Search contacts…'}</span>
        {value && !disabled && (
          <span role="button" onClick={e => { e.stopPropagation(); onChange(null); }} style={{ color: 'var(--fg-faint)', display: 'flex', marginLeft: 4 }}>
            <X size={12} />
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, width: 300, zIndex: 100,
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.15)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
            <Search size={13} style={{ color: 'var(--fg-faint)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search all Contacts by name…"
              style={{ border: 'none', outline: 'none', fontSize: 12.5, flex: 1, background: 'transparent' }}
            />
            {loading && <Loader2 size={13} className="qv-spin" style={{ color: 'var(--fg-faint)' }} />}
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {query.trim().length < 2 ? (
              <div style={{ padding: 12, fontSize: 11.5, color: 'var(--fg-faint)', textAlign: 'center' }}>Type at least 2 characters…</div>
            ) : !loading && results.length === 0 ? (
              <div style={{ padding: 12, fontSize: 11.5, color: 'var(--fg-faint)', textAlign: 'center' }}>No contacts found.</div>
            ) : (
              results.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none',
                    background: 'transparent', cursor: 'pointer', fontSize: 12.5,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontWeight: 600, color: 'var(--fg-default)' }}>{c.name}</div>
                  {c.companyName && <div style={{ fontSize: 10.5, color: 'var(--fg-faint)' }}>{c.companyName}</div>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
