'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { hashColor, readableTextColor } from '@/lib/marketing/pillColor';

// Figma table tag (CRM Board 280:25017): 4px radius, 12px medium, tone bg + fg, chevron inside the tag.
function TonePill({ tone, label, chevron }: { tone: string; label: string; chevron?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%', minWidth: 0, padding: chevron ? '3px 8px 3px 10px' : '3px 10px', borderRadius: 4,
      background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)`,
      fontSize: 13.5, fontWeight: 500, lineHeight: '18px', whiteSpace: 'nowrap',
    }}>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {chevron && <ChevronDown size={16} style={{ flexShrink: 0 }} />}
    </span>
  );
}

export function ColorSelect({ value, options, knownColors, onChange, placeholder = '—', allowCreate = true, searchable = true, clearable = true, renderPill, toneFor }: {
  value: string | null;
  options: string[];
  knownColors: Record<string, string>;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Let the user type a brand-new value (free-form fields). Off for fixed lists. */
  allowCreate?: boolean;
  /** Show the search box. Off for short fixed lists. */
  searchable?: boolean;
  /** Show the "Clear" row. Off for fields that must always have a value. */
  clearable?: boolean;
  /** Draw each value yourself (e.g. a <StatusBadge>) instead of the coloured pill. */
  renderPill?: (value: string) => ReactNode;
  /** Draw values as Figma tags in a status tone (`t0`–`t10`, `info`, …) — `--status-<tone>-bg/fg`. */
  toneFor?: (value: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) setQuery(''); }, [open]);

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
        title={value ?? undefined}
        onClick={e => { e.stopPropagation(); setOpen(s => !s); }}
        style={{
          maxWidth: '100%', minWidth: 0,
          display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid transparent',
          borderRadius: 6, padding: '2px 6px 2px 2px', background: 'transparent', cursor: 'pointer', minHeight: 22,
        }}
      >
        {value && toneFor ? <TonePill tone={toneFor(value)} label={value} chevron /> : value && renderPill ? renderPill(value) : value ? (
          <span style={{ background: colorFor(value), color: readableTextColor(colorFor(value)), fontSize: 12.5, fontWeight: 600, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {value}
          </span>
        ) : (
          <span style={{ fontSize: 11.5, color: 'var(--fg-faint)', padding: '0 4px' }}>{placeholder}</span>
        )}
        {!(value && toneFor) && <ChevronDown size={16} style={{ color: 'var(--fg-faint)', flexShrink: 0 }} />}
      </button>

      {/* Mounted only while open: lead rows hold up to 9 of these, so a closed picker stays a plain
          button. The shared Popover handles placement, outside clicks, Escape and focus return. */}
      {open && (
        <Popover open onOpenChange={(o, details) => {
          if (o) return;
          // A press on our own trigger is "outside" for the Popover; the trigger's click toggles it instead.
          if (details.reason === 'outside-press' && triggerRef.current?.contains(details.event?.target as Node)) return;
          setOpen(false);
        }}>
        <PopoverContent
          anchor={triggerRef}
          align="start"
          initialFocus={searchable ? inputRef : undefined}
          finalFocus={triggerRef}
          onClick={e => e.stopPropagation()}
          className="gap-0 overflow-hidden rounded-[10px] p-0"
          style={{
            width: 'max(var(--anchor-width), 220px)',
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            boxShadow: '0 12px 32px rgba(0,0,0,.18)',
          }}
        >
          {searchable && <input
            ref={inputRef}
            className="form-input"
            style={{ border: 'none', borderBottom: '1px solid var(--border-subtle)', borderRadius: 0, fontSize: 13, padding: '9px 12px' }}
            placeholder="Search…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && query.trim() && allowCreate) select(query.trim()); if (e.key === 'Escape') setOpen(false); }}
          />}
          <div style={{ maxHeight: 260, overflowY: 'auto', padding: 6, display: 'grid', gap: 2 }}>
            {allowCreate && query.trim() && !exactMatch && (
              <button
                onClick={() => select(query.trim())}
                style={optionRow}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>+ Create &ldquo;{query.trim()}&rdquo;</span>
              </button>
            )}
            {filtered.length === 0 && !query.trim() && allowCreate && (
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
                  {toneFor ? <TonePill tone={toneFor(o)} label={o} /> : renderPill ? renderPill(o) : (
                    <span style={{ background: bg, color: readableTextColor(bg), fontSize: 12.5, fontWeight: 600, padding: '4px 12px', borderRadius: 999 }}>
                      {o}
                    </span>
                  )}
                  {selected && <Check size={14} style={{ color: 'var(--brand-teal)', marginLeft: 'auto', flexShrink: 0 }} />}
                </button>
              );
            })}
            {value && clearable && (
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
        </PopoverContent>
        </Popover>
      )}
    </>
  );
}

const optionRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 6,
  transition: 'background 80ms',
};
