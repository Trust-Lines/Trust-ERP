'use client';

import { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { popupBase } from '@/components/ui/field-styles';
import { cn } from '@/lib/utils';
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
          border: '1px solid var(--border-default)', background: 'var(--bg-surface)', cursor: 'pointer',
          color: hasValue ? 'var(--fg-default)' : 'var(--fg-faint)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hasValue ? displayValue : placeholder}</span>
        <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--fg-faint)' }} />
      </button>

      {open && rect && createPortal(
        <div
          ref={panelRef}
          className={cn(popupBase, 'overflow-hidden text-[12px] dark:p-0')}
          style={{
            position: 'fixed', zIndex: 100000,
            left: Math.min(rect.left, window.innerWidth - 252),
            top: openUp ? undefined : rect.bottom + 4,
            bottom: openUp ? (window.innerHeight - rect.top + 4) : undefined,
            width: 244,
          }}
        >
          <div className="flex items-center gap-2 border-b border-ui-divider px-2.5 py-2">
            <Search size={13} className="shrink-0 text-ui-text-secondary" aria-hidden />
            <input
              autoFocus
              aria-label="Search vendors"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search vendors…"
              className="w-full min-w-0 border-0 bg-transparent text-[13px] text-ui-heading shadow-none! outline-none! placeholder:text-ui-text-secondary"
            />
          </div>
          <div className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto p-1.5 [scrollbar-width:thin] dark:[scrollbar-color:var(--color-primary-600)_transparent]">
            {hasValue && onClear && (
              <Row label="— none —" onClick={() => { onClear(); setOpen(false); setQuery(''); }} />
            )}
            {filtered.map(v => (
              <Row
                key={v.id}
                label={`${v.code} — ${v.name}`}
                selected={`${v.code} — ${v.name}` === displayValue}
                deleting={deletingId === v.id}
                onClick={() => { onPick(v); setOpen(false); setQuery(''); }}
                onDelete={onDeleted ? () => del(v) : undefined}
              />
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-1.5 text-[11px] text-ui-text-secondary">No match</div>
            )}
          </div>
          <div className="border-t border-ui-divider p-1.5 dark:border-t-0">
            <Button
              variant="ghost"
              className="w-full justify-start dark:text-ui-body"
              onClick={() => { setOpen(false); onAddNew(query.trim()); setQuery(''); }}
            >
              <Plus aria-hidden /> Add new vendor{query.trim() ? ` “${query.trim()}”` : ''}
            </Button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function Row({ label, selected, deleting, onClick, onDelete }: { label: string; selected?: boolean; deleting?: boolean; onClick: () => void; onDelete?: () => void }) {
  return (
    <div className={cn(
      'group flex items-center rounded-[2px] text-ui-body hover:bg-primary-700 hover:text-primary-50 dark:rounded-[4px] dark:hover:bg-white/10',
      selected && 'bg-ui-selected-bg font-semibold dark:bg-[var(--ui-menu-active-bg)] dark:text-[var(--ui-menu-active-fg)] dark:hover:bg-[var(--ui-menu-active-bg)] dark:hover:text-[var(--ui-menu-active-fg)]',
    )}>
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent px-2 py-2 text-left text-[13px] text-inherit outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ui-focus-ring"
      >
        {label}
      </button>
      {selected && <Check size={14} className="mr-1 shrink-0" aria-label="Selected" />}
      {onDelete && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          disabled={deleting}
          title="Delete vendor"
          aria-label={`Delete vendor ${label}`}
          className="shrink-0 cursor-pointer border-0 bg-transparent px-2 py-1.5 text-error-normal outline-none group-hover:text-primary-50 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring disabled:opacity-50"
        >
          <Trash2 size={12} aria-hidden />
        </button>
      )}
    </div>
  );
}
