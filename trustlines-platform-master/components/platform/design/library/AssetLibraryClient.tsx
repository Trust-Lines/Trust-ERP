'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Library, Pencil, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmModal, Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { formatDate } from '@/lib/formatDate';
import { cn } from '@/lib/utils';
import { ASSET_KINDS } from '@/lib/design/libraryPaths';
import { openFetchedLink, uploadViaLink } from '@/lib/client/designUpload';
import { HEADING, formatBytes } from '../designShared';
import { LibraryHeader, NotReady } from './LibraryShell';

interface Asset {
  id: string; kind: string; title: string; description: string | null; tags: string[];
  file_name: string; size_bytes: number | null; created_by: string | null; created_by_name: string | null; created_at: string;
}
const API = '/api/design/assets';
const kindLabel = (k: string) => ASSET_KINDS.find(x => x.value === k)?.label ?? 'Other';

export function AssetLibraryClient() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [me, setMe] = useState(''); const [isManager, setIsManager] = useState(false);
  const [kind, setKind] = useState('');
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [removing, setRemoving] = useState<Asset | null>(null);

  async function load() {
    const res = await fetch(API).catch(() => null);
    const b = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { toast.error(b.error ?? 'Could not load the library'); setAssets([]); return; }
    setNotReady(b.notReady ?? null); setAssets(b.assets ?? []); setMe(b.me ?? ''); setIsManager(!!b.isManager);
  }
  useEffect(() => { void load(); }, []);

  const allTags = useMemo(() => [...new Set((assets ?? []).flatMap(a => a.tags))].sort(), [assets]);
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (assets ?? []).filter(a => (!kind || a.kind === kind) && (!tag || a.tags.includes(tag))
      && (!s || `${a.title} ${a.description ?? ''} ${a.file_name} ${a.tags.join(' ')}`.toLowerCase().includes(s)));
  }, [assets, kind, tag, q]);

  async function remove(a: Asset) {
    const res = await fetch(`${API}/${a.id}`, { method: 'DELETE' }).catch(() => null);
    const b = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { toast.error(b.error ?? 'Could not remove'); return; }
    setAssets(p => (p ?? []).filter(x => x.id !== a.id));
    toast.success('Removed from the library — the Dropbox file is kept');
  }

  return (
    <div className="flex w-full flex-col gap-[30px] pb-12">
      <LibraryHeader crumb="Design / Asset Library" title="Asset Library"
        subtitle="Templates, CAD blocks, render setups and standard details the whole team reuses. Files live in Dropbox under /Design/Library."
        action={<Button onClick={() => setUploadOpen(true)} disabled={!!notReady}><Upload /> Upload assets</Button>} />
      {notReady && <NotReady message={notReady} />}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-[285px] max-w-full">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
          <input type="search" aria-label="Search assets" placeholder="Search title, tag, file…" value={q} onChange={e => setQ(e.target.value)}
            className="h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring" />
        </div>
        {[{ value: '', label: 'All' }, ...ASSET_KINDS].map(k => {
          const n = k.value ? (assets ?? []).filter(a => a.kind === k.value).length : (assets ?? []).length;
          return (
            <button key={k.value} type="button" aria-pressed={kind === k.value} onClick={() => setKind(k.value)}
              className="h-9 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] text-ui-body hover:bg-ui-hover-bg aria-pressed:border-[var(--color-secondary-700)] aria-pressed:bg-ui-selected-bg aria-pressed:font-semibold dark:aria-pressed:border-ui-heading">
              {k.label} · {n}
            </button>
          );
        })}
        {allTags.length > 0 && (
          <Select aria-label="Tag" className="h-9 w-[160px]" value={tag} onValueChange={v => setTag(v ?? '')}
            options={[{ value: '', label: 'All tags' }, ...allTags.map(t => ({ value: t, label: `#${t}` }))]} />
        )}
      </div>

      {assets === null ? <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p> : visible.length === 0 ? (
        <div className="rounded-[8px] bg-ui-surface p-5">
          <EmptyState icon={<Library />} title={assets.length ? 'No matching assets' : 'The library is empty'}
            description={assets.length ? 'Try another search, type or tag.' : 'Upload the templates and blocks you use on every project.'}
            action={!assets.length && !notReady ? <Button size="sm" onClick={() => setUploadOpen(true)}><Upload /> Upload assets</Button> : undefined} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map(a => {
            const editable = isManager || a.created_by === me;
            return (
              <article key={a.id} className="flex flex-col gap-2.5 rounded-[8px] bg-ui-surface p-4">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[6px] bg-ui-surface-elevated text-ui-text-secondary"><FileText size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className={cn('m-0 truncate text-[14px] font-semibold', HEADING)} title={a.title}>{a.title}</h3>
                    <p className="m-0 truncate text-[11px] text-ui-text-secondary" title={a.file_name}>{kindLabel(a.kind)} · {a.file_name} {a.size_bytes ? `· ${formatBytes(a.size_bytes)}` : ''}</p>
                  </div>
                </div>
                {a.description && <p className="m-0 line-clamp-2 text-[12px] text-ui-body">{a.description}</p>}
                {a.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {a.tags.map(t => <button key={t} type="button" onClick={() => setTag(t)} className="rounded-[4px] border-0 bg-[var(--status-t0-bg)] px-1.5 py-0.5 text-[11px] text-[var(--status-t0-fg)]">#{t}</button>)}
                  </div>
                )}
                <div className="mt-auto flex items-center gap-1 pt-1">
                  <span className="flex-1 truncate text-[11px] text-ui-text-secondary">{a.created_by_name ?? '—'} · {formatDate(a.created_at)}</span>
                  {editable && <Button variant="ghost" size="icon-sm" aria-label={`Edit ${a.title}`} onClick={() => setEditing(a)}><Pencil /></Button>}
                  {editable && <Button variant="ghost" size="icon-sm" aria-label={`Remove ${a.title}`} onClick={() => setRemoving(a)}><Trash2 /></Button>}
                  <Button variant="outline" size="sm" onClick={() => void openFetchedLink(async () => {
                    const res = await fetch(`${API}/${a.id}`, { method: 'POST' }); const b = await res.json().catch(() => ({}));
                    if (!res.ok) { toast.error(b.error ?? 'Could not open'); return null; } return b.link;
                  })}><Download /> Open</Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <UploadAssets open={uploadOpen} onOpenChange={setUploadOpen} defaultKind={kind || 'template'} onDone={() => void load()} />
      {editing && <EditAsset asset={editing} onClose={() => setEditing(null)} onSaved={a => setAssets(p => (p ?? []).map(x => (x.id === a.id ? { ...x, ...a } : x)))} />}
      <ConfirmModal open={!!removing} onOpenChange={o => { if (!o) setRemoving(null); }} tone="destructive"
        title={`Remove “${removing?.title}”?`} description="It leaves the library. The file itself stays in Dropbox." confirmLabel="Remove"
        onConfirm={async () => { if (removing) await remove(removing); setRemoving(null); }} />
    </div>
  );
}

function UploadAssets({ open, onOpenChange, defaultKind, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; defaultKind: string; onDone: () => void }) {
  const [kind, setKind] = useState(defaultKind);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setKind(defaultKind); setFiles([]); setTitle(''); setTags(''); setDescription(''); } }, [open, defaultKind]);

  async function submit() {
    if (!files.length) return;
    let ok = 0;
    for (const [i, f] of files.entries()) {
      setBusy(`Uploading ${i + 1} of ${files.length}…`);
      try {
        const path = await uploadViaLink(API, f, { kind });
        const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          action: 'create', kind, path, tags, description,
          title: files.length === 1 && title.trim() ? title.trim() : f.name.replace(/\.[^.]+$/, ''),
        }) });
        const b = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(b.error ?? `Could not add ${f.name}`);
        ok += 1;
      } catch (e) { toast.error(e instanceof Error ? e.message : `Could not upload ${f.name}`); }
    }
    setBusy(null);
    if (ok) { toast.success(`${ok} asset${ok === 1 ? '' : 's'} added`); onDone(); onOpenChange(false); }
  }

  return (
    <Modal open={open} onOpenChange={o => { if (!busy) onOpenChange(o); }}>
      <ModalContent title="Upload assets" description="Files go straight to Dropbox (/Design/Library) — big CAD and render files are fine."
        footer={<><ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />} disabled={!!busy}>Cancel</ModalClose><Button loading={!!busy} disabled={!files.length} onClick={() => void submit()}>{busy ?? 'Upload'}</Button></>}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[12px] font-medium">Type
            <Select aria-label="Type" value={kind} onValueChange={v => setKind(v ?? 'template')} options={ASSET_KINDS.map(k => ({ value: k.value, label: k.label }))} />
          </label>
          <div className="flex flex-col gap-1 text-[12px] font-medium">Files
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}><Upload /> Choose files</Button>
              <span className="truncate text-[12px] font-normal text-ui-text-secondary">{files.length ? files.map(f => f.name).join(', ') : 'Nothing chosen'}</span>
            </div>
            <input ref={inputRef} type="file" multiple hidden onChange={e => { setFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
          </div>
          {files.length <= 1 && (
            <label className="flex flex-col gap-1 text-[12px] font-medium">Title
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={files[0]?.name.replace(/\.[^.]+$/, '') ?? 'Defaults to the file name'} />
            </label>
          )}
          <label className="flex flex-col gap-1 text-[12px] font-medium">Tags
            <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. millwork, counter, retail" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium">Description
            <Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="When to use it, which version…" />
          </label>
        </div>
      </ModalContent>
    </Modal>
  );
}

function EditAsset({ asset, onClose, onSaved }: { asset: Asset; onClose: () => void; onSaved: (a: Asset) => void }) {
  const [title, setTitle] = useState(asset.title);
  const [kind, setKind] = useState(asset.kind);
  const [tags, setTags] = useState(asset.tags.join(', '));
  const [description, setDescription] = useState(asset.description ?? '');
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/${asset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, kind, tags, description }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not save'); return; }
      onSaved(b.asset); toast.success('Saved'); onClose();
    } finally { setSaving(false); }
  }
  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent title="Edit asset" footer={<><ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose><Button loading={saving} onClick={() => void save()}>Save</Button></>}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[12px] font-medium">Title<Input value={title} onChange={e => setTitle(e.target.value)} /></label>
          <label className="flex flex-col gap-1 text-[12px] font-medium">Type
            <Select aria-label="Type" value={kind} onValueChange={v => setKind(v ?? 'other')} options={ASSET_KINDS.map(k => ({ value: k.value, label: k.label }))} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium">Tags<Input value={tags} onChange={e => setTags(e.target.value)} /></label>
          <label className="flex flex-col gap-1 text-[12px] font-medium">Description<Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} /></label>
        </div>
      </ModalContent>
    </Modal>
  );
}
