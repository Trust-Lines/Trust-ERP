'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Link2, Lock, QrCode, ScanLine, Search, X } from 'lucide-react';
import { Modal, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CATEGORY_LABEL, MUTED, SOLID_CHIP, STRONG, type ItItemCategory } from './itemStyles';
import {
  MAX_GROUP_ITEMS,
  MAX_SET_LABEL,
  PENDING_GROUP_KEY,
  nextSetName,
  parsePendingGroup,
  type PendingGroup,
} from '@/lib/it/groups';

// Grouping IT items into sets ("PC 1") from an item page. edit.it only, and locked behind the IT
// group password: the server checks it and remembers the unlock for 30 minutes (httpOnly cookie).
//   • Add to Set — name the set and tick other items from the library.
//   • Scan QR to add — start a group here, then scan other items' QR labels with this phone: each
//     item page that opens offers "Add to <set>". The pending group lives in this browser only.

const PRIMARY_BTN =
  'inline-flex h-10 items-center justify-center gap-2 rounded-md bg-secondary-700 px-6 text-[13px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-secondary-50 dark:text-primary-950';

type GroupResult = { ok: true; data: Record<string, unknown> } | { ok: false; locked: boolean; error: string };

export async function groupRequest(method: 'GET' | 'POST' | 'DELETE', body?: unknown): Promise<GroupResult> {
  try {
    const res = await fetch('/api/it/items/group', {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (res.ok) return { ok: true, data };
    return { ok: false, locked: res.status === 423, error: typeof data.error === 'string' ? data.error : `Request failed (${res.status})` };
  } catch {
    return { ok: false, locked: false, error: 'Network error. Try again.' };
  }
}

export function readPendingGroup(): PendingGroup | null {
  try { return parsePendingGroup(window.localStorage.getItem(PENDING_GROUP_KEY)); } catch { return null; }
}

export function writePendingGroup(p: PendingGroup | null) {
  try {
    if (p) window.localStorage.setItem(PENDING_GROUP_KEY, JSON.stringify(p));
    else window.localStorage.removeItem(PENDING_GROUP_KEY);
  } catch { /* the scan flow needs storage; without it Add to Set still works */ }
  window.dispatchEvent(new Event('it-pending-group'));
}

/** Password prompt that unlocks grouping on the server. */
export function GroupPasswordDialog({ onUnlocked, onClose }: { onUnlocked: () => void; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/it/items/group/unlock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      });
      const j = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) { setError(j?.error ?? 'Could not unlock'); setPassword(''); return; }
      toast.success('Grouping unlocked for 30 minutes');
      onUnlocked();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <ModalContent size="sm" title="Grouping is locked" description="Enter the IT group password to group items.">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-[7px]">
            <span className="text-[12px] font-medium leading-4 text-ui-body">Password</span>
            <Input
              type="password" autoFocus autoComplete="off" inputMode="numeric" value={password}
              onChange={e => setPassword(e.target.value)} aria-invalid={!!error || undefined}
            />
          </label>
          {error && <p role="alert" className="m-0 text-[13px] text-[var(--status-t10-fg)]">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" className={modalSecondaryButtonClass} onClick={onClose} disabled={busy}>Cancel</Button>
            <button type="submit" className={PRIMARY_BTN} disabled={!password || busy}>
              <Lock size={16} aria-hidden /> {busy ? 'Checking…' : 'Unlock'}
            </button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}

interface Candidate { id: string; name: string; category: string; setLabel: string | null; location: string | null }

/** Add to Set: set name + other items to put in it, or start "scan QR to add". */
export function AddToSetDialog({ item, onClose, onDone, onLocked }: {
  item: { id: string; name: string; setLabel: string | null };
  onClose: () => void;
  onDone: () => void;
  /** The unlock ran out: ask for the password again. */
  onLocked: () => void;
}) {
  const [items, setItems] = useState<Candidate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [label, setLabel] = useState(item.setLabel ?? '');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void groupRequest('GET').then(r => {
      if (!alive) return;
      if (r.ok) {
        const list = (r.data.items ?? []) as Candidate[];
        setItems(list);
        if (!item.setLabel) setLabel(l => l || nextSetName(list.map(i => i.setLabel)));
      } else if (r.locked) onLocked();
      else setLoadError(r.error);
    });
    return () => { alive = false; };
  }, [item.setLabel, onLocked]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? [])
      .filter(i => i.id !== item.id && !(item.setLabel && i.setLabel === item.setLabel))
      .filter(i => !q || `${i.name} ${i.setLabel ?? ''} ${i.location ?? ''}`.toLowerCase().includes(q));
  }, [items, item.id, item.setLabel, query]);

  const renaming = !!item.setLabel && label.trim() !== '' && label.trim() !== item.setLabel;
  const canSave = !busy && label.trim().length > 0 && (picked.size > 0 || renaming || !item.setLabel);

  function toggle(id: string, on: boolean) {
    setPicked(prev => {
      const next = new Set(prev);
      if (on) { if (next.size >= MAX_GROUP_ITEMS) { toast.error(`At most ${MAX_GROUP_ITEMS} items at a time`); return prev; } next.add(id); }
      else next.delete(id);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    const r = await groupRequest('POST', { anchorId: item.id, itemIds: [...picked], setLabel: label });
    setBusy(false);
    if (!r.ok) { if (r.locked) onLocked(); else toast.error(r.error); return; }
    toast.success(picked.size ? `${picked.size + 1} items in ${String(r.data.setLabel)}` : `Set is now ${String(r.data.setLabel)}`);
    onDone();
  }

  function startScan() {
    const name = label.trim();
    if (!name) { toast.error('Name the set first'); return; }
    writePendingGroup({ anchorId: item.id, anchorName: item.name, setLabel: name, startedAt: Date.now() });
    toast.success(`Scan the other items' QR labels with this phone to add them to ${name}`);
    onClose();
  }

  return (
    <Modal open onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <ModalContent
        size="lg"
        title="Add to Set"
        description={`Items in the same set are grouped together, e.g. a PC with its monitor and keyboard.`}
        footer={
          <>
            <Button variant="secondary" className={modalSecondaryButtonClass} onClick={onClose} disabled={busy}>Cancel</Button>
            <button type="button" className={PRIMARY_BTN} disabled={!canSave} onClick={() => void save()}>
              <Link2 size={16} aria-hidden />
              {busy ? 'Saving…' : picked.size ? `Group ${picked.size + 1} items` : item.setLabel ? 'Rename set' : 'Create set'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="flex flex-col gap-[7px]">
              <span className="text-[12px] font-medium leading-4 text-ui-body">Set name</span>
              <Input value={label} maxLength={MAX_SET_LABEL} onChange={e => setLabel(e.target.value)} placeholder="PC 1" />
            </label>
            <button
              type="button" onClick={startScan}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--ui-input-border)] px-4 text-[13px] font-medium text-ui-heading hover:bg-ui-hover-bg"
            >
              <ScanLine size={16} aria-hidden /> Scan QR to add
            </button>
          </div>
          {renaming && (
            <p className={cn('m-0 text-[12px]', MUTED)}>Every item in {item.setLabel} moves to the new name.</p>
          )}

          <label className="relative flex items-center">
            <Search className={cn('pointer-events-none absolute left-3 h-4 w-4', MUTED)} strokeWidth={1.5} aria-hidden="true" />
            <span className="sr-only">Search items</span>
            <input
              type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search items to add…"
              className="h-9 w-full rounded-md border border-[var(--ui-input-border)] bg-ui-input-bg pl-9 pr-3 text-[13px] text-ui-heading outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
            />
          </label>

          <ul className="m-0 flex max-h-[340px] list-none flex-col gap-1 overflow-y-auto rounded-md border border-ui-divider p-1" aria-busy={items === null}>
            {loadError ? (
              <li role="alert" className="px-3 py-6 text-center text-[13px] text-[var(--status-t10-fg)]">{loadError}</li>
            ) : items === null ? (
              <li className={cn('px-3 py-6 text-center text-[13px]', MUTED)}>Loading items…</li>
            ) : shown.length === 0 ? (
              <li className={cn('px-3 py-6 text-center text-[13px]', MUTED)}>{query ? 'No items match.' : 'No other items to add.'}</li>
            ) : shown.map(i => (
              <li key={i.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-ui-hover-bg">
                  <Checkbox checked={picked.has(i.id)} onCheckedChange={v => toggle(i.id, !!v)} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn('truncate text-[13px] font-semibold', STRONG)}>{i.name}</span>
                    <span className={cn('truncate text-[12px]', MUTED)}>
                      {[CATEGORY_LABEL[i.category as ItItemCategory] ?? i.category, i.location].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {i.setLabel && (
                    <span className={cn('flex h-6 shrink-0 items-center gap-1 rounded px-2 text-[11px] font-semibold', SOLID_CHIP)} title={`Moves out of ${i.setLabel}`}>
                      {i.setLabel} <Link2 className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
          {[...picked].some(id => items?.find(i => i.id === id)?.setLabel) && (
            <p className={cn('m-0 text-[12px]', MUTED)}>Items already in another set move to this one.</p>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}

/**
 * "Scan to group" banner on an item page while a pending group exists in this browser: on the item
 * that started it, how to go on; on any other item, "Add to <set>".
 */
export function PendingGroupBanner({ item, canEdit, onAdd }: {
  item: { id: string; name: string; setLabel: string | null };
  canEdit: boolean;
  /** Adds this item to the pending set (handles the password). */
  onAdd: (p: PendingGroup) => Promise<boolean>;
}) {
  const [pending, setPending] = useState<PendingGroup | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = () => setPending(readPendingGroup());
    sync();
    window.addEventListener('it-pending-group', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('it-pending-group', sync); window.removeEventListener('storage', sync); };
  }, []);

  if (!pending || !canEdit) return null;
  const isAnchor = pending.anchorId === item.id;
  const inSet = item.setLabel === pending.setLabel;

  async function add() {
    if (!pending) return;
    setBusy(true);
    try { await onAdd(pending); } finally { setBusy(false); }
  }

  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-solid border-secondary-700 bg-ui-selected-bg px-4 py-3 dark:border-secondary-50">
      <QrCode className={cn('h-5 w-5 shrink-0', STRONG)} strokeWidth={1.75} aria-hidden="true" />
      <p className={cn('m-0 min-w-0 flex-1 text-[13px] leading-[1.45]', STRONG)}>
        {isAnchor || inSet
          ? <>Grouping into <b>{pending.setLabel}</b>. Scan the next item&apos;s QR label with this phone to add it.</>
          : <>Add <b>{item.name}</b> to <b>{pending.setLabel}</b> with {pending.anchorName}?{item.setLabel && <> It leaves {item.setLabel}.</>}</>}
      </p>
      {!isAnchor && !inSet && (
        <button type="button" className={cn(PRIMARY_BTN, 'h-9 px-4')} disabled={busy} onClick={() => void add()}>
          <Link2 size={15} aria-hidden /> {busy ? 'Adding…' : `Add to ${pending.setLabel}`}
        </button>
      )}
      <button
        type="button" onClick={() => writePendingGroup(null)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--ui-input-border)] px-3 text-[13px] font-medium text-ui-heading hover:bg-ui-hover-bg"
      >
        <X size={15} aria-hidden /> Finish
      </button>
    </div>
  );
}
