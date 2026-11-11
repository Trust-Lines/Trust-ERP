'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FastForward, FileUp, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';
import { PdfPages, type Highlight } from './PdfPages';
import {
  MAX_PDF_BYTES, PF_TYPES, catalogText, cleanProducts, currencySymbol, getStockCatalog, getVendors, importPfPdf, previewPfPdf, round2,
  type Currency, type ImportedPf, type ParsedStockProduct, type PfImportData, type PfPdfPreview, type PfType, type StockCatalogItem, type Vendor,
} from './pfImport';

// Trust Stock → "Upload PF PDF". Pick a PF PDF → the Trust System reads it (preview, saves nothing)
// while the pages show a scan line → the rows it found light up on the PDF one by one and fill the
// table → check / correct → Save imports it into Trust Stock (stock group, PF row, products, PDF).
// The animation is only a way of showing the server's answer: every value comes from it.

type Phase = 'pick' | 'reading' | 'reveal' | 'edit';
const MIN_SCAN_MS = 1000;
const STEP_MS = 150;

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const LABEL = 'text-[12px] font-medium text-ui-heading';
const typeLabel = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const toDate = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00`) : null);
const fromDate = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '');
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Text that types itself in once (header values during the reveal). */
function Typed({ text, run }: { text: string; run: boolean }) {
  const [n, setN] = useState(run ? 0 : text.length);
  useEffect(() => {
    if (!run) { setN(text.length); return; }
    setN(0);
    const step = Math.max(1, Math.ceil(text.length / 14));
    const id = setInterval(() => setN(k => { if (k + step >= text.length) { clearInterval(id); return text.length; } return k + step; }), 28);
    return () => clearInterval(id);
  }, [text, run]);
  return <>{text.slice(0, n)}{n < text.length && <span className="pf-scan-caret-inline">▍</span>}</>;
}

export interface ImportedResult { stockCode: string; data: PfImportData; vendor: Vendor | null; result: ImportedPf }

export function PfPdfImportDialog({ open, onOpenChange, onImported }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (r: ImportedResult) => void;
}) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PfPdfPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  // Editable copy of the read values.
  const [stockCode, setStockCode] = useState('');
  const [pfCode, setPfCode] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [type, setType] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [pfDate, setPfDate] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [paymentRule, setPaymentRule] = useState('');
  const [products, setProducts] = useState<ParsedStockProduct[]>([]);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [catalog, setCatalog] = useState<StockCatalogItem[]>([]);
  useEffect(() => {
    if (!open) return;
    getVendors().then(setVendors).catch(() => {});
    getStockCatalog().then(setCatalog).catch(() => {});
  }, [open]);

  const reset = useCallback(() => {
    abort.current?.abort();
    setPhase('pick'); setFile(null); setPreview(null); setError(null); setRevealed(0); setSaving(false);
    setProducts([]); setStockCode(''); setPfCode(''); setVendorId(''); setType(''); setOrderNo(''); setPfDate(''); setPaymentRule(''); setCurrency('USD');
  }, []);
  useEffect(() => { if (!open) reset(); }, [open, reset]);

  const fill = (p: PfPdfPreview) => {
    setStockCode(p.stockCode ?? ''); setPfCode(p.pfCode ?? ''); setVendorId(p.vendor?.id ?? '');
    setType(p.type && (PF_TYPES as readonly string[]).includes(p.type) ? p.type : '');
    setPfDate(p.pfDate ?? ''); setCurrency(p.currency ?? 'USD'); setPaymentRule(p.paymentRule ?? '');
  };

  async function choose(f: File | undefined) {
    if (!f) return;
    setError(null);
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { setError('Only PDF files.'); return; }
    if (f.size > MAX_PDF_BYTES) { setError(`File too large (${(f.size / 1048576).toFixed(1)} MB) — at most 4 MB.`); return; }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setFile(f); setPreview(null); setRevealed(0); setProducts([]); setPhase('reading');
    const started = Date.now();
    try {
      const p = await previewPfPdf(f, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (!reduced) await sleep(Math.max(0, MIN_SCAN_MS - (Date.now() - started)));
      if (ctrl.signal.aborted) return;
      setPreview(p);
      fill(p);
      if (reduced || p.products.length === 0) { setProducts(p.products); setRevealed(p.products.length); setPhase('edit'); }
      else setPhase('reveal');
    } catch (e) {
      if (ctrl.signal.aborted) return;
      // Errors show at once — no waiting for the animation.
      setError(e instanceof Error ? e.message : 'Could not read the PDF');
      setPhase('pick');
    }
  }

  // Reveal: one product every STEP_MS — highlighted on the PDF and added to the table.
  useEffect(() => {
    if (phase !== 'reveal' || !preview) return;
    if (revealed >= preview.products.length) {
      const t = setTimeout(() => { setProducts(preview.products); setPhase('edit'); }, 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRevealed(n => n + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [phase, revealed, preview]);

  const skip = () => { if (!preview) return; setRevealed(preview.products.length); setProducts(preview.products); setPhase('edit'); };

  // Product i ↔ its layout row (same item code, in order; a product may have none).
  const layoutFor = useMemo(() => {
    const out: (Highlight | null)[] = [];
    if (!preview) return out;
    const used = new Set<number>();
    const layout = preview.layout ?? [];
    preview.products.forEach((p, i) => {
      const k = layout.findIndex((l, j) => !used.has(j) && l.itemCode.trim().toUpperCase() === p.itemCode.trim().toUpperCase());
      if (k < 0) { out.push(null); return; }
      used.add(k);
      out.push({ key: `${i}-${k}`, layout: layout[k], label: `${p.itemCode} · ${p.quantity}` });
    });
    return out;
  }, [preview]);
  const highlights = useMemo(
    () => layoutFor.slice(0, phase === 'reveal' ? revealed : layoutFor.length).filter((h): h is Highlight => !!h),
    [layoutFor, phase, revealed],
  );

  // ── Editing ──
  const setProduct = (i: number, patch: Partial<ParsedStockProduct>) => setProducts(prev => prev.map((p, k) => {
    if (k !== i) return p;
    const next = { ...p, ...patch };
    if (('quantity' in patch || 'unitPrice' in patch) && next.unitPrice != null) next.totalPrice = round2(next.unitPrice * (next.quantity || 0));
    return next;
  }));
  const setItemCode = (i: number, code: string) => {
    const hit = catalog.find(c => c.itemCode.toUpperCase() === code.trim().toUpperCase());
    setProducts(prev => prev.map((p, k) => {
      if (k !== i) return p;
      const next = { ...p, itemCode: code };
      if (!hit) return next;
      const prevHit = catalog.find(c => c.itemCode.toUpperCase() === p.itemCode.trim().toUpperCase());
      if (!p.description.trim() || (prevHit && p.description === catalogText(prevHit))) next.description = catalogText(hit);
      if (!p.category) next.category = hit.category;
      if (p.unitPrice == null && hit.unitPrice != null) { next.unitPrice = hit.unitPrice; next.totalPrice = round2(hit.unitPrice * (p.quantity || 0)); }
      return next;
    }));
  };

  const rows = phase === 'edit' ? products : (preview?.products ?? []).slice(0, revealed);
  const total = round2(rows.reduce((s, p) => s + (p.totalPrice ?? 0), 0));
  const qty = rows.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
  const sym = currencySymbol(currency);
  const duplicate = preview?.duplicateOf ?? null;
  const blocked = !stockCode.trim() || !pfCode.trim() || products.length === 0 || products.some(p => !p.itemCode.trim()) || !!duplicate;
  const vendor = vendors.find(v => v.id === vendorId) ?? (preview?.vendor?.id === vendorId ? preview.vendor : null);

  async function save() {
    if (!file || blocked || phase !== 'edit') return;
    setSaving(true); setError(null);
    const data: PfImportData = {
      stockCode: stockCode.trim(),
      pfCode: pfCode.trim(),
      vendorId: vendorId || null,
      type: (type || null) as PfType | null,
      orderNo: orderNo.trim() || null,
      pfDate: pfDate || null,
      currency,
      totalPrice: total || null,
      paymentRule: paymentRule.trim() || null,
      products: cleanProducts(products),
    };
    try {
      const result = await importPfPdf(file, data);
      onImported({ stockCode: data.stockCode, data, vendor, result });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  }

  const vendorOptions = useMemo(() => [{ value: '', label: '— not set —' }, ...vendors.map(v => ({ value: v.id, label: `${v.code} - ${v.name}` }))], [vendors]);
  const typeOptions = [{ value: '', label: '—' }, ...PF_TYPES.map(t => ({ value: t, label: typeLabel(t) }))];
  const currencyOptions = (['USD', 'TL', 'EUR'] as const).map(c => ({ value: c, label: c }));
  const editable = phase === 'edit';
  const animating = phase === 'reveal' && !reduced;

  return (
    <Modal open={open} onOpenChange={o => { if (!saving) onOpenChange(o); }}>
      <ModalContent
        title="Upload PF PDF"
        description="The Trust System reads the PF; check the values, then save them to Trust Stock."
        className="max-w-[1240px]"
        footer={
          <>
            {phase === 'reveal' && <Button variant="ghost" className="mr-auto" onClick={skip}><FastForward /> Skip</Button>}
            {file && phase === 'edit' && (
              <Button variant="ghost" className="mr-auto" onClick={() => inputRef.current?.click()} disabled={saving}><FileUp /> Another PDF</Button>
            )}
            <ModalClose render={<Button variant="outline" className={modalSecondaryButtonClass} disabled={saving} />}>Cancel</ModalClose>
            <Button onClick={() => void save()} disabled={!editable || blocked || saving} title={duplicate ? `Already imported in ${duplicate.groupCode}` : undefined}>
              {saving ? <Loader2 className="animate-spin" /> : <Upload />} {saving ? 'Saving…' : 'Save to Trust Stock'}
            </Button>
          </>
        }
      >
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void choose(f); }} />

        {!file ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); void choose(e.dataTransfer.files?.[0]); }}
            className={cn('flex flex-col items-center justify-center gap-3 rounded-[8px] border-2 border-dashed px-6 py-14 text-center transition-colors',
              dragOver ? 'border-[var(--color-secondary-700)] bg-ui-hover-bg dark:border-ui-heading' : 'border-ui-divider bg-ui-page-bg')}
          >
            <FileUp size={28} className="text-ui-text-secondary" aria-hidden />
            <div className={cn('text-[14px] font-semibold', HEADING)}>Drop the PF PDF here</div>
            <div className="text-[12px] text-ui-text-secondary">Estimated Production Form + vendor quote · PDF, at most 4 MB</div>
            <Button size="sm" onClick={() => inputRef.current?.click()}><Upload /> Choose PDF</Button>
            {error && <p role="alert" className="m-0 text-[12px] text-error-normal">{error}</p>}
          </div>
        ) : (
          <div className="grid min-h-0 gap-5 lg:grid-cols-[minmax(0,44%)_minmax(0,1fr)]">
            {/* PDF */}
            <div className="flex min-h-0 flex-col gap-2">
              <div className="flex items-center gap-2 text-[12px] text-ui-text-secondary">
                <span className="min-w-0 truncate font-medium text-ui-body">{file.name}</span>
                <span>· {(file.size / 1048576).toFixed(1)} MB</span>
                {phase === 'reading' && <span className="ml-auto inline-flex items-center gap-1.5" role="status"><Loader2 size={12} className="animate-spin" aria-hidden /> Reading the PDF…</span>}
                {phase === 'reveal' && <span className="ml-auto" role="status">Found {revealed} / {preview?.products.length ?? 0}</span>}
              </div>
              <div ref={scrollRef} className="max-h-[62vh] overflow-y-auto rounded-[6px] border border-ui-divider bg-ui-page-bg p-2">
                <PdfPages file={file} scanning={phase === 'reading'} highlights={highlights} scrollRef={scrollRef} reducedMotion={reduced} />
              </div>
            </div>

            {/* Values */}
            <div className="flex min-w-0 flex-col gap-4">
              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-[6px] px-3 py-2 text-[12px]" style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}>
                  <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden /> {error}
                </div>
              )}
              {duplicate && (
                <div role="alert" className="flex items-start gap-2 rounded-[6px] px-3 py-2 text-[12px]" style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}>
                  <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden /> This PF is already in {duplicate.groupCode}. It can’t be imported again.
                </div>
              )}
              {preview && preview.warnings.length > 0 && (
                <div className="flex items-start gap-2 rounded-[6px] px-3 py-2 text-[12px]" style={{ background: 'var(--status-t7-bg)', color: 'var(--status-t7-fg)' }}>
                  <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden />
                  <ul className="m-0 list-none p-0">{preview.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
              )}

              {phase === 'reading' ? (
                <div className="flex flex-col gap-3" aria-busy>
                  {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-9 animate-pulse rounded-[6px] bg-ui-page-bg" />)}
                </div>
              ) : preview && !editable ? (
                /* Reveal: the read values type themselves in */
                <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                  {[
                    ['Stock code', preview.stockCode ?? '—'], ['PF code', preview.pfCode ?? '—'],
                    ['Vendor', preview.vendor ? `${preview.vendor.code} - ${preview.vendor.name}` : preview.supplierName ?? '—'],
                    ['Type', preview.type ? typeLabel(preview.type) : '—'], ['Date', preview.pfDate ?? '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt className="text-[11px] text-ui-text-secondary">{k}</dt>
                      <dd className={cn('m-0 truncate text-[13px] font-semibold', HEADING, k === 'PF code' && 'font-mono')}><Typed text={v} run={animating} /></dd>
                    </div>
                  ))}
                </dl>
              ) : preview && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className={LABEL}>Stock code <span className="font-normal text-ui-text-secondary">{preview.groupStatus === 'new' ? '(new)' : preview.groupStatus === 'exists' ? '(adds to existing stock)' : preview.groupStatus === 'in-trash' ? '(in trash)' : ''}</span></span>
                    <Input value={stockCode} onChange={e => setStockCode(e.target.value)} aria-invalid={!stockCode.trim()} />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className={LABEL}>PF code</span>
                    <Input value={pfCode} onChange={e => setPfCode(e.target.value)} className="font-mono" aria-invalid={!pfCode.trim()} />
                  </label>
                  <div className="col-span-2 flex min-w-0 flex-col gap-1.5">
                    <span className={LABEL}>Vendor {preview.supplierName && <span className="font-normal text-ui-text-secondary">(PDF: {preview.supplierName})</span>}</span>
                    <Select options={vendorOptions} value={vendorId} onValueChange={v => setVendorId(v ?? '')} aria-label="Vendor" placeholder="— not set —" popupClassName="max-h-[320px]" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className={LABEL}>Type</span>
                    <Select options={typeOptions} value={type} onValueChange={v => setType(v ?? '')} aria-label="Type" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className={LABEL}>PF date</span>
                    <DatePicker value={toDate(pfDate)} onValueChange={d => setPfDate(fromDate(d))} aria-label="PF date" />
                  </div>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className={LABEL}>Order no <span className="font-normal text-ui-text-secondary">(optional)</span></span>
                    <Input value={orderNo} onChange={e => setOrderNo(e.target.value)} placeholder="PO / invoice no" />
                  </label>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className={LABEL}>Currency</span>
                    <Select options={currencyOptions} value={currency} onValueChange={v => setCurrency((v ?? 'USD') as Currency)} aria-label="Currency" />
                  </div>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className={LABEL}>Payment rule <span className="font-normal text-ui-text-secondary">(advance %)</span></span>
                    <Input value={paymentRule} onChange={e => setPaymentRule(e.target.value)} inputMode="decimal" placeholder="50" />
                  </label>
                </div>
              )}

              {preview && (
                <div className="flex min-w-0 flex-col gap-2">
                  <div className={cn('text-[13px] font-semibold', HEADING)}>Products in this PF</div>
                  <datalist id="trust-stock-catalog">
                    {catalog.map(c => <option key={c.itemCode} value={c.itemCode}>{catalogText(c)}{c.unitPrice != null ? ` · ${c.unitPrice}` : ''}</option>)}
                  </datalist>
                  <div className="max-h-[42vh] overflow-auto rounded-[6px] border border-ui-divider">
                    <table className="w-full min-w-[620px] border-collapse text-[12px]">
                      <thead className="sticky top-0 z-[1] bg-ui-surface-elevated">
                        <tr className="border-b border-ui-divider text-left text-ui-text-secondary">
                          <th className="w-[140px] px-2 py-2 font-medium">Item code</th>
                          <th className="px-2 py-2 font-medium">Description</th>
                          <th className="w-[72px] px-2 py-2 font-medium">Qty</th>
                          <th className="w-[96px] px-2 py-2 font-medium">Unit {sym}</th>
                          <th className="w-[104px] px-2 py-2 font-medium">Total {sym}</th>
                          <th className="w-9" aria-label="Remove" />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 && (
                          <tr><td colSpan={6} className="px-3 py-4 text-center text-ui-text-secondary">{editable ? 'No products read — add them with “Add line”.' : '…'}</td></tr>
                        )}
                        {rows.map((p, i) => editable ? (
                          <tr key={i} className="border-b border-ui-divider align-top last:border-b-0">
                            <td className="px-1.5 py-1.5"><Input list="trust-stock-catalog" value={p.itemCode} onChange={e => setItemCode(i, e.target.value)} placeholder="Type to search…" className="font-mono text-[12px]" aria-invalid={!p.itemCode.trim()} aria-label={`Item code, line ${i + 1}`} /></td>
                            <td className="px-1.5 py-1.5">
                              <Input value={p.description} onChange={e => setProduct(i, { description: e.target.value })} className="text-[12px]" aria-label={`Description, line ${i + 1}`} />
                              {p.category && <div className="mt-0.5 px-1 text-[11px] text-ui-text-secondary">{p.category}</div>}
                            </td>
                            <td className="px-1.5 py-1.5"><Input value={String(p.quantity ?? '')} inputMode="decimal" onChange={e => setProduct(i, { quantity: num(e.target.value) ?? 0 })} className="text-right text-[12px]" aria-label={`Quantity, line ${i + 1}`} /></td>
                            <td className="px-1.5 py-1.5"><Input value={p.unitPrice ?? ''} inputMode="decimal" onChange={e => setProduct(i, { unitPrice: num(e.target.value) })} className="text-right text-[12px]" aria-label={`Unit price, line ${i + 1}`} /></td>
                            <td className="px-1.5 py-1.5"><Input value={p.totalPrice ?? ''} inputMode="decimal" onChange={e => setProduct(i, { totalPrice: num(e.target.value) })} className="text-right text-[12px]" aria-label={`Total, line ${i + 1}`} /></td>
                            <td className="px-1 py-1.5"><Button variant="ghost" size="icon-sm" aria-label={`Remove line ${i + 1}`} onClick={() => setProducts(prev => prev.filter((_, k) => k !== i))}><Trash2 /></Button></td>
                          </tr>
                        ) : (
                          <tr key={i} className="pf-fade-in border-b border-ui-divider last:border-b-0">
                            <td className="px-2 py-2 font-mono">{p.itemCode}</td>
                            <td className="px-2 py-2">{p.description}{p.category && <div className="text-[11px] text-ui-text-secondary">{p.category}</div>}</td>
                            <td className="px-2 py-2 text-right">{p.quantity}</td>
                            <td className="px-2 py-2 text-right">{p.unitPrice ?? '—'}</td>
                            <td className="px-2 py-2 text-right">{p.totalPrice ?? '—'}</td>
                            <td />
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-ui-divider bg-ui-page-bg font-semibold">
                          <td colSpan={2} className="px-2 py-2">
                            {editable && (
                              <Button size="xs" variant="outline" onClick={() => setProducts(prev => [...prev, { itemCode: '', description: '', category: null, quantity: 0, unitPrice: null, totalPrice: null }])}><Plus /> Add line</Button>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right">{qty}</td>
                          <td />
                          <td className="px-2 py-2 text-right">{sym}{total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}
