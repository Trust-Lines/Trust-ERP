'use client';

import { useEffect, useState } from 'react';

function formatWithCommas(digits: string): string {
  if (!digits) return '';
  return Number(digits).toLocaleString('en-US');
}

export function CurrencyCell({ value, onSave, placeholder = '—' }: {
  value: number | null;
  onSave: (next: number | null) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [digits, setDigits] = useState(value != null ? String(Math.round(value)) : '');

  useEffect(() => { if (!editing) setDigits(value != null ? String(Math.round(value)) : ''); }, [value, editing]);

  function commit() {
    setEditing(false);
    const next = digits ? Number(digits) : null;
    if (next !== value) onSave(next);
  }

  if (!editing) {
    return (
      <button
        onClick={e => { e.stopPropagation(); setEditing(true); }}
        style={{
          background: 'none', border: '1px solid transparent', borderRadius: 6, cursor: 'text',
          padding: '3px 6px', fontSize: 12, fontWeight: 600, color: value != null ? 'var(--fg-default)' : 'var(--fg-faint)',
          fontVariantNumeric: 'tabular-nums', width: '100%', textAlign: 'left',
        }}
      >
        {value != null ? `$${value.toLocaleString('en-US')}` : placeholder}
      </button>
    );
  }

  return (
    <span
      onClick={e => e.stopPropagation()}
      style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-default)', borderRadius: 6, background: 'var(--bg-surface)', padding: '2px 6px', gap: 2 }}
    >
      <span style={{ fontSize: 12, color: 'var(--fg-faint)', fontWeight: 600 }}>$</span>
      <input
        autoFocus
        type="text" inputMode="numeric"
        value={formatWithCommas(digits)}
        onChange={e => setDigits(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setDigits(value != null ? String(Math.round(value)) : ''); setEditing(false); } }}
        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, fontWeight: 600, width: 70, fontVariantNumeric: 'tabular-nums' }}
      />
    </span>
  );
}
