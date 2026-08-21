'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

export interface GeoResult {
  id: number; label: string; display: string;
  street: string; city: string; county: string; state: string; stateAbbr: string; postcode: string;
}

export function LocationSearch({ onSelect, placeholder, stateAbbr }: {
  onSelect: (r: GeoResult) => void;
  placeholder?: string;
  stateAbbr?: string;
}) {
  const [q, setQ]             = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const disabled = !stateAbbr;

  useEffect(() => {
    const term = q.trim();
    if (disabled || term.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(term)}&state=${encodeURIComponent(stateAbbr ?? '')}`);
        const json = await res.json() as { results?: GeoResult[] };
        setResults(json.results ?? []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 450);
    return () => clearTimeout(t);
  }, [q, stateAbbr, disabled]);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <MapPin size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-faint)' }} />
        <input
          className="form-input"
          style={{ paddingLeft: 32, opacity: disabled ? 0.6 : 1 }}
          placeholder={disabled ? 'Select a state first…' : (placeholder ?? 'Search city or address…')}
          value={q}
          disabled={disabled}
          onChange={e => setQ(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true); }}
        />
        {loading && <Loader2 size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-faint)', animation: 'spin 1s linear infinite' }} />}
      </div>

      {open && (results.length > 0 || (!loading && q.trim().length >= 3)) && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: 4, background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 8, boxShadow: 'var(--shadow-md, 0 4px 16px rgba(0,0,0,.12))', maxHeight: 280, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--fg-faint)' }}>No matches — keep typing or refine.</div>
          ) : results.map(r => (
            <button
              key={r.id} type="button"
              onClick={() => { onSelect(r); setQ(''); setResults([]); setOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', borderBottom: '1px solid var(--border-subtle)', background: '#fff', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-default)' }}>{r.label}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.display}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
