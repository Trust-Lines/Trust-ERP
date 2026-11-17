'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';

// Free-text input with a per-browser list of past entries (localStorage "docgen_<key>"), used by
// the Item List / Price List generator for TYPE, category, segment, group and taking fields.

function loadOptions(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(`docgen_${key}`) ?? '[]') as string[]; }
  catch { return []; }
}
export function saveOption(key: string, value: string) {
  if (!value.trim()) return;
  const opts = loadOptions(key);
  if (!opts.includes(value)) {
    opts.unshift(value);
    localStorage.setItem(`docgen_${key}`, JSON.stringify(opts.slice(0, 20)));
  }
}
function deleteOption(key: string, value: string) {
  const opts = loadOptions(key).filter(o => o !== value);
  localStorage.setItem(`docgen_${key}`, JSON.stringify(opts));
}

export function DropdownInput({ value, onChange, onBlur, placeholder, optionsKey, style, dark, bold, onSelectOption }: {
  value: string; onChange: (v: string) => void; onBlur?: (v: string) => void;
  placeholder?: string; optionsKey: string; style?: React.CSSProperties; dark?: boolean; bold?: boolean;
  onSelectOption?: (v: string) => void;
}) {
  const [open, setOpen]     = useState(false);
  const [opts, setOpts]     = useState<string[]>([]);
  const [rect, setRect]     = useState<DOMRect | null>(null);
  const wrapRef             = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpts(loadOptions(optionsKey)); }, [optionsKey]);
  useEffect(() => {
    function close(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function openDropdown() {
    setOpts(loadOptions(optionsKey));
    if (wrapRef.current) setRect(wrapRef.current.getBoundingClientRect());
    setOpen(true);
  }

  function removeOpt(o: string) {
    deleteOption(optionsKey, o);
    setOpts(prev => prev.filter(x => x !== o));
  }

  const filtered = opts.filter(o => o.toLowerCase().includes(value.toLowerCase()) && o !== value);

  const portal = open && filtered.length > 0 && rect && typeof document !== 'undefined'
    ? createPortal(
        <div style={{
          position: 'fixed', top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 240), maxWidth: 360,
          zIndex: 99999, background: 'var(--il-pop-bg, #fff)', border: '1px solid var(--il-pop-border, #d0d0d0)',
          borderRadius: 5, boxShadow: '0 6px 18px rgba(0,0,0,.22)', maxHeight: 240, overflowY: 'auto',
        }}>
          {filtered.map(o => (
            <div key={o} style={{ display: 'flex', alignItems: 'flex-start', background: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--il-pop-hover, #f0f4ff)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <button type="button" onMouseDown={() => { if (onSelectOption) { onSelectOption(o); } else { onChange(o); if (onBlur) onBlur(o); } setOpen(false); }}
                style={{ flex: 1, minWidth: 0, textAlign: 'left', padding: '6px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: 'var(--il-pop-fg, #111)', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35 }}>
                {o}
              </button>
              <button type="button" title="Delete saved entry"
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); removeOpt(o); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: '#dc2626', flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )
    : null;

  const borderCol = dark ? 'rgba(255,255,255,0.25)' : 'var(--border-subtle)';
  const bgCol     = dark ? 'rgba(255,255,255,0.12)' : 'var(--bg-surface)';
  const textCol   = dark ? '#fff' : 'var(--fg-default)';

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', height: 32, border: `1px solid ${borderCol}`, borderRadius: 4, background: bgCol }}>
        <input value={value} onChange={e => onChange(e.target.value)} onFocus={openDropdown}
          onBlur={() => { setTimeout(() => setOpen(false), 150); if (onBlur) onBlur(value); }}
          placeholder={placeholder}
          style={{ flex: 1, minWidth: 0, padding: '6px 8px', border: 'none', background: 'transparent', fontSize: dark ? 13 : 14, fontWeight: bold ? 700 : 400, outline: 'none', color: textCol }} />
        {opts.length > 0 && (
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { openDropdown(); setOpen(o => !o); }} style={{ background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer' }}>
            <ChevronDown size={13} color={dark ? '#ddd' : 'var(--fg-faint)'} />
          </button>
        )}
      </div>
      {portal}
    </div>
  );
}
