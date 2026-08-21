'use client';

import { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Vendor } from './AddVendorModal';

export function VendorSelect({
  vendors, displayValue, onPick, onClear, onAddNew, onDeleted, width = 170, placeholder = '— none —',
}: {
  vendors: Vendor[];
  displayValue: string;
  onPick: (vendor: Vendor) => void;
  onClear?: () => void;
  onAddNew: (typedName: string) => void;
  onDeleted?: (vendorId: string) => void;
  width?: number;
  placeholder?: string;
}) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const [rect, setRect]   = useState<DOMRect | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => { if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect()); };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false); setQuery('');
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter(v => `${v.code ?? ''} ${v.name}`.toLowerCase().includes(q));
  }, [vendors, query]);

  const hasValue = !!displayValue.trim();

  async function del(v: Vendor) {
    if (!window.confirm(`Delete vendor "${v.code} — ${v.name}"? It will be removed from all pickers.`)) return;
    setDeletingId(v.id);
    try {
      const res = await fetch(`/api/production/vendors/${v.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? 'Failed');
      toast.success('Vendor deleted');
      onDeleted?.(v.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally { setDeletingId(null); }
  }

  const panelH = 280;
  const openUp = rect ? (rect.bottom + panelH > window.innerHeight && rect.top > panelH) : false;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
          width: '100%', maxWidth: width, fontSize: 11, padding: '4px 6px', borderRadius: 4,
          border: '1px solid var(--border-default)', background: '#fff', cursor: 'pointer',
          color: hasValue ? 'var(--fg-default)' : 'var(--fg-faint)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hasValue ? displayValue : placeholder}</span>
        <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--fg-faint)' }} />
      </button>

      {open && rect && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed', zIndex: 100000,
            left: Math.min(rect.left, window.innerWidth - 252),
            top: openUp ? undefined : rect.bottom + 4,
            bottom: openUp ? (window.innerHeight - rect.top + 4) : undefined,
            width: 244, background: '#fff', border: '1px solid var(--border-default)',
            borderRadius: 6, boxShadow: '0 12px 32px rgba(0,0,0,0.22)', overflow: 'hidden',
          }}
        >
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search vendors…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: 'none', borderBottom: '1px solid var(--border-subtle)', outline: 'none' }}
          />
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {hasValue && onClear && (
              <Row label="— none —" onClick={() => { onClear(); setOpen(false); setQuery(''); }} />
            )}
            {filtered.map(v => (
              <Row
                key={v.id}
                label={`${v.code} — ${v.name}`}
                deleting={deletingId === v.id}
                onClick={() => { onPick(v); setOpen(false); setQuery(''); }}
                onDelete={onDeleted ? () => del(v) : undefined}
              />
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--fg-faint)' }}>No match</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); onAddNew(query.trim()); setQuery(''); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%',
              padding: '9px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: '#f0fdfa', color: '#0f766e', border: 'none', borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <Plus size={13} /> Add new vendor{query.trim() ? ` “${query.trim()}”` : ''}
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

function Row({ label, deleting, onClick, onDelete }: { label: string; deleting?: boolean; onClick: () => void; onDelete?: () => void }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', background: '#fff' }}
      onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          flex: 1, minWidth: 0, padding: '7px 10px', fontSize: 12, cursor: 'pointer', textAlign: 'left',
          background: 'transparent', border: 'none', color: 'var(--fg-default)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {label}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Delete vendor"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', color: deleting ? '#fca5a5' : '#dc2626', flexShrink: 0 }}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}
