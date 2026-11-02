'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, ExternalLink, FileText, Film, ImagePlus, Link2, Pencil, Plus, QrCode, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmModal, Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { formatDate } from '@/lib/formatDate';
import { cn } from '@/lib/utils';
import { IMAGE_ACCEPT, VIDEO_ACCEPT, installPath, uploadPagePath } from '@/lib/design/productVideos';
import { downloadBlob, downloadQr, fileSafe } from '@/lib/client/qrDownload';
import { uploadViaLink } from '@/lib/client/designUpload';
import { stickerPdf } from '@/lib/client/stickerPdf';
import { HEADING, formatBytes } from '../designShared';
import { LibraryHeader, NotReady } from './LibraryShell';

interface Product {
  id: string; slug: string; product_code: string; title: string | null; category: string | null; specs: string[];
  collection: string | null; color_name: string | null; color_hex: string | null; image_path: string | null;
  dropbox_path: string | null; file_name: string | null; size_bytes: number | null;
  created_by: string | null; created_at: string; updated_at: string;
}
const API = '/api/design/videos';

/** The packaging sticker with the product's current details and QR code. */
async function sticker(p: Product, link: string, mode: 'download' | 'preview') {
  const blob = await stickerPdf({
    productCode: p.product_code, category: p.category, productName: p.title, specs: p.specs ?? [],
    collection: p.collection, colorName: p.color_name, colorHex: p.color_hex,
  }, link, p.image_path ? `${API}/${p.id}` : null);
  if (mode === 'download') downloadBlob(`Sticker-${fileSafe(p.product_code)}.pdf`, blob);
  else window.open(URL.createObjectURL(blob), '_blank', 'noopener');
}

function QrPreview({ url }: { url: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { void QRCode.toDataURL(url, { margin: 1, width: 240 }).then(setSrc).catch(() => setSrc(null)); }, [url]);
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt={`QR code for ${url}`} width={112} height={112} className="shrink-0 rounded-[6px] bg-white p-1" />
    : <span className="grid size-[112px] shrink-0 place-items-center rounded-[6px] bg-ui-surface-elevated text-ui-text-secondary"><QrCode /></span>;
}

