'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Menu, MenuContent, MenuGroup, MenuGroupLabel, MenuItem } from '@/components/ui/menu';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// Production tracker editors for TYPE, VENDOR and ORDER TYPE, and the row's right-click menu —
// the Trust System Projects board's behaviour (CellVendorAutocomplete, CellOrderTypeAutocomplete,
// AddVendorModal, InlineEditPanel, row context menu) in T-ERP's design. Saves go to T-ERP's own
// API (/api/production/*); the server works out PF codes (lib/production/pfCode.ts).

export interface BoardVendor { id: string; code: string | null; name: string; fixedMillworkCodes?: boolean }

const vendorLabel = (v: BoardVendor) => (v.code ? `${v.code} - ${v.name}` : v.name);
/** Board popups use the shared Popover; this only trims its default padding / gap. */
const PANEL = 'gap-0 overflow-hidden p-0';
const INPUT = 'h-8 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-2.5 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-ui-focus-ring';
const OPTION = 'flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-1.5 text-left text-[13px] text-ui-body';

/** Vendors and order types, loaded once per board. */
export function useBoardLists() {
  const [vendors, setVendors] = useState<BoardVendor[]>([]);
  const [orderTypes, setOrderTypes] = useState<string[]>([]);
  const reloadVendors = useCallback(async () => {
    const r = await fetch('/api/production/vendors').then(x => (x.ok ? x.json() : null)).catch(() => null);
    if (r?.vendors) setVendors(r.vendors);
  }, []);
  const reloadOrderTypes = useCallback(async () => {
    const r = await fetch('/api/production/order-types').then(x => (x.ok ? x.json() : null)).catch(() => null);
    if (r?.orderTypes) setOrderTypes(r.orderTypes);
  }, []);
  useEffect(() => { void reloadVendors(); void reloadOrderTypes(); }, [reloadVendors, reloadOrderTypes]);
  return { vendors, orderTypes, reloadVendors, reloadOrderTypes };
}

function useDismiss(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onScroll = (e: Event) => { if (!(e.target instanceof Element && e.target.closest('[data-board-popup]'))) onClose(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onClose); };
  }, [onClose]);
}

