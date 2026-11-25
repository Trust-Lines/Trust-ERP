'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, type ComponentType, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  Copy,
  Cpu,
  Ellipsis,
  Unlink,
  Gpu,
  HardDrive,
  ImagePlus,
  Link2,
  MapPin,
  MemoryStick,
  Pencil,
  Phone,
  Plus,
  Printer,
  QrCode,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/modal';
import { MonitorPcIcon } from './MonitorPcIcon';
import { formatTicketDate } from './ticketStyles';
import type { ItItemFormValues } from './ItItemFormDialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FORM_FIELD, FORM_TEXTAREA, LABEL } from './itFormParts';
import {
  COMPUTER_CATEGORIES, ITEM_CATEGORIES, IT_FILE_MAX_BYTES, IT_IMAGE_TYPES, IT_LOCATIONS, SPEC_KEYS, SPEC_LABEL,
  type ItemCategory, type ItemStatus, type SpecKey,
} from '@/lib/it/constants';
import { useItemQr } from './itemQr';
import { LabelSheetDialog } from './LabelSheetDialog';
import { AddToSetDialog, GroupPasswordDialog, PendingGroupBanner, groupRequest, readPendingGroup } from './ItemGrouping';
import type { PendingGroup } from '@/lib/it/groups';
import { AssignmentHistory, type AssignmentSpellView } from './AssignmentHistory';
import {
  CATEGORY_CHIP,
  CATEGORY_LABEL,
  MUTED,
  OUTLINE_CHIP,
  SOLID_CHIP,
  STRONG,
  formatItemDate,
  type ItItem,
} from './itemStyles';

// Figma "Item detail" (880:14431): Back, title with its set chip, Delete / Edit Info; Basic Info,
// Specifications and the items it is grouped with on the left; who holds it and its QR label on the
// right. Grouping (Add to Set, scan QR to add, remove from set) is edit.it plus the IT group
// password — see ItemGrouping. "Edit Info" edits Basic Info and Specifications in place (no pop-up);
// a phone's number links its line in Phone Numbers, and each page links to the other.

export type ItItemSpecKey = 'cpu' | 'gpu' | 'ram' | 'storage';

export interface ItItemDetailData extends ItItem {
  /** ISO date of the last change ("Last Update"). */
  updatedAt: string | null;
  notes: string | null;
  specs: { key: ItItemSpecKey | string; label: string; value: string }[];
  assignee: { name: string; role: string | null; acquiredAt: string | null } | null;
  /** Other items in the same set ("Grouped With"). */
  groupedWith: ItItem[];
  /** Raw values for the Edit form. */
  form: { assigneeId: string | null; remoteAddress: string | null; specs: Record<string, string> };
}

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

const SPEC_ICON: Record<ItItemSpecKey | SpecKey, IconType> = { cpu: Cpu, gpu: Gpu, ram: MemoryStick, storage: HardDrive };
const STATUS_LABEL: Record<ItemStatus, string> = { available: 'Available', repair: 'Repair', assigned: 'Assigned to a person' };
const CATEGORY_OPTIONS = ITEM_CATEGORIES.map(c => ({ value: c, label: CATEGORY_LABEL[c] }));
const LOCATION_OPTIONS = [{ value: '', label: '—' }, ...IT_LOCATIONS.map(l => ({ value: l, label: l }))];
const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as ItemStatus[]).map(s => ({ value: s, label: STATUS_LABEL[s] }));

async function errorOf(res: Response) {
  const j = await res.json().catch(() => null) as { error?: string } | null;
  return j?.error ?? `Request failed (${res.status})`;
}

// Panels: primary-50 / primary-700 ("main surfaces"); value boxes white / secondary-800 ("elevated").
const PANEL = 'rounded-lg border border-solid border-primary-100 bg-primary-50 dark:border-primary-600 dark:bg-primary-700';
const PANEL_TITLE = cn('m-0 text-[18px] font-semibold leading-normal', STRONG);
const BOX = cn(
  'flex min-h-[42px] min-w-0 items-center gap-1.5 rounded-md border border-solid border-primary-100 bg-white p-3 text-[14px] leading-[1.4] dark:border-transparent dark:bg-secondary-800',
  STRONG,
);
const DISABLED = 'disabled:cursor-not-allowed disabled:opacity-60';