export function ProductVideosClient() {
  const [items, setItems] = useState<Product[] | null>(null);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [me, setMe] = useState(''); const [isManager, setIsManager] = useState(false);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<Product | 'new' | null>(null);
  const [removing, setRemoving] = useState<Product | null>(null);
  const [busy, setBusy] = useState<string | null>(null);   // `${id}:${what}`
  const videoInput = useRef<HTMLInputElement>(null);
  const videoTarget = useRef<Product | null>(null);

  async function load() {
    const res = await fetch(API).catch(() => null);
    const b = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { toast.error(b.error ?? 'Could not load the products'); setItems([]); return; }
    setNotReady(b.notReady ?? null); setItems(b.videos ?? []); setBaseUrl(b.baseUrl || window.location.origin);
    setMe(b.me ?? ''); setIsManager(!!b.isManager);
  }
  useEffect(() => { void load(); }, []);

  const linkOf = (p: Product) => `${baseUrl || window.location.origin}${installPath(p.slug)}`;
  const upsert = (p: Product) => setItems(list => (list ?? []).some(x => x.id === p.id) ? (list ?? []).map(x => (x.id === p.id ? p : x)) : [p, ...(list ?? [])]);
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (items ?? []).filter(p => !s || `${p.product_code} ${p.title ?? ''} ${p.category ?? ''}`.toLowerCase().includes(s));
  }, [items, q]);

  async function run(key: string, fn: () => Promise<void>, fail: string) {
    setBusy(key);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : fail); } finally { setBusy(null); }
  }

  async function setVideo(p: Product, file: File) {
    await run(`${p.id}:video`, async () => {
      const path = await uploadViaLink(API, file, { kind: 'video', productCode: p.product_code });
      const res = await fetch(`${API}/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? 'Could not save the video');
      upsert(b.video);
      toast.success(p.dropbox_path ? 'Video replaced — the QR code stays the same' : 'Video added — the sticker’s QR code now plays it');
    }, 'Could not upload the video');
  }

  async function remove(p: Product) {
    const res = await fetch(`${API}/${p.id}`, { method: 'DELETE' }).catch(() => null);
    const b = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { toast.error(b.error ?? 'Could not remove'); return; }
    setItems(list => (list ?? []).filter(x => x.id !== p.id));
    toast.success('Removed — its QR code no longer opens a video. The Dropbox files are kept.');
  }

  return (
    <div className="flex w-full flex-col gap-[30px] pb-12">
      <LibraryHeader crumb="Design / Product Videos" title="Product Videos"
        subtitle="Each product’s packaging sticker and its installation video. The sticker’s QR code opens a public page (no login) with the video. Files live in Dropbox under /Design/Product Videos."
        action={<Button onClick={() => setForm('new')} disabled={!!notReady}><Plus /> Add product</Button>} />
      {notReady && <NotReady message={notReady} />}
      {!notReady && <UploadLinks baseUrl={baseUrl} canManage={isManager} />}

      <div className="relative w-[320px] max-w-full">
        <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
        <input type="search" aria-label="Search products" placeholder="Search product code or name…" value={q} onChange={e => setQ(e.target.value)}
          className="h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring" />
      </div>

      {items === null ? <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p> : visible.length === 0 ? (
        <div className="rounded-[8px] bg-ui-surface p-5">
          <EmptyState icon={<QrCode />} title={items.length ? 'No matching products' : 'No products yet'}
            description={items.length ? 'Try another product code.' : 'Add a product: fill in its sticker, add the installation video, then download the sticker with its QR code.'}
            action={!items.length && !notReady ? <Button size="sm" onClick={() => setForm('new')}><Plus /> Add product</Button> : undefined} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {visible.map(p => {
            const link = linkOf(p);
            const editable = isManager || p.created_by === me;
            return (
              <article key={p.id} className="flex flex-col gap-3 rounded-[8px] bg-ui-surface p-4">
                <div className="flex items-start gap-4">
                  <QrPreview url={link} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h3 className={cn('m-0 truncate text-[16px] font-semibold', HEADING)} title={p.product_code}>{p.product_code}</h3>
                    {(p.category || p.title) && <p className="m-0 truncate text-[13px] text-ui-body">{[p.category, p.title].filter(Boolean).join(' · ')}</p>}
                    {p.dropbox_path
                      ? <p className="m-0 truncate text-[11px] text-ui-text-secondary" title={p.file_name ?? ''}><Film size={11} className="mr-1 inline" aria-hidden />{p.file_name}{p.size_bytes ? ` · ${formatBytes(p.size_bytes)}` : ''} · {formatDate(p.updated_at)}</p>
                      : <p className="m-0 text-[11px] font-semibold text-[var(--status-t0-fg)]">No video yet — the QR page says “coming soon”</p>}
                    <a href={link} target="_blank" rel="noreferrer" className="mt-1 truncate text-[12px] font-medium text-ui-nav-active underline-offset-2 hover:underline">{link}</a>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" loading={busy === `${p.id}:sticker`} onClick={() => void run(`${p.id}:sticker`, () => sticker(p, link, 'download'), 'Could not build the sticker')}><FileText /> Sticker PDF</Button>
                  <Button size="sm" variant="outline" loading={busy === `${p.id}:preview`} onClick={() => void run(`${p.id}:preview`, () => sticker(p, link, 'preview'), 'Could not build the sticker')}>Preview</Button>
                  {editable && (
                    <Button size="sm" variant="outline" loading={busy === `${p.id}:video`} onClick={() => { videoTarget.current = p; videoInput.current?.click(); }}>
                      <Upload /> {p.dropbox_path ? 'Replace video' : 'Add video'}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => void downloadQr(link, p.product_code, 'png')}><Download /> QR PNG</Button>
                  <Button size="sm" variant="outline" onClick={() => void downloadQr(link, p.product_code, 'svg')}><Download /> QR SVG</Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Copy link" title="Copy link" onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success('Link copied'))}><Copy /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Open the public page" title="Open the public page" render={<a href={link} target="_blank" rel="noreferrer" />}><ExternalLink /></Button>
                  <span className="flex-1" />
                  {editable && <Button size="icon-sm" variant="ghost" aria-label={`Edit ${p.product_code}`} onClick={() => setForm(p)}><Pencil /></Button>}
                  {editable && <Button size="icon-sm" variant="ghost" aria-label={`Remove ${p.product_code}`} onClick={() => setRemoving(p)}><Trash2 /></Button>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <input ref={videoInput} type="file" accept={VIDEO_ACCEPT} hidden onChange={e => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (f && videoTarget.current) void setVideo(videoTarget.current, f);
      }} />
      {form && <ProductForm product={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={p => { upsert(p); setForm(null); }} />}
      <ConfirmModal open={!!removing} onOpenChange={o => { if (!o) setRemoving(null); }} tone="destructive"
        title={`Remove “${removing?.product_code}”?`} description="Its QR code will stop opening the video. The files stay in Dropbox." confirmLabel="Remove"
        onConfirm={async () => { if (removing) await remove(removing); setRemoving(null); }} />
    </div>
  );
}

interface UploadLink { id: string; token: string; label: string | null; created_at: string }

/** No-login links for the production floor: upload a video, get its QR code. */
function UploadLinks({ baseUrl, canManage }: { baseUrl: string; canManage: boolean }) {
  const [links, setLinks] = useState<UploadLink[] | null>(null);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void fetch(`${API}/links`).then(r => r.json()).then(b => { setLinks(b.links ?? []); setNotReady(b.notReady ?? null); }).catch(() => setLinks([]));
  }, []);
  const urlOf = (l: UploadLink) => `${baseUrl || window.location.origin}${uploadPagePath(l.token)}`;

  async function create() {
    setBusy(true);
    try {
      const res = await fetch(`${API}/links`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: 'Production floor' }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not create the link'); return; }
      setLinks(l => [b.link, ...(l ?? [])]);
      await navigator.clipboard.writeText(urlOf(b.link)).catch(() => {});
      toast.success('Upload link created and copied');
    } finally { setBusy(false); }
  }
  async function revoke(l: UploadLink) {
    const res = await fetch(`${API}/links/${l.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Could not revoke the link'); return; }
    setLinks(x => (x ?? []).filter(y => y.id !== l.id)); toast.success('Link revoked — it no longer works');
  }

  if (notReady) return <NotReady message={notReady} />;
  return (
    <section className="flex flex-col gap-2.5 rounded-[8px] bg-ui-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link2 size={16} aria-hidden className="text-ui-text-secondary" />
        <h2 className={cn('m-0 flex-1 text-[14px] font-semibold', HEADING)}>Upload link (no login)</h2>
        {canManage && <Button size="sm" variant="outline" loading={busy} onClick={() => void create()}><Plus /> New link</Button>}
      </div>
      <p className="m-0 text-[12px] text-ui-body">Give this link to the production floor: they upload a product’s video and get its QR code — no account needed. Revoke it any time.</p>
      {links === null ? null : links.length === 0
        ? <p className="m-0 text-[12px] text-ui-text-secondary">{canManage ? 'No link yet — create one.' : 'No link yet — a manager can create one.'}</p>
        : links.map(l => (
          <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-[6px] bg-ui-surface-elevated px-3 py-2">
            <span className="text-[12px] font-semibold text-ui-heading">{l.label ?? 'Upload link'}</span>
            <code className="min-w-0 flex-1 truncate text-[12px] text-ui-body">{urlOf(l)}</code>
            <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(urlOf(l)).then(() => toast.success('Link copied'))}><Copy /> Copy</Button>
            <Button size="icon-sm" variant="ghost" aria-label="Open the upload page" render={<a href={urlOf(l)} target="_blank" rel="noreferrer" />}><ExternalLink /></Button>
            {canManage && <Button size="icon-sm" variant="ghost" aria-label="Revoke this link" title="Revoke" onClick={() => void revoke(l)}><Trash2 /></Button>}
          </div>
        ))}
    </section>
  );
}

/** Add / edit a product: what its sticker shows, its drawing and (when adding) the video. */
function ProductForm({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: (p: Product) => void }) {
  const [code, setCode] = useState(product?.product_code ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [title, setTitle] = useState(product?.title ?? '');
  const [specs, setSpecs] = useState((product?.specs ?? []).join('\n'));
  const [collection, setCollection] = useState(product?.collection ?? '');
  const [colorName, setColorName] = useState(product?.color_name ?? '');
  const [colorHex, setColorHex] = useState(product?.color_hex ?? '#231f20');
  const [image, setImage] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  async function save() {
    if (!code.trim()) return;
    try {
      const fields = { productCode: code.trim(), category, title, specs, collection, colorName, colorHex };
      let imagePath: string | undefined, path: string | undefined;
      if (image) { setBusy('Uploading the drawing…'); imagePath = await uploadViaLink(API, image, { kind: 'image', productCode: code.trim() }); }
      if (video) { setBusy('Uploading the video…'); path = await uploadViaLink(API, video, { kind: 'video', productCode: code.trim() }); }
      setBusy('Saving…');
      const res = product
        ? await fetch(`${API}/${product.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, ...(imagePath ? { imagePath } : {}), ...(path ? { path } : {}) }) })
        : await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', ...fields, imagePath, path }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? 'Could not save');
      onSaved(b.video); toast.success(product ? 'Saved — download the sticker again to print the change' : 'Product added — download its sticker from the card');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(null); }
  }

  const label = 'flex flex-col gap-1 text-[12px] font-medium';
  return (
    <Modal open onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <ModalContent title={product ? `Edit ${product.product_code}` : 'Add product'}
        description="What the packaging sticker shows. The QR code is added automatically and never changes."
        footer={<><ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />} disabled={!!busy}>Cancel</ModalClose>
          <Button loading={!!busy} disabled={!code.trim()} onClick={() => void save()}>{busy ?? 'Save'}</Button></>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={cn(label, 'sm:col-span-2')}>Product code (banner)
            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="IN-FC-48/ F12 BODY" />
          </label>
          <label className={label}>Category
            <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Front Counter | Cashier Area" />
          </label>
          <label className={label}>Product name
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={'FRONT SHELVES 48"'} />
          </label>
          <label className={cn(label, 'sm:col-span-2')}>Specifications (one per line, up to 4)
            <Textarea rows={4} value={specs} onChange={e => setSpecs(e.target.value)} placeholder={'MDF Body\nLED Strips\nMetal Legs\nInstallation Package'} />
          </label>
          <label className={label}>Collection
            <Input value={collection} onChange={e => setCollection(e.target.value)} placeholder="INDUSTRIAL" />
          </label>
          <div className="flex gap-2">
            <label className={cn(label, 'flex-1')}>Color
              <Input value={colorName} onChange={e => setColorName(e.target.value)} placeholder="BLACK" />
            </label>
            <label className={label}>Swatch
              <input type="color" value={colorHex} onChange={e => setColorHex(e.target.value)} aria-label="Swatch colour"
                className="h-8 w-12 cursor-pointer rounded-[4px] border border-primary-700 bg-transparent p-0.5" />
            </label>
          </div>
          <div className={label}>Product drawing (PNG / JPG)
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => imageRef.current?.click()}><ImagePlus /> {product?.image_path && !image ? 'Replace' : 'Choose'}</Button>
              <span className="truncate text-[12px] font-normal text-ui-text-secondary">{image?.name ?? (product?.image_path ? product.image_path.split('/').pop() : 'Optional')}</span>
            </div>
            <input ref={imageRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={e => { setImage(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          </div>
          <div className={label}>Installation video
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => videoRef.current?.click()}><Film /> {product?.dropbox_path && !video ? 'Replace' : 'Choose'}</Button>
              <span className="truncate text-[12px] font-normal text-ui-text-secondary">{video ? `${video.name} · ${formatBytes(video.size)}` : product?.file_name ?? 'Optional — can be added later'}</span>
            </div>
            <input ref={videoRef} type="file" accept={VIDEO_ACCEPT} hidden onChange={e => { setVideo(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
