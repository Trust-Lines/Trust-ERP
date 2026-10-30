'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, FileText, Plus, Search, SwatchBook, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmModal, Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { normalizeHex } from '@/lib/design/libraryPaths';
import { openFetchedLink, uploadViaLink } from '@/lib/client/designUpload';
import { HEADING, formatBytes } from '../designShared';
import { LibraryHeader, NotReady } from './LibraryShell';

export interface BrandKit {
  id: string; name: string; prospect_id: string | null; prospect_name: string | null;
  colors: { name: string; hex: string }[]; fonts: string[]; guidelines: string | null;
  created_by: string | null; updated_at: string;
}
const API = '/api/design/brands';

export function BrandKitsClient() {
  const [kits, setKits] = useState<BrandKit[] | null>(null);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [me, setMe] = useState(''); const [isManager, setIsManager] = useState(false);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(API).catch(() => null);
    const b = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { toast.error(b.error ?? 'Could not load brand kits'); setKits([]); return; }
    setNotReady(b.notReady ?? null); setKits(b.kits ?? []); setMe(b.me ?? ''); setIsManager(!!b.isManager);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (kits ?? []).filter(k => !s || `${k.name} ${k.prospect_name ?? ''} ${k.fonts.join(' ')}`.toLowerCase().includes(s));
  }, [kits, q]);
  const open = kits?.find(k => k.id === openId) ?? null;

  return (
    <div className="flex w-full flex-col gap-[30px] pb-12">
      <LibraryHeader crumb="Design / Brand Kits" title="Brand Kits"
        subtitle="Each customer brand in one place — logo files, colour codes, fonts and the rules. A kit linked to a customer shows up on that customer's design jobs."
        action={<Button onClick={() => setCreating(true)} disabled={!!notReady}><Plus /> New brand kit</Button>} />
      {notReady && <NotReady message={notReady} />}

      <div className="relative w-[285px] max-w-full">
        <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
        <input type="search" aria-label="Search brand kits" placeholder="Search brand, customer, font…" value={q} onChange={e => setQ(e.target.value)}
          className="h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring" />
      </div>

      {kits === null ? <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p> : visible.length === 0 ? (
        <div className="rounded-[8px] bg-ui-surface p-5">
          <EmptyState icon={<SwatchBook />} title={kits.length ? 'No matching brand kits' : 'No brand kits yet'}
            description={kits.length ? 'Try another search.' : 'Create one per customer brand: logo, colours, fonts, guidelines.'} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map(k => (
            <button key={k.id} type="button" onClick={() => setOpenId(k.id)}
              className="flex flex-col gap-3 rounded-[8px] border-0 bg-ui-surface p-4 text-left transition-colors hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring">
              <div className="flex h-10 overflow-hidden rounded-[6px]">
                {k.colors.length ? k.colors.slice(0, 8).map(c => <span key={c.hex + c.name} className="flex-1" style={{ background: c.hex }} />) : <span className="flex-1 bg-ui-surface-elevated" />}
              </div>
              <div>
                <h3 className={cn('m-0 text-[14px] font-semibold', HEADING)}>{k.name}</h3>
                <p className="m-0 text-[12px] text-ui-text-secondary">{k.prospect_name ?? 'Not linked to a customer'}{k.fonts.length ? ` · ${k.fonts.slice(0, 2).join(', ')}` : ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {creating && <KitEditor onClose={() => setCreating(false)} onSaved={k => { setCreating(false); void load(); setOpenId(k.id); }} />}
      {open && <KitDetail kit={open} editable={isManager || open.created_by === me} onClose={() => setOpenId(null)} onChanged={() => void load()} />}
    </div>
  );
}

/** Read-only colour swatches with copy-to-clipboard — also used on the design job panel. */
export function BrandSwatches({ colors }: { colors: { name: string; hex: string }[] }) {
  if (!colors.length) return <p className="m-0 text-[12px] text-ui-text-secondary">No colours yet.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map(c => (
        <button key={c.hex + c.name} type="button" title="Copy hex"
          onClick={() => { navigator.clipboard.writeText(c.hex).then(() => toast.success(`${c.hex} copied`), () => toast.message(c.hex)); }}
          className="flex items-center gap-2 rounded-[6px] border border-ui-divider bg-ui-surface-elevated py-1 pl-1 pr-2.5 text-left hover:bg-ui-hover-bg">
          <span aria-hidden className="size-7 rounded-[4px] border border-ui-divider" style={{ background: c.hex }} />
          <span className="flex flex-col leading-tight"><span className={cn('text-[12px] font-medium', HEADING)}>{c.name}</span><span className="font-mono text-[11px] text-ui-text-secondary">{c.hex}</span></span>
        </button>
      ))}
    </div>
  );
}

function KitDetail({ kit, editable, onClose, onChanged }: { kit: BrandKit; editable: boolean; onClose: () => void; onChanged: () => void }) {
  const [files, setFiles] = useState<{ name: string; path: string; size: number }[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    const res = await fetch(`${API}/${kit.id}`).catch(() => null);
    const b = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) toast.error(b.error ?? 'Could not load the files');
    setFiles(b.files ?? []);
  }, [kit.id]);
  useEffect(() => { void loadFiles(); }, [loadFiles]);

  async function upload(list: File[]) {
    if (!list.length) return;
    setUploading(true);
    for (const f of list) {
      try { await uploadViaLink(`${API}/${kit.id}`, f); } catch (e) { toast.error(e instanceof Error ? e.message : `Could not upload ${f.name}`); }
    }
    setUploading(false);
    void loadFiles();
  }

  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent size="lg" title={kit.name} description={kit.prospect_name ? `Customer: ${kit.prospect_name}` : 'Not linked to a customer'}
        footer={editable ? <>
          <Button variant="ghost" onClick={() => setRemoving(true)}><Trash2 /> Remove</Button>
          <Button variant="secondary" className={modalSecondaryButtonClass} onClick={() => setEditing(true)}>Edit</Button>
        </> : undefined}>
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2"><h3 className={cn('m-0 text-[13px] font-semibold', HEADING)}>Colours</h3><BrandSwatches colors={kit.colors} /></section>
          <section className="flex flex-col gap-2">
            <h3 className={cn('m-0 text-[13px] font-semibold', HEADING)}>Fonts</h3>
            {kit.fonts.length ? <div className="flex flex-wrap gap-2">{kit.fonts.map(f => <span key={f} className="rounded-[4px] bg-ui-surface px-2 py-1 text-[13px]" style={{ fontFamily: `"${f}", inherit` }}>{f}</span>)}</div>
              : <p className="m-0 text-[12px] text-ui-text-secondary">No fonts yet.</p>}
          </section>
          {kit.guidelines && <section className="flex flex-col gap-2"><h3 className={cn('m-0 text-[13px] font-semibold', HEADING)}>Guidelines</h3><p className="m-0 whitespace-pre-wrap text-[13px]">{kit.guidelines}</p></section>}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className={cn('m-0 text-[13px] font-semibold', HEADING)}>Files</h3>
              {editable && <Button variant="outline" size="sm" loading={uploading} onClick={() => inputRef.current?.click()}><Upload /> Upload</Button>}
              <input ref={inputRef} type="file" multiple hidden onChange={e => { const l = [...(e.target.files ?? [])]; e.target.value = ''; void upload(l); }} />
            </div>
            {files === null ? <p className="m-0 text-[12px] text-ui-text-secondary">Loading…</p> : files.length === 0 ? (
              <p className="m-0 text-[12px] text-ui-text-secondary">No files — add the logo (AI/SVG/PNG), the guideline PDF and font files.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col divide-y divide-ui-divider rounded-[6px] bg-ui-surface p-0">
                {files.map(f => (
                  <li key={f.path}>
                    <button type="button" className="flex w-full items-center gap-3 border-0 bg-transparent px-3 py-2 text-left hover:bg-ui-hover-bg"
                      onClick={() => void openFetchedLink(async () => {
                        const res = await fetch(`${API}/${kit.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open', path: f.path }) });
                        const b = await res.json().catch(() => ({})); if (!res.ok) { toast.error(b.error ?? 'Could not open'); return null; } return b.link;
                      })}>
                      <FileText size={15} aria-hidden className="text-ui-text-secondary" />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{f.name}</span>
                      <span className="text-[11px] text-ui-text-secondary">{formatBytes(f.size)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </ModalContent>
      {editing && <KitEditor kit={kit} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }} />}
      <ConfirmModal open={removing} onOpenChange={setRemoving} tone="destructive" title={`Remove “${kit.name}”?`}
        description="The kit leaves the list; its Dropbox folder and files are kept." confirmLabel="Remove"
        onConfirm={async () => {
          const res = await fetch(`${API}/${kit.id}`, { method: 'DELETE' }); const b = await res.json().catch(() => ({}));
          if (!res.ok) { toast.error(b.error ?? 'Could not remove'); return; }
          toast.success('Brand kit removed'); onClose(); onChanged();
        }} />
    </Modal>
  );
}

function KitEditor({ kit, onClose, onSaved }: { kit?: BrandKit; onClose: () => void; onSaved: (k: { id: string }) => void }) {
  const [name, setName] = useState(kit?.name ?? '');
  const [prospect, setProspect] = useState<{ value: string; label: string } | null>(kit?.prospect_id ? { value: kit.prospect_id, label: kit.prospect_name ?? 'Customer' } : null);
  const [options, setOptions] = useState<{ value: string; label: string }[]>(prospect ? [prospect] : []);
  const [colors, setColors] = useState(kit?.colors ?? []);
  const [newHex, setNewHex] = useState(''); const [newName, setNewName] = useState('');
  const [fonts, setFonts] = useState((kit?.fonts ?? []).join(', '));
  const [guidelines, setGuidelines] = useState(kit?.guidelines ?? '');
  const [saving, setSaving] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function searchProspects(text: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      if (text.trim().length < 2) return;
      const res = await fetch(`${API}?prospects=${encodeURIComponent(text.trim())}`).catch(() => null);
      const b = res ? await res.json().catch(() => ({})) : {};
      setOptions(((b.prospects ?? []) as { id: string; display_name: string; brand_name: string | null }[])
        .map(p => ({ value: p.id, label: p.brand_name && p.brand_name !== p.display_name ? `${p.display_name} · ${p.brand_name}` : p.display_name })));
    }, 250);
  }

  function addColor() {
    const hex = normalizeHex(newHex);
    if (!hex) { toast.error('Use a hex code like #0A2540'); return; }
    setColors(c => [...c, { name: newName.trim() || hex, hex }]); setNewHex(''); setNewName('');
  }

  async function save() {
    if (!name.trim()) { toast.error('Name the brand kit'); return; }
    setSaving(true);
    try {
      const body = { name, prospect_id: prospect?.value ?? null, colors, fonts, guidelines };
      const res = await fetch(kit ? `${API}/${kit.id}` : API, { method: kit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not save'); return; }
      toast.success(kit ? 'Brand kit saved' : 'Brand kit created — add the logo files'); onSaved(b.kit);
    } finally { setSaving(false); }
  }

  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent size="lg" title={kit ? `Edit ${kit.name}` : 'New brand kit'}
        footer={<><ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose><Button loading={saving} onClick={() => void save()}>Save</Button></>}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[12px] font-medium">Brand name<Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Stores" /></label>
          <div className="flex flex-col gap-1 text-[12px] font-medium">Customer
            <Combobox aria-label="Customer" placeholder="Type to search customers…" emptyText="Type at least 2 letters"
              options={options} value={prospect} onValueChange={o => setProspect(o)} onInputValueChange={searchProspects} />
          </div>
          <div className="flex flex-col gap-1.5 text-[12px] font-medium">Colours
            <div className="flex flex-wrap gap-2">
              {colors.map((c, i) => (
                <span key={i} className="flex items-center gap-1.5 rounded-[6px] border border-ui-divider py-0.5 pl-0.5 pr-1 text-[12px] font-normal">
                  <span className="size-5 rounded-[4px]" style={{ background: c.hex }} />{c.name}
                  <button type="button" aria-label={`Remove ${c.name}`} className="grid size-5 place-items-center border-0 bg-transparent text-ui-text-secondary" onClick={() => setColors(cs => cs.filter((_, j) => j !== i))}><X size={12} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="color" aria-label="Pick a colour" value={normalizeHex(newHex) ?? '#000000'} onChange={e => setNewHex(e.target.value)} className="h-8 w-10 cursor-pointer rounded-[4px] border border-ui-divider bg-transparent p-0.5" />
              <Input value={newHex} onChange={e => setNewHex(e.target.value)} placeholder="#0A2540" className="w-[110px]" />
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name (Primary, Accent…)" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addColor(); } }} />
              <Button variant="outline" size="sm" onClick={addColor}><Plus /> Add</Button>
            </div>
          </div>
          <label className="flex flex-col gap-1 text-[12px] font-medium">Fonts<Input value={fonts} onChange={e => setFonts(e.target.value)} placeholder="e.g. Inter, Playfair Display" /></label>
          <label className="flex flex-col gap-1 text-[12px] font-medium">Guidelines
            <Textarea rows={4} value={guidelines} onChange={e => setGuidelines(e.target.value)} placeholder="Logo clear space, what not to do, signage rules…" />
          </label>
          <p className="m-0 flex items-center gap-1.5 text-[11px] text-ui-text-secondary"><Copy size={12} aria-hidden /> Logo and guideline files are added after saving, from the kit.</p>
        </div>
      </ModalContent>
    </Modal>
  );
}
