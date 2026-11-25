'use client';

import Image from 'next/image';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { CheckCircle2, ExternalLink, ImagePlus, Loader2, MapPin, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COMPUTER_CATEGORIES, IT_FILE_MAX_BYTES, IT_IMAGE_TYPES, IT_LOCATIONS, SPEC_KEYS, SPEC_LABEL } from '@/lib/it/constants';
import { CATEGORY_LABEL } from '@/components/platform/it/itemStyles';
import type { PublicItem } from '@/lib/it/publicItem';

// The QR label page (/item/<id>): a full-page form, no app shell, made for a phone. The item's photo,
// what it is and who holds it, then the fields anyone with the label may fill in (name, type, office,
// a phone's number, a computer's specs, notes) and Save. Saved through /api/public/it-items/<id>.

const STRONG = 'text-secondary-700 dark:text-secondary-50';
const LABEL = 'mb-1.5 block text-[12px] font-medium tracking-[0.36px] text-ui-body';
const INPUT = cn(
  'h-12 w-full min-w-0 rounded-[8px] border border-[var(--ui-input-border)] bg-ui-surface-elevated px-3 text-[16px] font-medium outline-none',
  'placeholder:font-normal placeholder:text-primary-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring dark:placeholder:text-primary-300',
  STRONG,
);
const STATUS: Record<PublicItem['status'], string> = { available: 'Available', repair: 'In repair', assigned: 'Assigned' };

function Field({ id, label, children, hint }: { id: string; label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <label htmlFor={id} className={LABEL}>{label}</label>
      {children}
      {hint && <span className="mt-1 text-[12px] text-ui-text-secondary">{hint}</span>}
    </div>
  );
}

async function errorOf(res: Response) {
  const j = await res.json().catch(() => null) as { error?: string } | null;
  return j?.error ?? `Something went wrong (${res.status})`;
}