function Placeholder({ children }: { children: ReactNode }) {
  return <span className="text-primary-300 dark:text-primary-400">{children}</span>;
}

function Field({ label, icon: Icon, children, action }: { label: string; icon?: IconType; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[7px]">
      <span className="text-[12px] font-medium leading-4 text-ui-body">{label}</span>
      <div className={BOX}>
        {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
        <span className="min-w-0 flex-1 truncate">{children}</span>
        {action}
      </div>
    </div>
  );
}

/** A field being edited in place: label + control (+ hint). */
function EditField({ id, label, required, hint, children }: { id: string; label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <label htmlFor={id} className={LABEL}>{label}{required && <span className="text-error-normal" aria-hidden>*</span>}</label>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ui-text-secondary">{hint}</span>}
    </div>
  );
}

function ItemImage({ src, iconSize }: { src: string | null; iconSize: string }) {
  return src ? (
    <Image src={src} alt="" fill unoptimized sizes="240px" className="object-contain p-3" />
  ) : (
    <MonitorPcIcon className={cn(iconSize, 'text-primary-300')} strokeWidth={1.25} />
  );
}

function GroupedCard({ item, onRemove }: { item: ItItem; onRemove?: (item: ItItem) => void }) {
  return (
    <article className="relative flex flex-col overflow-hidden rounded-lg border border-solid border-primary-100 bg-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ui-focus-ring dark:border-primary-600 dark:bg-primary-950">
      <div className="relative flex h-[151px] items-center justify-center bg-white">
        <ItemImage src={item.imageUrl} iconSize="h-10 w-10" />
      </div>
      <div className="flex min-h-[84px] flex-col justify-between gap-2 border-t border-solid border-primary-100 bg-primary-50 px-2.5 py-2 dark:border-primary-600 dark:bg-primary-700">
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col leading-normal">
            <Link
              href={`/it/items/${encodeURIComponent(item.id)}`}
              className={cn('truncate text-[16px] font-semibold no-underline outline-none after:absolute after:inset-0 after:content-[""]', STRONG)}
            >
              {item.name}
            </Link>
            <span className={cn('text-[13px] tracking-[0.39px]', MUTED)}>{formatItemDate(item.addedAt)}</span>
          </div>
          {onRemove ? (
            <button
              type="button" onClick={() => onRemove(item)} aria-label={`Remove ${item.name} from the set`} title="Remove from set"
              className={cn('relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-ui-focus-ring dark:hover:bg-primary-600', STRONG)}
            >
              <Unlink className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </button>
          ) : (
            <Ellipsis className={cn('h-[18px] w-[18px] shrink-0', STRONG)} strokeWidth={2} aria-hidden="true" />
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            {item.setLabel && (
              <span className={cn('flex h-[23px] items-center gap-1 rounded pl-[13px] pr-2 text-[10px] font-semibold whitespace-nowrap', SOLID_CHIP)}>
                {item.setLabel}
                <Link2 className="h-[9px] w-[9px]" strokeWidth={2.5} aria-hidden="true" />
              </span>
            )}
            <span className={cn('flex h-[23px] items-center rounded px-2 text-[10px] font-semibold whitespace-nowrap', SOLID_CHIP)}>
              {CATEGORY_CHIP[item.category]}
            </span>
          </div>
          {item.status === 'assigned' && item.assigneeName ? (
            <span className={cn('flex h-[23px] max-w-[120px] items-center rounded px-3 text-[10px] font-semibold', OUTLINE_CHIP)}>
              <span className="truncate">{item.assigneeName}</span>
            </span>
          ) : (
            <span
              className="flex h-[23px] items-center rounded px-3 text-[10px] font-semibold"
              style={item.status === 'repair'
                ? { background: 'var(--status-t10-fg)', color: 'var(--status-t10-bg)' }
                : { background: 'var(--status-t9-fg)', color: 'var(--status-t9-bg)' }}
            >
              {item.status === 'repair' ? 'Repair' : 'Available'}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function ItItemDetailClient({ item, canEdit = false, assignees = [], startEditing = false, groupUnlocked = false, history = [], phoneLine = null }: {
  item: ItItemDetailData | null;
  /** edit.it: Delete, Edit Info, Add to Set, Access Computer. */
  canEdit?: boolean;
  assignees?: { id: string; name: string }[];
  /** Opened from a card's "Edit Info" (?edit=1). */
  startEditing?: boolean;
  /** The IT group password was entered in the last 30 minutes (server cookie). */
  groupUnlocked?: boolean;
  /** Who held the item (newest first). */
  history?: AssignmentSpellView[];
  /** A phone's line in Phone Numbers (migration 163). */
  phoneLine?: { id: string; number: string; carrier: string | null } | null;
}) {
  const router = useRouter();
  const { url: itemUrl, qr } = useItemQr(item?.id ?? null);
  const [editing, setEditing] = useState(startEditing && canEdit && !!item);
  const [deleting, setDeleting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [unlocked, setUnlocked] = useState(groupUnlocked);
  const [afterUnlock, setAfterUnlock] = useState<(() => void) | null>(null);
  const [addingSet, setAddingSet] = useState(false);

  // Scanned while grouping: show the "Add to set" banner instead of popping the blank-item form.
  useEffect(() => {
    const p = readPendingGroup();
    if (p && item && p.anchorId !== item.id) setEditing(false);
  }, [item]);

  /** Runs `then` now when grouping is unlocked, otherwise after the password. */
  function withUnlock(then: () => void) {
    if (unlocked) then();
    else setAfterUnlock(() => then);
  }
  function relock(then: () => void) {
    setUnlocked(false);
    setAfterUnlock(() => then);
  }

  async function addPending(p: PendingGroup): Promise<boolean> {
    if (!item) return false;
    const run = async () => {
      const r = await groupRequest('POST', { anchorId: p.anchorId, itemIds: [item.id], setLabel: p.setLabel });
      if (!r.ok) {
        if (r.locked) relock(() => void run());
        else toast.error(r.error);
        return false;
      }
      toast.success(`${item.name} added to ${p.setLabel}`);
      router.refresh();
      return true;
    };
    if (!unlocked) { withUnlock(() => void run()); return false; }
    return run();
  }

  function removeFromSet(g: ItItem) {
    const run = async () => {
      const r = await groupRequest('DELETE', { itemId: g.id });
      if (!r.ok) { if (r.locked) relock(() => void run()); else toast.error(r.error); return; }
      toast.success(`${g.name} removed from ${g.setLabel ?? 'the set'}`);
      router.refresh();
    };
    withUnlock(() => void run());
  }

  const formValues: ItItemFormValues | null = item ? {
    id: item.id, name: item.name, model: item.model ?? '', category: item.category, location: item.location ?? '',
    status: item.status, assigneeId: item.form.assigneeId ?? '', setLabel: item.setLabel ?? '', notes: item.notes ?? '',
    specs: item.form.specs, remoteAddress: item.form.remoteAddress ?? '', phoneNumber: phoneLine?.number ?? '',
  } : null;
  const [draft, setDraft] = useState<ItItemFormValues>(() => formValues ?? ({} as ItItemFormValues));
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ItItemFormValues>(k: K, v: ItItemFormValues[K]) => setDraft(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!photo) { setPreview(null); return; }
    const u = URL.createObjectURL(photo);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  function startEdit() {
    if (!formValues) return;
    setDraft(formValues);
    setPhoto(null);
    setEditing(true);
  }
  function cancelEdit() {
    setEditing(false);
    setPhoto(null);
    if (startEditing) router.replace(`/it/items/${item!.id}`);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!item || !editing) return;
    if (draft.status === 'assigned' && !draft.assigneeId) { toast.error('Choose who holds this item'); return; }
    if (photo && (!IT_IMAGE_TYPES[photo.type] || photo.size > IT_FILE_MAX_BYTES)) { toast.error('The photo must be a JPG, PNG or WebP under 4 MB'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/it/items/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, name: draft.name.trim(), assigneeId: draft.status === 'assigned' ? draft.assigneeId : null }),
      });
      if (!res.ok) throw new Error(await errorOf(res));
      if (photo) {
        const fd = new FormData();
        fd.append('file', photo);
        const up = await fetch(`/api/it/items/${item.id}/image`, { method: 'POST', body: fd });
        if (!up.ok) toast.error(`Saved, but the photo failed: ${await errorOf(up)}`);
      }
      toast.success('Item updated');
      setEditing(false);
      router.replace(`/it/items/${item.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the item');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item) return;
    const res = await fetch(`/api/it/items/${item.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => null) as { error?: string } | null;
      toast.error(j?.error ?? 'Could not delete the item');
      throw new Error('delete failed');
    }
    toast.success(`${item.name} deleted`);
    router.push('/it/items');
    router.refresh();
  }

  function copyId() {
    if (!item) return;
    navigator.clipboard?.writeText(item.id)
      .then(() => toast.success('Item ID copied'))
      .catch(() => toast.error('Could not copy the item ID'));
  }

  return (
    <div className="flex w-full flex-col gap-6 p-7 font-ui lg:px-12 lg:py-10">
      {/* Heading */}
      <div className="flex flex-col gap-4">
        <Link
          href="/it/items"
          className={cn('flex h-[26px] items-center gap-1.5 self-start rounded-md px-3 text-[13px] font-semibold no-underline hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring', OUTLINE_CHIP)}
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Back
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-[5px]">
            <div className="flex flex-wrap items-center gap-4">
              <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', STRONG)}>
                {item?.name ?? <Placeholder>Item</Placeholder>}
              </h1>
              {item?.setLabel && (
                <span className={cn('flex h-7 items-center gap-1 rounded-md pl-[13px] pr-2 text-[13px] font-semibold whitespace-nowrap', SOLID_CHIP)}>
                  {item.setLabel}
                  <Link2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                </span>
              )}
            </div>
            <p className="m-0 text-[13px] leading-[1.35] text-ui-body">
              {item ? [item.model, formatItemDate(item.addedAt)].filter(Boolean).join(' · ') : '—'}
            </p>
          </div>
          {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button" onClick={cancelEdit} disabled={saving}
              className={cn('flex h-10 items-center gap-2 rounded-md pl-3.5 pr-5 text-[13px] font-medium hover:opacity-80', OUTLINE_CHIP, DISABLED)}
            >
              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Cancel
            </button>
            <button
              type="submit" form="it-item-edit" disabled={saving}
              className={cn('flex h-10 items-center gap-2 rounded-md pl-3.5 pr-5 text-[13px] font-medium', SOLID_CHIP, DISABLED)}
            >
              <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          ) : (
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && item?.form.remoteAddress && (
              <a
                href={`/api/it/items/${item.id}/rdp`}
                download
                title={`Remote Desktop to ${item.form.remoteAddress}`}
                className="flex h-10 items-center gap-2 rounded-md bg-accent-400 pl-3.5 pr-5 text-[13px] font-semibold text-white no-underline hover:opacity-90 dark:text-primary-950"
              >
                <MonitorPcIcon className="h-4 w-4" strokeWidth={2} />
                Access Computer
              </a>
            )}
            <button
              type="button"
              disabled={!canEdit || !item}
              onClick={() => setDeleting(true)}
              title={canEdit ? undefined : 'Your role cannot change IT items'}
              className={cn('flex h-10 items-center gap-2 rounded-md border border-solid pl-3.5 pr-5 text-[13px] font-medium', DISABLED)}
              style={{ background: 'var(--status-t10-bg)', borderColor: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Delete
            </button>
            <button
              type="button"
              disabled={!canEdit || !item}
              onClick={startEdit}
              title={canEdit ? undefined : 'Your role cannot change IT items'}
              className={cn('flex h-10 items-center gap-2 rounded-md pl-3.5 pr-5 text-[13px] font-medium', SOLID_CHIP, DISABLED)}
            >
              <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Edit Info
            </button>
          </div>
          )}
        </div>
      </div>

      {item && (
        <PendingGroupBanner item={{ id: item.id, name: item.name, setLabel: item.setLabel }} canEdit={canEdit} onAdd={addPending} />
      )}

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Basic Info + Specifications — read, or edited in place ("Edit Info") */}
          <form id="it-item-edit" onSubmit={save} className="flex flex-col gap-6" aria-label={editing ? 'Edit item' : undefined}>
          <section aria-labelledby="it-item-basic" className={cn('flex flex-col gap-4 px-5 pb-8 pt-4', PANEL)}>
            <h2 id="it-item-basic" className={PANEL_TITLE}>Basic Info</h2>
            <div className="flex flex-col gap-4 md:flex-row">
              {editing ? (
                <label
                  htmlFor="iti-photo"
                  className="relative flex h-[233px] w-full shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-primary-200 bg-white hover:bg-ui-hover-bg md:w-[233px] dark:border-primary-500 dark:bg-secondary-800"
                >
                  {preview || item?.imageUrl ? (
                    <Image src={preview ?? item!.imageUrl!} alt="" fill unoptimized sizes="240px" className="object-contain p-3 opacity-60" />
                  ) : null}
                  <span className={cn('relative flex flex-col items-center gap-1.5 rounded-md bg-white/80 px-3 py-2 text-[12px] font-medium dark:bg-secondary-800/80', STRONG)}>
                    <ImagePlus size={28} strokeWidth={1.5} aria-hidden />
                    {photo ? 'Photo chosen' : item?.imageUrl ? 'Replace photo' : 'Add a photo'}
                  </span>
                  <input id="iti-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => setPhoto(e.target.files?.[0] ?? null)} />
                </label>
              ) : (
                <div className="relative flex h-[233px] w-full shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-solid border-primary-100 bg-white md:w-[233px] dark:border-primary-600">
                  <ItemImage src={item?.imageUrl ?? null} iconSize="h-14 w-14" />
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-[182px_minmax(0,1fr)_minmax(120px,160px)_168px]">
                  {editing ? (
                    <EditField id="iti-name" label="Item Name" required>
                      <Input id="iti-name" required maxLength={120} autoFocus className={FORM_FIELD} value={draft.name} onChange={e => set('name', e.target.value)} />
                    </EditField>
                  ) : (
                    <Field label="Item Name">{item?.name ?? <Placeholder>—</Placeholder>}</Field>
                  )}
                  <Field
                    label="Item ID"
                    action={
                      <button
                        type="button"
                        onClick={copyId}
                        disabled={!item}
                        aria-label="Copy item ID"
                        className={cn('grid h-[23px] w-[23px] shrink-0 place-items-center rounded hover:opacity-80 focus-visible:outline-2 focus-visible:outline-ui-focus-ring', DISABLED)}
                      >
                        <Copy className="h-[19px] w-[19px]" strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    }
                  >
                    {item?.id ?? <Placeholder>—</Placeholder>}
                  </Field>
                  {editing ? (
                    <>
                      <EditField id="iti-cat" label="Category" required>
                        <Select id="iti-cat" className={FORM_FIELD} value={draft.category} options={CATEGORY_OPTIONS} onValueChange={v => { if (v) set('category', v as ItemCategory); }} />
                      </EditField>
                      <EditField id="iti-model" label="Type">
                        <Input id="iti-model" maxLength={120} className={FORM_FIELD} value={draft.model} onChange={e => set('model', e.target.value)} placeholder="High Performance" />
                      </EditField>
                    </>
                  ) : (
                    <>
                      <Field label="Category">{item ? CATEGORY_LABEL[item.category] : <Placeholder>—</Placeholder>}</Field>
                      <Field label="Type">{item?.model ?? <Placeholder>—</Placeholder>}</Field>
                    </>
                  )}
                </div>
                {editing ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <EditField id="iti-loc" label="Location">
                      <Select id="iti-loc" className={FORM_FIELD} value={draft.location} options={LOCATION_OPTIONS} onValueChange={v => set('location', v ?? '')} />
                    </EditField>
                    <EditField id="iti-status" label="Status">
                      <Select id="iti-status" className={FORM_FIELD} value={draft.status} options={STATUS_OPTIONS} onValueChange={v => { if (v) set('status', v as ItemStatus); }} />
                    </EditField>
                    {draft.status === 'assigned' ? (
                      <EditField id="iti-holder" label="Held by" required>
                        <Select id="iti-holder" className={FORM_FIELD} value={draft.assigneeId} placeholder="Choose a person…"
                          options={assignees.map(a => ({ value: a.id, label: a.name }))} onValueChange={v => set('assigneeId', v ?? '')} />
                      </EditField>
                    ) : <div className="hidden xl:block" />}
                    <EditField id="iti-set" label="Set">
                      <Input id="iti-set" maxLength={40} className={FORM_FIELD} value={draft.setLabel} onChange={e => set('setLabel', e.target.value)} placeholder="PC 1" title="Items with the same set name are grouped together" />
                    </EditField>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="Location" icon={MapPin}>{item?.location ?? <Placeholder>—</Placeholder>}</Field>
                    <Field label="Added Date" icon={CalendarPlus}>{formatTicketDate(item?.addedAt ?? null)}</Field>
                    <Field label="Last Update" icon={CalendarClock}>{formatTicketDate(item?.updatedAt ?? null)}</Field>
                  </div>
                )}
                {(editing ? draft.category === 'phone' : item?.category === 'phone') && (
                  editing ? (
                    <EditField id="iti-phone" label="Phone Number" hint={phoneLine ? 'The line in Phone Numbers. Clear it to take the line off this phone.' : 'Adds the line to Phone Numbers (or links the line with this number). Fill in its carrier and SIM details there.'}>
                      <Input id="iti-phone" maxLength={40} inputMode="tel" className={FORM_FIELD} value={draft.phoneNumber} onChange={e => set('phoneNumber', e.target.value)} placeholder="+1 (475) 309-0034" />
                    </EditField>
                  ) : (
                    <Field
                      label="Phone Number" icon={Phone}
                      action={phoneLine ? (
                        <Link href={`/it/phones/${phoneLine.id}`} className={cn('inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold no-underline hover:underline', STRONG)}>
                          Open in Phone Numbers <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      ) : undefined}
                    >
                      {phoneLine ? [phoneLine.number, phoneLine.carrier].filter(Boolean).join(' · ') : <Placeholder>No number yet — add it with Edit Info</Placeholder>}
                    </Field>
                  )
                )}
                {editing ? (
                  <EditField id="iti-notes" label="Notes">
                    <Textarea id="iti-notes" maxLength={2000} rows={2} className={FORM_TEXTAREA} value={draft.notes} onChange={e => set('notes', e.target.value)} />
                  </EditField>
                ) : (
                  <>
                    {item?.form.remoteAddress && <Field label="Remote address" icon={MonitorPcIcon}>{item.form.remoteAddress}</Field>}
                    <Field label="Notes">{item?.notes || <Placeholder>No notes</Placeholder>}</Field>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Specifications */}
          {(!editing || COMPUTER_CATEGORIES.includes(draft.category)) && (
          <section aria-labelledby="it-item-specs" className={cn('flex flex-col gap-4 px-5 pb-8 pt-4', PANEL)}>
            <h2 id="it-item-specs" className={PANEL_TITLE}>Specifications</h2>
            {editing ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {SPEC_KEYS.map(k => {
                    const Icon = SPEC_ICON[k];
                    return (
                      <label key={k} htmlFor={`iti-${k}`} className="flex h-16 items-end gap-2.5 rounded-lg border border-solid border-primary-100 bg-white py-3 pl-3.5 pr-4 dark:border-transparent dark:bg-secondary-800">
                        <Icon className="h-[31px] w-[31px] shrink-0 text-accent-400" strokeWidth={1.5} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className={cn('text-[12px] font-medium uppercase leading-4 tracking-[-0.26px]', MUTED)}>{SPEC_LABEL[k]}</span>
                          <input id={`iti-${k}`} maxLength={120} value={draft.specs[k] ?? ''} onChange={e => set('specs', { ...draft.specs, [k]: e.target.value })}
                            placeholder={k === 'cpu' ? 'i7-13700K' : k === 'gpu' ? 'RTX 4070 Ti' : k === 'ram' ? '64 GB' : '2 TB'}
                            className={cn('w-full min-w-0 border-0 bg-transparent p-0 text-[18px] font-semibold leading-5 outline-none placeholder:font-normal placeholder:text-primary-300', STRONG)} />
                        </span>
                      </label>
                    );
                  })}
                </div>
                <EditField id="iti-remote" label="Remote address" hint="Computer name or IP for Remote Desktop: the LAN name in Istanbul, the Tailscale name / IP for the other offices.">
                  <Input id="iti-remote" maxLength={253} className={FORM_FIELD} value={draft.remoteAddress} onChange={e => set('remoteAddress', e.target.value)}
                    placeholder="pc-ahmet or 100.64.0.12" spellCheck={false} autoCapitalize="off" />
                </EditField>
              </>
            ) : item && item.specs.length > 0 ? (
              <dl className="m-0 flex flex-wrap gap-4">
                {item.specs.map(spec => {
                  const Icon = SPEC_ICON[spec.key as ItItemSpecKey] ?? Cpu;
                  return (
                    <div
                      key={spec.key}
                      className="flex h-16 w-[252px] max-w-full items-end gap-2.5 rounded-lg border border-solid border-primary-100 bg-white py-3.5 pl-3.5 pr-4 dark:border-primary-600 dark:bg-secondary-800"
                    >
                      <Icon className="h-[31px] w-[31px] shrink-0 text-accent-400" strokeWidth={1.5} />
                      <div className="flex min-w-0 flex-col gap-0.5 pl-0.5">
                        <dt className={cn('text-[12px] font-medium uppercase leading-4 tracking-[-0.26px]', MUTED)}>{spec.label}</dt>
                        <dd className={cn('m-0 truncate text-[20px] font-semibold leading-4 tracking-[0.4px]', STRONG)}>{spec.value}</dd>
                      </div>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="m-0 text-[13px] text-ui-body">No specifications recorded.</p>
            )}
          </section>
          )}
          </form>

          {/* Grouped With */}
          <section aria-labelledby="it-item-group" className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <h2 id="it-item-group" className={PANEL_TITLE}>Grouped With</h2>
              <button
                type="button"
                disabled={!canEdit || !item}
                onClick={() => withUnlock(() => setAddingSet(true))}
                title={canEdit ? 'Group this item with others (password required)' : 'Your role cannot change IT items'}
                className={cn('flex items-center gap-1 rounded-md bg-accent-400 py-1.5 pl-2.5 pr-3.5 text-[13px] font-semibold text-white dark:text-primary-950', DISABLED)}
              >
                <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Add to Set
              </button>
            </div>
            {item && item.groupedWith.length > 0 ? (
              <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 2xl:grid-cols-3">
                {item.groupedWith.map(g => (
                  <li key={g.id}>
                    <GroupedCard item={g} onRemove={canEdit ? removeFromSet : undefined} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 rounded-lg border border-dashed border-primary-300 px-4 py-10 text-center text-[13px] text-ui-body dark:border-primary-600">
                Not grouped with other items.
              </p>
            )}
          </section>

          <AssignmentHistory spells={history} />
        </div>

        {/* Right column: who holds it, QR label */}
        <aside className="flex w-full shrink-0 flex-col gap-6 xl:w-[366px]">
          <div
            className="flex items-center gap-2 rounded-[10px] border border-solid border-primary-600 p-3 text-secondary-50"
            style={{ backgroundImage: 'radial-gradient(circle at 22% 54%, rgba(31,37,45,0.2) 0%, rgba(120,136,161,0.2) 60%, transparent 61%), linear-gradient(90deg, #2b3d55 0%, #2b3d55 100%)' }}
          >
            <span className="grid size-[78px] shrink-0 place-items-center rounded-lg bg-primary-950 text-[24px] font-semibold" aria-hidden="true">
              {(item?.assignee?.name ?? '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 self-stretch p-1">
              <div className="flex flex-col">
                <p className="m-0 truncate text-[24px] font-semibold leading-normal">
                  {item?.assignee?.name ?? (item?.status === 'repair' ? 'In repair' : 'Not assigned')}
                </p>
                <p className="m-0 text-[12px] font-medium leading-[1.35]">{item?.assignee?.role ?? (item ? 'Available' : '—')}</p>
              </div>
              {item?.assignee && (
                <p className="m-0 text-[11px] leading-[1.35]">
                  Acquired at: <span className="font-medium">{formatTicketDate(item.assignee.acquiredAt)}</span>
                </p>
              )}
            </div>
          </div>

          <div className={cn('flex flex-col items-center justify-between gap-6 px-5 py-8', PANEL)}>
            <div className="grid place-items-center rounded-[11px] bg-white p-2.5 dark:bg-secondary-800">
              {qr ? (
                <Image src={qr} alt={item ? `QR code for ${item.name}` : ''} width={223} height={223} unoptimized className="size-[223px]" />
              ) : (
                <div className="grid size-[223px] place-items-center text-primary-300">
                  <QrCode className="h-16 w-16" strokeWidth={1.25} aria-hidden="true" />
                </div>
              )}
            </div>
            <div className={cn(BOX, 'w-full break-all')}>
              <span className="min-w-0">{itemUrl ?? <Placeholder>The item link appears once the item loads</Placeholder>}</span>
            </div>
            <button
              type="button"
              disabled={!item || !qr || !itemUrl}
              onClick={() => setPrinting(true)}
              className={cn('flex items-center gap-[7px] rounded-md py-2.5 pl-6 pr-8 text-[13px] font-medium hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring', SOLID_CHIP, DISABLED)}
            >
              <Printer className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Print
            </button>
          </div>
        </aside>
      </div>

      {afterUnlock && (
        <GroupPasswordDialog
          onClose={() => setAfterUnlock(null)}
          onUnlocked={() => { const next = afterUnlock; setUnlocked(true); setAfterUnlock(null); next(); }}
        />
      )}
      {addingSet && item && (
        <AddToSetDialog
          item={{ id: item.id, name: item.name, setLabel: item.setLabel }}
          onClose={() => setAddingSet(false)}
          onDone={() => { setAddingSet(false); router.refresh(); }}
          onLocked={() => { setAddingSet(false); relock(() => setAddingSet(true)); }}
        />
      )}
      {printing && item && (
        <LabelSheetDialog
          items={[{ id: item.id, name: item.name, detail: [CATEGORY_LABEL[item.category], item.setLabel, item.location].filter(Boolean).join(' · ') }]}
          onClose={() => setPrinting(false)}
        />
      )}
      <ConfirmModal
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete item?"
        description={item ? `${item.name} is removed from the Items Library.` : undefined}
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={remove}
      />
    </div>
  );
}