// ── Vendor ──────────────────────────────────────────────────────────────────────────────────
/** The vendor list: YSM first and marked, then A→Z by "CODE - Name"; filters from 3 letters. */
export function VendorList({ vendors, current, query, onPick, onVendorsChanged, onCreate, autoFocusFirst }: {
  vendors: BoardVendor[]; current: string | null; query: string; onPick: (v: BoardVendor) => void;
  onVendorsChanged: () => void; onCreate: (name: string) => void; autoFocusFirst?: boolean;
}) {
  const [editing, setEditing] = useState<{ id: string; code: string; name: string } | null>(null);
  const [active, setActive] = useState(0);
  const q = query.trim().toLowerCase();
  const list = useMemo(() => {
    const sorted = [...vendors].sort((a, b) => {
      const ay = (a.code ?? '').toUpperCase() === 'YSM' ? 0 : 1, by = (b.code ?? '').toUpperCase() === 'YSM' ? 0 : 1;
      return ay - by || vendorLabel(a).localeCompare(vendorLabel(b));
    });
    return q.length >= 3 ? sorted.filter(v => vendorLabel(v).toLowerCase().includes(q)) : sorted;
  }, [vendors, q]);
  const exact = vendors.some(v => [v.code ?? '', v.name, vendorLabel(v)].some(x => x.toLowerCase() === q));
  useEffect(() => { setActive(0); }, [q]);

  async function saveEdit() {
    if (!editing) return;
    const res = await fetch(`/api/production/vendors/${editing.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: editing.code, name: editing.name }),
    }).catch(() => null);
    const b = await res?.json().catch(() => ({}));
    if (!res?.ok) { toast.error(b?.error ?? 'Could not update the vendor'); return; }
    setEditing(null);
    onVendorsChanged();
  }

  return (
    <div
      className="max-h-[300px] overflow-y-auto py-1" role="listbox"
      onKeyDown={e => {
        if (editing) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(list.length - 1, i + 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
        if ((e.key === 'Enter' || e.key === 'Tab') && list[active]) { e.preventDefault(); onPick(list[active]); }
      }}
      data-autofocus={autoFocusFirst || undefined}
    >
      {list.map((v, i) => {
        const ysm = (v.code ?? '').toUpperCase() === 'YSM';
        if (editing?.id === v.id) {
          return (
            <div key={v.id} className="flex items-center gap-1.5 px-2 py-1">
              <input aria-label="Vendor code" className={cn(INPUT, 'w-[80px] uppercase')} value={editing.code} autoFocus
                onChange={e => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                onKeyDown={e => { if (e.key === 'Enter') void saveEdit(); if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); } }} />
              <input aria-label="Vendor name" className={INPUT} value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') void saveEdit(); if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); } }} />
              <Button size="xs" onClick={() => void saveEdit()}>Save</Button>
              <Button size="xs" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          );
        }
        return (
          <div key={v.id} className={cn('group flex items-center', i === active && 'bg-ui-hover-bg', v.id === current && 'bg-[#e5f3ff] dark:bg-ui-selected-bg')}
            style={ysm ? { borderLeft: '4px solid #fbbf24' } : undefined}>
            <button type="button" role="option" aria-selected={v.id === current} onMouseEnter={() => setActive(i)} onClick={() => onPick(v)}
              className={cn(OPTION, 'flex-1', ysm && 'font-semibold')}>
              {vendorLabel(v)}
            </button>
            <button type="button" aria-label={`Edit ${vendorLabel(v)}`} title="Edit vendor"
              onClick={() => setEditing({ id: v.id, code: v.code ?? '', name: v.name })}
              className="mr-1.5 inline-flex size-6 cursor-pointer items-center justify-center rounded-[4px] border-0 bg-transparent text-ui-text-secondary opacity-40 hover:bg-ui-hover-bg hover:opacity-100">
              <Pencil size={12} aria-hidden />
            </button>
          </div>
        );
      })}
      {list.length === 0 && <p className="m-0 px-3 py-2 text-[12px] text-ui-text-secondary">No vendor matches.</p>}
      {query.trim().length >= 2 && !exact && (
        <button type="button" onClick={() => onCreate(query.trim())} className={cn(OPTION, 'font-medium text-[var(--color-success-dark,#15803d)] hover:bg-ui-hover-bg')}>
          <Plus size={14} aria-hidden /> Create new vendor &ldquo;{query.trim()}&rdquo;
        </button>
      )}
    </div>
  );
}

export function VendorPicker({ rect, current, vendors, onPick, onClose, onVendorsChanged }: {
  rect: DOMRect; current: string | null; vendors: BoardVendor[];
  onPick: (v: BoardVendor) => void; onClose: () => void; onVendorsChanged: () => Promise<void> | void;
}) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState<string | null>(null);
  useDismiss(creating ? () => {} : onClose);
  const anchor = useMemo(() => ({ getBoundingClientRect: () => rect }), [rect]);
  return (
    <Popover open onOpenChange={o => { if (!o && creating === null) onClose(); }}>
      <PopoverContent data-board-popup backdrop aria-label="Vendor" anchor={anchor} align="start" sideOffset={2}
        className={PANEL} style={{ width: Math.max(320, rect.width) }}>
        <div className="border-b border-ui-divider p-2">
          <input autoFocus className={INPUT} placeholder="Select or type to filter..." aria-label="Vendor" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Tab') (e.currentTarget.parentElement?.nextElementSibling as HTMLElement | null)?.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, bubbles: true })); }} />
        </div>
        <VendorList vendors={vendors} current={current} query={query} onPick={onPick} onVendorsChanged={() => void onVendorsChanged()} onCreate={setCreating} />
        {creating !== null && (
          <AddVendorForm initialName={creating} onClose={() => setCreating(null)}
            onCreated={async v => { setCreating(null); await onVendorsChanged(); onPick(v); }} />
        )}
      </PopoverContent>
    </Popover>
  );
}

/** "Add New Vendor" (Trust System AddVendorModal): name and a 2–10 character code, both unique. */
export function AddVendorForm({ initialName, onCreated, onClose }: { initialName: string; onCreated: (v: BoardVendor) => void; onClose: () => void }) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState('');
  const [fixed, setFixed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function create() {
    setError(null);
    if (!name.trim()) { setError('Vendor name is required'); return; }
    if (code.length < 2 || code.length > 10) { setError('Vendor code must be 2–10 characters'); return; }
    setSaving(true);
    const res = await fetch('/api/production/vendors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), code, fixedMillworkCodes: fixed, strict: true }),
    }).catch(() => null);
    const b = await res?.json().catch(() => ({}));
    setSaving(false);
    if (!res?.ok) { setError(b?.error ?? 'Could not create the vendor'); return; }
    toast.success(`Vendor created: ${b.vendor.code} - ${b.vendor.name}`);
    onCreated(b.vendor);
  }
  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent
        title="Add New Vendor"
        footer={<>
          <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button loading={saving} onClick={() => void create()}>Create Vendor</Button>
        </>}
      >
        <div className="flex flex-col gap-3">
          {error && <p role="alert" className="m-0 rounded-[6px] bg-error-light px-3 py-2 text-[12px] text-error-dark">{error}</p>}
          <label className="flex flex-col gap-1 text-[12px] font-medium text-ui-body">Vendor Name *
            <input className={INPUT} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Premier Millwork Solutions" autoFocus />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-ui-body">Vendor Code * (2–10 characters)
            <input className={cn(INPUT, 'uppercase')} value={code} maxLength={10} placeholder="e.g. PMS"
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} />
          </label>
          <label className="flex items-start gap-2 text-[12px] text-ui-body">
            <Checkbox checked={fixed} onCheckedChange={v => setFixed(!!v)} className="mt-0.5" />
            Millwork PF code by order type (Basic → M01, Selective → M02, Custom → M03)
          </label>
          <p className="m-0 rounded-[6px] bg-ui-surface px-3 py-2 text-[12px] text-ui-body">
            When you assign this vendor to project items, PF codes will be automatically generated:{' '}
            <code className="font-mono">{code || 'CODE'}-[PROJECT_NO]-[TYPE][NUM]</code>
          </p>
        </div>
      </ModalContent>
    </Modal>
  );
}

// ── Order type ──────────────────────────────────────────────────────────────────────────────
/** Order types A→Z, filtered as you type; "+ Add order type" when the text isn't in the list. */
export function OrderTypeList({ options, current, query, onPick, onAdded }: {
  options: string[]; current: string | null; query: string; onPick: (name: string) => void; onAdded: () => void;
}) {
  const [active, setActive] = useState(0);
  const q = query.trim().toLowerCase();
  const list = useMemo(() => options.filter(o => !q || o.toLowerCase().includes(q)), [options, q]);
  const exact = options.some(o => o.toLowerCase() === q);
  useEffect(() => { setActive(0); }, [q]);
  async function add() {
    const res = await fetch('/api/production/order-types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: query.trim() }) }).catch(() => null);
    const b = await res?.json().catch(() => ({}));
    if (!res?.ok) { toast.error(res?.status === 403 ? 'You can’t add order types' : (b?.error ?? 'Could not add the order type')); return; }
    onAdded();
    onPick(b.orderType);
  }
  return (
    <div className="max-h-[300px] overflow-y-auto py-1" role="listbox"
      onKeyDown={e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(list.length - 1, i + 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
        if ((e.key === 'Enter' || e.key === 'Tab') && list[active]) { e.preventDefault(); onPick(list[active]); }
      }}>
      {list.map((o, i) => (
        <button key={o} type="button" role="option" aria-selected={o === current} onMouseEnter={() => setActive(i)} onClick={() => onPick(o)}
          className={cn(OPTION, i === active && 'bg-ui-hover-bg', o === current && 'bg-[#e5f3ff] font-medium dark:bg-ui-selected-bg')}>
          {o}
        </button>
      ))}
      {list.length === 0 && <p className="m-0 px-3 py-2 text-[12px] text-ui-text-secondary">No order type matches.</p>}
      {query.trim().length >= 2 && !exact && (
        <button type="button" onClick={() => void add()} className={cn(OPTION, 'font-medium text-[var(--color-success-dark,#15803d)] hover:bg-ui-hover-bg')}>
          <Plus size={14} aria-hidden /> Add order type &ldquo;{query.trim()}&rdquo;
        </button>
      )}
    </div>
  );
}

export function OrderTypePicker({ rect, current, options, onPick, onClear, onClose, onAdded }: {
  rect: DOMRect; current: string | null; options: string[]; onPick: (name: string) => void; onClear: () => void; onClose: () => void; onAdded: () => void;
}) {
  const [query, setQuery] = useState('');
  useDismiss(onClose);
  const anchor = useMemo(() => ({ getBoundingClientRect: () => rect }), [rect]);
  return (
    <Popover open onOpenChange={o => { if (!o) onClose(); }}>
      <PopoverContent data-board-popup backdrop aria-label="Order type" anchor={anchor} align="start" sideOffset={2}
        className={PANEL} style={{ width: Math.max(260, rect.width) }}>
        <div className="flex gap-1.5 border-b border-ui-divider p-2">
          <input autoFocus className={INPUT} placeholder="Select or type to filter..." aria-label="Order type" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)) (e.currentTarget.parentElement?.nextElementSibling as HTMLElement | null)?.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, bubbles: true })); }} />
          {current && <Button size="xs" variant="secondary" onClick={onClear}>Clear</Button>}
        </div>
        <OrderTypeList options={options} current={current} query={query} onPick={onPick} onAdded={onAdded} />
      </PopoverContent>
    </Popover>
  );
}

// ── Edit Item panel (TYPE cell) ─────────────────────────────────────────────────────────────
export interface PanelItem { id: string; pfCode: string | null; vendorId: string | null; orderType: string | null }

export function EditItemPanel({ point, type, items, vendors, orderTypes, canAdd, onSave, onAddItem, onClose, onVendorsChanged, onOrderTypesChanged }: {
  point: { x: number; y: number }; type: string; items: PanelItem[]; vendors: BoardVendor[]; orderTypes: string[]; canAdd: boolean;
  onSave: (id: string, patch: { vendor_id?: string | null; order_type?: string | null }) => Promise<void>;
  onAddItem: () => Promise<string | null>; onClose: () => void;
  onVendorsChanged: () => Promise<void> | void; onOrderTypesChanged: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const [draft, setDraft] = useState<{ vendorId: string | null; orderType: string | null } | null>(null);
  const [field, setField] = useState<'vendor' | 'orderType' | null>(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wantId, setWantId] = useState<string | null>(null);
  const item = items[Math.min(index, items.length - 1)];
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // After "Add Item" the board reloads; move to the new row once it is there.
  useEffect(() => {
    if (!wantId) return;
    const i = items.findIndex(it => it.id === wantId);
    if (i >= 0) { setIndex(i); setWantId(null); }
  }, [items, wantId]);

  const vendorId = draft ? draft.vendorId : item?.vendorId ?? null;
  const orderType = draft ? draft.orderType : item?.orderType ?? null;
  const dirty = !!draft && !!item && (draft.vendorId !== item.vendorId || (draft.orderType ?? null) !== (item.orderType ?? null));

  const flush = useCallback(async () => {
    if (!item || !draft) return;
    const patch: { vendor_id?: string | null; order_type?: string | null } = {};
    if (draft.vendorId !== item.vendorId) patch.vendor_id = draft.vendorId;
    if ((draft.orderType ?? null) !== (item.orderType ?? null)) patch.order_type = draft.orderType;
    if (!Object.keys(patch).length) { setDraft(null); return; }
    setError(null);
    try { await onSave(item.id, patch); setDraft(null); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); }
  }, [item, draft, onSave]);

  useEffect(() => {
    if (!auto || !dirty) return;
    timer.current = setTimeout(() => void flush(), 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [auto, dirty, flush]);

  const close = useCallback(() => {
    if (dirty && !auto && !window.confirm('You have unsaved changes. Are you sure you want to close?')) return;
    if (dirty && auto) void flush();
    onClose();
  }, [dirty, auto, flush, onClose]);

  async function go(delta: number) {
    if (dirty) await flush();
    setDraft(null); setField(null); setIndex(i => Math.max(0, Math.min(items.length - 1, i + delta)));
  }
  async function add() {
    if (dirty) await flush();
    const id = await onAddItem();
    if (id) { setDraft(null); setWantId(id); }
  }

  // Opens just below-right of the click point; flips / shifts to stay on screen.
  const anchor = useMemo(() => ({
    getBoundingClientRect: () => DOMRect.fromRect({ x: point.x + 8, y: point.y, width: 0, height: 0 }),
  }), [point.x, point.y]);
  if (!item) return null;
  const v = vendors.find(x => x.id === vendorId) ?? null;

  return (
    // Escape: ignored while a vendor / order-type list or Add Vendor is open (they handle it), like before.
    // Click outside: always closes (via close(), which flushes or asks about unsaved changes).
    <Popover open onOpenChange={(o, details) => {
      if (o) return;
      if (details.reason === 'escape-key' && (field || creating !== null)) return;
      if (creating !== null) return;
      close();
    }}>
      <PopoverContent data-board-popup backdrop aria-label={`Edit ${type} Item`} anchor={anchor} align="start" sideOffset={8}
        className={cn(PANEL, 'w-[360px] gap-3 p-4')}>
        <div className="flex items-center gap-2">
          <h3 className="m-0 flex-1 text-[15px] font-semibold text-[var(--color-secondary-700)] dark:text-ui-heading">
            Edit {type} Item{items.length > 1 && <span className="ml-1.5 text-[12px] font-normal text-ui-text-secondary">{index + 1} of {items.length}</span>}
          </h3>
          {canAdd && (
            <Button size="xs" variant="secondary" title="Add another item of the same type" className="border-[var(--color-success-normal,#16a34a)] text-[var(--color-success-dark,#15803d)]" onClick={() => void add()}>
              <Plus /> Add Item
            </Button>
          )}
          <button type="button" onClick={() => setAuto(a => !a)} aria-pressed={auto}
            className={cn('h-6 cursor-pointer rounded-[4px] border px-2 text-[11px] font-medium', auto ? 'border-[var(--color-secondary-700)] bg-ui-selected-bg text-[var(--color-secondary-700)]' : 'border-ui-divider bg-transparent text-ui-text-secondary')}>
            Auto: {auto ? 'ON' : 'OFF'}
          </button>
          {items.length > 1 && (
            <>
              <Button size="icon-xs" variant="ghost" aria-label="Previous item" disabled={index === 0} onClick={() => void go(-1)}><ChevronLeft /></Button>
              <Button size="icon-xs" variant="ghost" aria-label="Next item" disabled={index >= items.length - 1} onClick={() => void go(1)}><ChevronRight /></Button>
            </>
          )}
          <Button size="icon-xs" variant="ghost" aria-label="Close" onClick={close}><X /></Button>
        </div>
        {error && <p role="alert" className="m-0 rounded-[6px] bg-error-light px-3 py-2 text-[12px] text-error-dark">{error}</p>}
        {item.pfCode && (
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-ui-body">Current PF Code</span>
            <span className="rounded-[6px] bg-ui-surface px-2.5 py-1.5 font-mono text-[13px] text-ui-heading">{item.pfCode}</span>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-ui-body">Vendor</span>
          <input className={INPUT} placeholder="Search vendors..." aria-label="Vendor"
            value={field === 'vendor' ? query : (v ? vendorLabel(v) : '')}
            onFocus={() => { setField('vendor'); setQuery(''); }} onChange={e => setQuery(e.target.value)} />
          {field === 'vendor' && (
            <div className="rounded-[6px] border border-ui-divider">
              <VendorList vendors={vendors} current={vendorId} query={query} onVendorsChanged={() => void onVendorsChanged()} onCreate={setCreating}
                onPick={nv => { setDraft({ vendorId: nv.id, orderType }); setField(null); }} />
              <button type="button" onClick={() => setCreating('')} className={cn(OPTION, 'border-t border-ui-divider font-medium text-[var(--color-success-dark,#15803d)] hover:bg-ui-hover-bg')}>
                <Plus size={14} aria-hidden /> Add New Vendor
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-ui-body">Order Type</span>
          <input className={INPUT} placeholder="Search order types..." aria-label="Order type"
            value={field === 'orderType' ? query : (orderType ?? '')}
            onFocus={() => { setField('orderType'); setQuery(''); }} onChange={e => setQuery(e.target.value)} />
          {field === 'orderType' && (
            <div className="rounded-[6px] border border-ui-divider">
              <OrderTypeList options={orderTypes} current={orderType} query={query} onAdded={onOrderTypesChanged}
                onPick={name => { setDraft({ vendorId, orderType: name }); setField(null); }} />
            </div>
          )}
        </div>
        {dirty && (auto
          ? <p className="m-0 flex items-center gap-1.5 text-[11px] text-ui-text-secondary"><span className="size-1.5 animate-pulse rounded-full bg-[var(--color-info-normal)]" aria-hidden />Changes will be auto-saved in 300ms...</p>
          : <Button size="sm" onClick={() => void flush()}>Save changes</Button>)}
        {vendorId && <p className="m-0 text-[11px] text-ui-text-secondary">PF code will be automatically generated when you save</p>}
        {creating !== null && (
          <AddVendorForm initialName={creating} onClose={() => setCreating(null)}
            onCreated={async nv => { setCreating(null); await onVendorsChanged(); setDraft({ vendorId: nv.id, orderType }); setField(null); }} />
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Row right-click menu ────────────────────────────────────────────────────────────────────
export function RowMenu({ point, title, onDelete, onClose }: { point: { x: number; y: number }; title: string; onDelete: () => void; onClose: () => void }) {
  // Still closes on page scroll / resize: it's pinned to the click point, not to the row.
  useDismiss(onClose);
  // Shared Menu anchored at the right-click point (no trigger button).
  const anchor = useMemo(() => ({
    getBoundingClientRect: () => DOMRect.fromRect({ x: point.x, y: point.y, width: 0, height: 0 }),
  }), [point.x, point.y]);
  return (
    <Menu open onOpenChange={open => { if (!open) onClose(); }}>
      <MenuContent data-board-popup backdrop onBackdropContextMenu={onClose} anchor={anchor} side="bottom" align="start" sideOffset={0} className="min-w-[180px]">
        <MenuGroup>
          <MenuGroupLabel>{title}</MenuGroupLabel>
          <MenuItem variant="destructive" onClick={onDelete}>
            <Trash2 aria-hidden /> Delete Row
          </MenuItem>
        </MenuGroup>
      </MenuContent>
    </Menu>
  );
}