export function PublicItemForm({ item, signedIn }: { item: PublicItem; signedIn: boolean }) {
  const [f, setF] = useState({
    name: item.name, model: item.model ?? '', location: item.location ?? '', notes: item.notes ?? '',
    phoneNumber: item.phoneNumber ?? '', specs: { ...item.specs } as Record<string, string>,
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(item.imageUrl);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const computer = COMPUTER_CATEGORIES.includes(item.category);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF(p => ({ ...p, [k]: v })); setMessage(null); };

  useEffect(() => {
    if (!photo) { setPreview(null); return; }
    const u = URL.createObjectURL(photo);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) { setMessage({ ok: false, text: 'Enter the item name' }); return; }
    if (photo && (!IT_IMAGE_TYPES[photo.type] || photo.size > IT_FILE_MAX_BYTES)) { setMessage({ ok: false, text: 'The photo must be a JPG, PNG or WebP under 4 MB' }); return; }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/public/it-items/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, ...(item.category === 'phone' ? {} : { phoneNumber: undefined }) }),
      });
      if (!res.ok) throw new Error(await errorOf(res));
      if (photo) {
        const fd = new FormData();
        fd.append('file', photo);
        const up = await fetch(`/api/public/it-items/${item.id}/image`, { method: 'POST', body: fd });
        if (!up.ok) throw new Error(`Saved, but the photo failed: ${await errorOf(up)}`);
        const { url } = await up.json() as { url: string };
        setImageUrl(url);
        setPhoto(null);
      }
      setMessage({ ok: true, text: 'Saved. Thank you!' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not save' });
    } finally {
      setSaving(false);
    }
  }

  const shown = preview ?? imageUrl;
  return (
    <main className="min-h-dvh bg-ui-page-bg px-4 py-6 font-ui sm:py-10">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand logo */}
          <img src="/logo.png" alt="Trust Lines" className="h-9 w-auto dark:invert" />
          {signedIn && (
            <a href={`/it/items/${item.id}`} className={cn('inline-flex items-center gap-1.5 rounded-md border border-ui-divider px-3 py-2 text-[13px] font-semibold no-underline hover:bg-ui-hover-bg', STRONG)}>
              Open in T-ERP <ExternalLink size={14} aria-hidden />
            </a>
          )}
        </header>

        <form onSubmit={save} className="flex flex-col gap-5 rounded-[16px] border border-ui-divider bg-ui-surface-elevated p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-1">
            <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.6px] text-ui-text-secondary">IT item · {CATEGORY_LABEL[item.category]}</p>
            <h1 className={cn('m-0 text-[26px] font-semibold leading-[1.25]', STRONG)}>{item.name}</h1>
          </div>

          <label
            htmlFor="pi-photo"
            className="relative flex h-[220px] cursor-pointer items-center justify-center overflow-hidden rounded-[12px] border border-dashed border-primary-200 bg-primary-50 hover:bg-ui-hover-bg dark:border-primary-500 dark:bg-primary-700"
          >
            {shown && <Image src={shown} alt="" fill unoptimized sizes="640px" className="object-contain p-3" />}
            <span className={cn('relative flex items-center gap-2 rounded-md bg-white/85 px-3 py-2 text-[13px] font-semibold dark:bg-secondary-800/85', STRONG)}>
              <ImagePlus size={18} aria-hidden /> {photo ? 'Photo chosen — Save to keep it' : shown ? 'Replace photo' : 'Add a photo'}
            </span>
            <input id="pi-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
              onChange={e => { setPhoto(e.target.files?.[0] ?? null); setMessage(null); }} />
          </label>

          <div className="flex flex-wrap gap-2 text-[13px] font-semibold">
            <span className={cn('inline-flex items-center gap-1.5 rounded-md bg-primary-50 px-2.5 py-1.5 dark:bg-primary-700', STRONG)}>
              <UserRound size={14} aria-hidden /> {item.holderName ?? STATUS[item.status]}
            </span>
            {item.location && (
              <span className={cn('inline-flex items-center gap-1.5 rounded-md bg-primary-50 px-2.5 py-1.5 dark:bg-primary-700', STRONG)}>
                <MapPin size={14} aria-hidden /> {item.location}
              </span>
            )}
            {item.setLabel && <span className={cn('rounded-md bg-primary-50 px-2.5 py-1.5 dark:bg-primary-700', STRONG)}>Set: {item.setLabel}</span>}
          </div>

          <div className="flex flex-col gap-4 border-t border-dashed border-ui-divider pt-5">
            <Field id="pi-name" label="Item name">
              <input id="pi-name" required maxLength={120} className={INPUT} value={f.name} onChange={e => set('name', e.target.value)} placeholder="Samsung A18" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="pi-model" label="Type / model">
                <input id="pi-model" maxLength={120} className={INPUT} value={f.model} onChange={e => set('model', e.target.value)} placeholder="High Performance" />
              </Field>
              <Field id="pi-loc" label="Office">
                <select id="pi-loc" className={cn(INPUT, 'appearance-auto')} value={f.location} onChange={e => set('location', e.target.value)}>
                  <option value="">—</option>
                  {IT_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>
            </div>
            {item.category === 'phone' && (
              <Field id="pi-phone" label="Phone number" hint="The SIM's number in this phone">
                <input id="pi-phone" maxLength={40} inputMode="tel" className={INPUT} value={f.phoneNumber} onChange={e => set('phoneNumber', e.target.value)} placeholder="+1 (475) 309-0034" />
              </Field>
            )}
            {computer && (
              <div className="grid grid-cols-2 gap-4">
                {SPEC_KEYS.map(k => (
                  <Field key={k} id={`pi-${k}`} label={SPEC_LABEL[k]}>
                    <input id={`pi-${k}`} maxLength={120} className={INPUT} value={f.specs[k] ?? ''} onChange={e => set('specs', { ...f.specs, [k]: e.target.value })}
                      placeholder={k === 'cpu' ? 'i7-13700K' : k === 'gpu' ? 'RTX 4070 Ti' : k === 'ram' ? '64 GB' : '2 TB'} />
                  </Field>
                ))}
              </div>
            )}
            <Field id="pi-notes" label="Notes">
              <textarea id="pi-notes" maxLength={2000} rows={3} className={cn(INPUT, 'h-auto min-h-[96px] resize-y py-2.5')} value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Anything IT should know" />
            </Field>
          </div>

          {message && (
            <p role={message.ok ? 'status' : 'alert'}
              className={cn('m-0 flex items-center gap-2 rounded-md px-3 py-2.5 text-[14px] font-medium',
                message.ok ? 'bg-[var(--status-t9-bg)] text-[var(--status-t9-fg)]' : 'bg-[var(--status-t10-bg)] text-[var(--status-t10-fg)]')}>
              {message.ok && <CheckCircle2 size={18} aria-hidden />}{message.text}
            </p>
          )}

          <button type="submit" disabled={saving}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-secondary-700 text-[16px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-secondary-50 dark:text-primary-950">
            {saving && <Loader2 size={18} className="animate-spin" aria-hidden />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>

        <p className="m-0 text-center text-[12px] text-ui-text-secondary">Trust Lines IT · changes made here are recorded.</p>
      </div>
    </main>
  );
}
