'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, ExternalLink, Pencil, QrCode, RefreshCw, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmModal, Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { formatDate } from '@/lib/formatDate';
import { cn } from '@/lib/utils';
import { VIDEO_ACCEPT, installPath } from '@/lib/design/productVideos';
import { uploadViaLink } from '@/lib/client/designUpload';
import { HEADING, formatBytes } from '../designShared';
import { LibraryHeader, NotReady } from './LibraryShell';

interface ProductVideo {
  id: string; slug: string; product_code: string; title: string | null;
  file_name: string | null; size_bytes: number | null; created_by: string | null; created_at: string; updated_at: string;
}
const API = '/api/design/videos';
const fileSafe = (s: string) => s.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'product';

function downloadBlob(name: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** QR as PNG (1024 px, for screens / quick prints) or SVG (scales to any sticker size). */
async function downloadQr(url: string, code: string, kind: 'png' | 'svg') {
  const opts = { margin: 2, errorCorrectionLevel: 'M' as const, color: { dark: '#000000', light: '#ffffff' } };
  if (kind === 'svg') {
    downloadBlob(`QR-${fileSafe(code)}.svg`, new Blob([await QRCode.toString(url, { ...opts, type: 'svg' })], { type: 'image/svg+xml' }));
  } else {
    const dataUrl = await QRCode.toDataURL(url, { ...opts, width: 1024 });
    downloadBlob(`QR-${fileSafe(code)}.png`, await (await fetch(dataUrl)).blob());
  }
}

function QrPreview({ url }: { url: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { void QRCode.toDataURL(url, { margin: 1, width: 240 }).then(setSrc).catch(() => setSrc(null)); }, [url]);
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt={`QR code for ${url}`} width={120} height={120} className="shrink-0 rounded-[6px] bg-white p-1" />
    : <span className="grid size-[120px] shrink-0 place-items-center rounded-[6px] bg-ui-surface-elevated text-ui-text-secondary"><QrCode /></span>;
}

export function ProductVideosClient() {
  const [videos, setVideos] = useState<ProductVideo[] | null>(null);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [me, setMe] = useState(''); const [isManager, setIsManager] = useState(false);
  const [q, setQ] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<ProductVideo | null>(null);
  const [removing, setRemoving] = useState<ProductVideo | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<ProductVideo | null>(null);

  async function load() {
    const res = await fetch(API).catch(() => null);
    const b = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { toast.error(b.error ?? 'Could not load the product videos'); setVideos([]); return; }
    setNotReady(b.notReady ?? null); setVideos(b.videos ?? []); setBaseUrl(b.baseUrl || window.location.origin);
    setMe(b.me ?? ''); setIsManager(!!b.isManager);
  }
  useEffect(() => { void load(); }, []);

  const linkOf = (v: ProductVideo) => `${baseUrl || window.location.origin}${installPath(v.slug)}`;
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (videos ?? []).filter(v => !s || `${v.product_code} ${v.title ?? ''}`.toLowerCase().includes(s));
  }, [videos, q]);

  async function replace(v: ProductVideo, file: File) {
    setReplacing(v.id);
    try {
      const path = await uploadViaLink(API, file, { productCode: v.product_code });
      const res = await fetch(`${API}/${v.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? 'Could not replace the video');
      setVideos(p => (p ?? []).map(x => (x.id === v.id ? b.video : x)));
      toast.success('Video replaced — the link and QR code stay the same');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not replace the video'); }
    finally { setReplacing(null); }
  }

  async function remove(v: ProductVideo) {
    const res = await fetch(`${API}/${v.id}`, { method: 'DELETE' }).catch(() => null);
    const b = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { toast.error(b.error ?? 'Could not remove'); return; }
    setVideos(p => (p ?? []).filter(x => x.id !== v.id));
    toast.success('Removed — its QR code no longer opens a video. The Dropbox file is kept.');
  }

  return (
    <div className="flex w-full flex-col gap-[30px] pb-12">
      <LibraryHeader crumb="Design / Product Videos" title="Product Videos"
        subtitle="Installation videos behind the QR code on each packaging sticker. Scanning it opens a public page (no login) with the video. Files live in Dropbox under /Design/Product Videos."
        action={<Button onClick={() => setUploadOpen(true)} disabled={!!notReady}><Upload /> Add product video</Button>} />
      {notReady && <NotReady message={notReady} />}

      <div className="relative w-[320px] max-w-full">
        <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
        <input type="search" aria-label="Search product videos" placeholder="Search product code or name…" value={q} onChange={e => setQ(e.target.value)}
          className="h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring" />
      </div>

      {videos === null ? <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p> : visible.length === 0 ? (
        <div className="rounded-[8px] bg-ui-surface p-5">
          <EmptyState icon={<QrCode />} title={videos.length ? 'No matching products' : 'No product videos yet'}
            description={videos.length ? 'Try another product code.' : 'Add an installation video to get its public link and the QR code for the sticker.'}
            action={!videos.length && !notReady ? <Button size="sm" onClick={() => setUploadOpen(true)}><Upload /> Add product video</Button> : undefined} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {visible.map(v => {
            const link = linkOf(v);
            const editable = isManager || v.created_by === me;
            return (
              <article key={v.id} className="flex flex-col gap-3 rounded-[8px] bg-ui-surface p-4">
                <div className="flex items-start gap-4">
                  <QrPreview url={link} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h3 className={cn('m-0 truncate text-[16px] font-semibold', HEADING)} title={v.product_code}>{v.product_code}</h3>
                    {v.title && <p className="m-0 truncate text-[13px] text-ui-body" title={v.title}>{v.title}</p>}
                    <p className="m-0 truncate text-[11px] text-ui-text-secondary" title={v.file_name ?? ''}>
                      {v.file_name ?? '—'}{v.size_bytes ? ` · ${formatBytes(v.size_bytes)}` : ''} · {formatDate(v.updated_at)}
                    </p>
                    <a href={link} target="_blank" rel="noreferrer" className="mt-1 truncate text-[12px] font-medium text-ui-nav-active underline-offset-2 hover:underline">{link}</a>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" onClick={() => void downloadQr(link, v.product_code, 'png')}><Download /> QR PNG</Button>
                  <Button size="sm" variant="outline" onClick={() => void downloadQr(link, v.product_code, 'svg')}><Download /> QR SVG</Button>
                  <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success('Link copied'))}><Copy /> Copy link</Button>
                  <Button size="sm" variant="outline" render={<a href={link} target="_blank" rel="noreferrer" />}><ExternalLink /> Open</Button>
                  <span className="flex-1" />
                  {editable && (
                    <Button size="icon-sm" variant="ghost" aria-label={`Replace the video of ${v.product_code}`} title="Replace the video (link and QR stay)"
                      loading={replacing === v.id} onClick={() => { replaceTarget.current = v; replaceInput.current?.click(); }}><RefreshCw /></Button>
                  )}
                  {editable && <Button size="icon-sm" variant="ghost" aria-label={`Edit ${v.product_code}`} onClick={() => setEditing(v)}><Pencil /></Button>}
                  {editable && <Button size="icon-sm" variant="ghost" aria-label={`Remove ${v.product_code}`} onClick={() => setRemoving(v)}><Trash2 /></Button>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <input ref={replaceInput} type="file" accept={VIDEO_ACCEPT} hidden onChange={e => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (f && replaceTarget.current) void replace(replaceTarget.current, f);
      }} />
      <AddVideo open={uploadOpen} onOpenChange={setUploadOpen} onAdded={v => setVideos(p => [v, ...(p ?? [])])} />
      {editing && <EditVideo video={editing} onClose={() => setEditing(null)} onSaved={v => setVideos(p => (p ?? []).map(x => (x.id === v.id ? v : x)))} />}
      <ConfirmModal open={!!removing} onOpenChange={o => { if (!o) setRemoving(null); }} tone="destructive"
        title={`Remove “${removing?.product_code}”?`} description="Its QR code will stop opening the video. The file stays in Dropbox." confirmLabel="Remove"
        onConfirm={async () => { if (removing) await remove(removing); setRemoving(null); }} />
    </div>
  );
}

function AddVideo({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; onAdded: (v: ProductVideo) => void }) {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setCode(''); setTitle(''); setFile(null); } }, [open]);

  async function submit() {
    if (!file || !code.trim()) return;
    setBusy('Uploading the video…');
    try {
      const path = await uploadViaLink(API, file, { productCode: code.trim() });
      setBusy('Creating the link…');
      const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', productCode: code.trim(), title, path }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? 'Could not add the video');
      onAdded(b.video); toast.success('Added — download the QR code from its card'); onOpenChange(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not add the video'); }
    finally { setBusy(null); }
  }

  return (
    <Modal open={open} onOpenChange={o => { if (!busy) onOpenChange(o); }}>
      <ModalContent title="Add product video" description="The video goes straight to Dropbox. You get a public link and the QR code for the sticker."
        footer={<><ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />} disabled={!!busy}>Cancel</ModalClose>
          <Button loading={!!busy} disabled={!file || !code.trim()} onClick={() => void submit()}>{busy ?? 'Upload'}</Button></>}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[12px] font-medium">Product code
            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. IN-FC-48/ F12 BODY" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium">Name (optional)
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Front Shelves 48&quot; — Front Counter" />
          </label>
          <div className="flex flex-col gap-1 text-[12px] font-medium">Installation video
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}><Upload /> Choose video</Button>
              <span className="truncate text-[12px] font-normal text-ui-text-secondary">{file ? `${file.name} · ${formatBytes(file.size)}` : 'MP4, MOV or WEBM'}</span>
            </div>
            <input ref={inputRef} type="file" accept={VIDEO_ACCEPT} hidden onChange={e => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

function EditVideo({ video, onClose, onSaved }: { video: ProductVideo; onClose: () => void; onSaved: (v: ProductVideo) => void }) {
  const [code, setCode] = useState(video.product_code);
  const [title, setTitle] = useState(video.title ?? '');
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/${video.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productCode: code, title }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not save'); return; }
      onSaved(b.video); toast.success('Saved'); onClose();
    } finally { setSaving(false); }
  }
  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent title="Edit product video" description="The link and QR code don't change."
        footer={<><ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose><Button loading={saving} disabled={!code.trim()} onClick={() => void save()}>Save</Button></>}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[12px] font-medium">Product code<Input value={code} onChange={e => setCode(e.target.value)} /></label>
          <label className="flex flex-col gap-1 text-[12px] font-medium">Name (optional)<Input value={title} onChange={e => setTitle(e.target.value)} /></label>
        </div>
      </ModalContent>
    </Modal>
  );
}
