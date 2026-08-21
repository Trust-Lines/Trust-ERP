'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Loader2, Camera, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { VendorSelect } from '../production/VendorSelect';
import { AddVendorModal, type Vendor } from '../production/AddVendorModal';

interface DocItem {
  id:               string;
  photoBase64:      string | null;
  photoDropboxPath: string | null;
  itemCode:         string;
  description:      string;
  descriptionNote:  string;
  quantity:         number;
  unitPrice:        number | null;
  taking:           string;
  vendor:           string;
}

interface DocGroup      { id: string; label: string; items: DocItem[] }
interface DocSubCategory{ id: string; segmentNames: string[]; groups: DocGroup[] }
interface DocCategory   { id: string; name: string; subCategories: DocSubCategory[]; collapsed: boolean }
interface DocSection    { id: string; typeLabel: string; categories: DocCategory[] }

interface CatalogItem {
  id:               string;
  item_code:        string | null;
  description:      string;
  description_note: string | null;
  unit_price:       number | null;
  taking:           string | null;
  vendor:           string | null;
  photo_base64:     string | null;
}

interface Props {
  projectId:        string;
  catGroup:         string;
  docType:          'item_list' | 'price_list';
  initialSections?: RawPdfSection[];
  editDocumentId?:  string;
  onClose:          () => void;
  onGenerated:      () => void;
}

let _uid = 0;
function uid() { return `_${++_uid}`; }

function newItem(): DocItem {
  return { id: uid(), photoBase64: null, photoDropboxPath: null, itemCode: '', description: '', descriptionNote: '', quantity: 1, unitPrice: null, taking: '', vendor: '' };
}
function newGroup(label = ''): DocGroup    { return { id: uid(), label, items: [newItem()] }; }
function newSubCat(): DocSubCategory       { return { id: uid(), segmentNames: [''], groups: [newGroup()] }; }
function newCategory(name = ''): DocCategory { return { id: uid(), name, subCategories: [newSubCat()], collapsed: false }; }
function newSection(typeLabel = '', catName = ''): DocSection {
  return { id: uid(), typeLabel, categories: [newCategory(catName)] };
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function loadOptions(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(`docgen_${key}`) ?? '[]') as string[]; }
  catch { return []; }
}
function saveOption(key: string, value: string) {
  if (!value.trim()) return;
  const opts = loadOptions(key);
  if (!opts.includes(value)) {
    opts.unshift(value);
    localStorage.setItem(`docgen_${key}`, JSON.stringify(opts.slice(0, 20)));
  }
}
function deleteOption(key: string, value: string) {
  const opts = loadOptions(key).filter(o => o !== value);
  localStorage.setItem(`docgen_${key}`, JSON.stringify(opts));
}

interface CachedProduct { itemCode: string; description: string; descriptionNote: string; unitPrice: number | null; taking: string; vendor: string; photoBase64: string | null }
type CacheInput = { itemCode: string; description: string; descriptionNote: string; unitPrice: number | null; taking: string; vendor: string; photoBase64?: string | null }

function loadCachedProducts(): CachedProduct[] {
  try { return JSON.parse(localStorage.getItem('docgen_product_cache') ?? '[]') as CachedProduct[]; }
  catch { return []; }
}
function writeCachedProduct(item: CacheInput) {
  const existing = loadCachedProducts().find(p => p.itemCode.toLowerCase() === item.itemCode.toLowerCase());
  const cache = loadCachedProducts().filter(p => p.itemCode.toLowerCase() !== item.itemCode.toLowerCase());
  const photo = item.photoBase64 ?? existing?.photoBase64 ?? null;
  cache.unshift({ itemCode: item.itemCode, description: item.description, descriptionNote: item.descriptionNote, unitPrice: item.unitPrice, taking: item.taking, vendor: item.vendor, photoBase64: photo });
  localStorage.setItem('docgen_product_cache', JSON.stringify(cache.slice(0, 50)));
}
function getCachedProduct(code: string): CachedProduct | undefined {
  return loadCachedProducts().find(p => p.itemCode.toLowerCase() === code.toLowerCase());
}
function searchCachedProducts(code: string): CachedProduct[] {
  if (code.length < 1) return [];
  return loadCachedProducts().filter(p => p.itemCode.toLowerCase().includes(code.toLowerCase())).slice(0, 10);
}

function DropdownInput({ value, onChange, onBlur, placeholder, optionsKey, style, dark, bold, onSelectOption }: {
  value: string; onChange: (v: string) => void; onBlur?: (v: string) => void;
  placeholder?: string; optionsKey: string; style?: React.CSSProperties; dark?: boolean; bold?: boolean;
  onSelectOption?: (v: string) => void;
}) {
  const [open, setOpen]     = useState(false);
  const [opts, setOpts]     = useState<string[]>([]);
  const [rect, setRect]     = useState<DOMRect | null>(null);
  const wrapRef             = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpts(loadOptions(optionsKey)); }, [optionsKey]);
  useEffect(() => {
    function close(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function openDropdown() {
    setOpts(loadOptions(optionsKey));
    if (wrapRef.current) setRect(wrapRef.current.getBoundingClientRect());
    setOpen(true);
  }

  function removeOpt(o: string) {
    deleteOption(optionsKey, o);
    setOpts(prev => prev.filter(x => x !== o));
  }

  const filtered = opts.filter(o => o.toLowerCase().includes(value.toLowerCase()) && o !== value);

  const portal = open && filtered.length > 0 && rect && typeof document !== 'undefined'
    ? createPortal(
        <div style={{
          position: 'fixed', top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 240), maxWidth: 360,
          zIndex: 99999, background: '#fff', border: '1px solid #d0d0d0',
          borderRadius: 5, boxShadow: '0 6px 18px rgba(0,0,0,.22)', maxHeight: 240, overflowY: 'auto',
        }}>
          {filtered.map(o => (
            <div key={o} style={{ display: 'flex', alignItems: 'flex-start', background: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0f4ff')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <button type="button" onMouseDown={() => { if (onSelectOption) { onSelectOption(o); } else { onChange(o); if (onBlur) onBlur(o); } setOpen(false); }}
                style={{ flex: 1, minWidth: 0, textAlign: 'left', padding: '6px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#111', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35 }}>
                {o}
              </button>
              <button type="button" title="Delete saved entry"
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); removeOpt(o); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: '#dc2626', flexShrink: 0 }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )
    : null;

  const borderCol = dark ? 'rgba(255,255,255,0.25)' : 'var(--border-subtle)';
  const bgCol     = dark ? 'rgba(255,255,255,0.12)' : 'var(--bg-default)';
  const textCol   = dark ? '#fff' : 'var(--fg-default)';

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${borderCol}`, borderRadius: 4, background: bgCol }}>
        <input value={value} onChange={e => onChange(e.target.value)} onFocus={openDropdown}
          onBlur={() => { setTimeout(() => setOpen(false), 150); if (onBlur) onBlur(value); }}
          placeholder={placeholder}
          style={{ flex: 1, minWidth: 0, padding: '4px 6px', border: 'none', background: 'transparent', fontSize: dark ? 11 : 12, fontWeight: bold ? 700 : 400, outline: 'none', color: textCol }} />
        {opts.length > 0 && (
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { openDropdown(); setOpen(o => !o); }} style={{ background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer' }}>
            <ChevronDown size={11} color={dark ? '#ddd' : 'var(--fg-faint)'} />
          </button>
        )}
      </div>
      {portal}
    </div>
  );
}

type RawItem = { itemCode: string; description: string; descriptionNote: string; photoBase64: string | null; quantity: number; unitPrice: number | null; taking: string; vendor: string }
type RawGroup = { label: string; items: RawItem[] }
type RawSubCat = { segmentName: string; groups: RawGroup[] }
type RawCat = { name: string; subCategories: RawSubCat[] }
type RawPdfSection = { typeLabel: string; categories: RawCat[] }

function pdfToDocSections(raw: RawPdfSection[], stripPrices = false): DocSection[] {
  return raw.map(sec => ({
    id: uid(), typeLabel: sec.typeLabel,
    categories: sec.categories.map(cat => ({
      id: uid(), name: cat.name, collapsed: false,
      subCategories: cat.subCategories.map(sub => ({
        id: uid(), segmentNames: sub.segmentName ? [sub.segmentName] : [''],
        groups: sub.groups.map(grp => ({
          id: uid(), label: grp.label,
          items: grp.items.map(item => ({
            id: uid(), photoBase64: item.photoBase64 ?? null, photoDropboxPath: null,
            itemCode: item.itemCode, description: item.description, descriptionNote: item.descriptionNote,
            quantity: item.quantity, unitPrice: stripPrices ? null : (item.unitPrice ?? null),
            taking: item.taking, vendor: item.vendor,
          })),
        })),
      })),
    })),
  }));
}

export default function DocGeneratorModal({ projectId, catGroup, docType, initialSections, editDocumentId, onClose, onGenerated }: Props) {
  const showPrices = docType === 'price_list';
  const catLabel   = catGroup.charAt(0).toUpperCase() + catGroup.slice(1);

  const [sections, setSections] = useState<DocSection[]>(() =>
    initialSections?.length
      ? pdfToDocSections(initialSections, true)
      : [newSection(`${catLabel} & LIGHTING`, 'LIGHTING SYSTEMS')]
  );
  const [generating, setGenerating] = useState(false);

  interface ILVersion { id: string; version: number; file_name: string; form_data: RawPdfSection[] | null }
  const [ilVersions,     setIlVersions]     = useState<ILVersion[]>([]);
  const [selectedILVer,  setSelectedILVer]  = useState('');
  const [loadingVersion, setLoadingVersion] = useState(false);

  useEffect(() => {
    if (!showPrices) return;
    const lsKey  = `docgen_il_${projectId}_${catGroup}`;
    const lsData = (() => { try { return JSON.parse(localStorage.getItem(lsKey) ?? '[]') as ILVersion[]; } catch { return [] as ILVersion[]; } })();

    if (lsData.length > 0) setIlVersions(lsData);

    fetch(`/api/projects/${projectId}/doc-versions?doc_type=item_list&cat_group=${catGroup}`)
      .then(r => r.json())
      .then((j: { versions: ILVersion[] }) => {
        const dbVersions = j.versions ?? [];
        const dbIds   = new Set(dbVersions.map(v => v.version));
        const lsExtra = lsData.filter(v => !dbIds.has(v.version));
        const merged  = [...dbVersions, ...lsExtra].sort((a, b) => b.version - a.version);
        setIlVersions(merged.length > 0 ? merged : lsData);
      })
      .catch(() => { if (lsData.length === 0) setIlVersions([]); });
  }, [projectId, catGroup, showPrices]);

  function loadItemListVersion() {
    const ver = ilVersions.find(v => v.id === selectedILVer);
    if (!ver?.form_data?.length) return;
    setLoadingVersion(true);
    setSections(pdfToDocSections(ver.form_data, true));
    setLoadingVersion(false);
    toast.success(`V${ver.version} loaded — enter prices below`);
  }

  const [suggs, setSuggs]           = useState<CatalogItem[]>([]);
  const [activeSugg, setActiveSugg] = useState<{ id: string; field: 'desc' | 'code' } | null>(null);
  const [suggRect, setSuggRect]     = useState<DOMRect | null>(null);
  const sugRef                      = useRef<HTMLDivElement>(null);
  const debRef                      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef                = useRef<HTMLInputElement>(null);
  const pendingPhotoRef             = useRef<{ secId: string; catId: string; subId: string; grpId: string; itemId: string } | null>(null);
  const [photoUploading, setPhotoUploading] = useState<string | null>(null);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [addVendor, setAddVendor] = useState<{ path: { secId: string; catId: string; subId: string; grpId: string; itemId: string }; name: string } | null>(null);

  useEffect(() => {
    fetch('/api/production/vendors')
      .then(r => r.json())
      .then((j: { vendors?: Vendor[] }) => setVendors(j.vendors ?? []))
      .catch(() => setVendors([]));
  }, []);

  useEffect(() => {
    function close(e: MouseEvent) { if (sugRef.current && !sugRef.current.contains(e.target as Node)) { setSuggs([]); setActiveSugg(null); } }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const searchCatalog = useCallback((q: string, itemId: string) => {
    if (debRef.current) clearTimeout(debRef.current);
    if (q.length < 2) { setSuggs([]); return; }
    debRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/catalog-items?q=${encodeURIComponent(q)}&category=${catGroup}`);
        const json = await res.json() as { items: CatalogItem[] };
        setSuggs(json.items ?? []); setActiveSugg({ id: itemId, field: 'desc' });
      } catch { }
    }, 250);
  }, [catGroup]);

  const searchCatalogByCode = useCallback((code: string, itemId: string) => {
    if (debRef.current) clearTimeout(debRef.current);
    if (code.length < 1) { setSuggs([]); setActiveSugg(null); return; }

    const cachedToItem = (c: CachedProduct): CatalogItem => ({ id: c.itemCode, item_code: c.itemCode, description: c.description, description_note: c.descriptionNote || null, unit_price: c.unitPrice, taking: c.taking || null, vendor: c.vendor || null, photo_base64: c.photoBase64 ?? null });

    const cached = searchCachedProducts(code);
    if (cached.length > 0) {
      setSuggs(cached.map(cachedToItem)); setActiveSugg({ id: itemId, field: 'code' });
    }

    debRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/catalog-items?code=${encodeURIComponent(code)}&category=${catGroup}`);
        const json = await res.json() as { items: CatalogItem[] };
        const apiItems = json.items ?? [];
        const apiCodes = new Set(apiItems.map(i => (i.item_code ?? '').toLowerCase()));
        const cachedMerge = searchCachedProducts(code)
          .filter(c => !apiCodes.has(c.itemCode.toLowerCase()))
          .map(cachedToItem);
        setSuggs([...apiItems, ...cachedMerge]); setActiveSugg({ id: itemId, field: 'code' });
      } catch { }
    }, 250);
  }, [catGroup]);

  function addSection() {
    setSections(ss => [...ss, newSection('', '')]);
  }
  function removeSection(secId: string) {
    setSections(ss => ss.filter(s => s.id !== secId));
  }
  function updSectionType(secId: string, v: string) {
    setSections(ss => ss.map(s => s.id === secId ? { ...s, typeLabel: v } : s));
  }

  function updSectionCats(secId: string, fn: (cats: DocCategory[]) => DocCategory[]) {
    setSections(ss => ss.map(s => s.id === secId ? { ...s, categories: fn(s.categories) } : s));
  }
  function updCat(secId: string, catId: string, patch: Partial<DocCategory>) {
    updSectionCats(secId, cats => cats.map(c => c.id === catId ? { ...c, ...patch } : c));
  }
  function addCat(secId: string) {
    updSectionCats(secId, cats => [...cats, newCategory()]);
  }
  function removeCat(secId: string, catId: string) {
    updSectionCats(secId, cats => cats.filter(c => c.id !== catId));
  }

  function addSub(secId: string, catId: string) {
    updSectionCats(secId, cats => cats.map(c => c.id === catId ? { ...c, subCategories: [...c.subCategories, newSubCat()] } : c));
  }
  function removeSub(secId: string, catId: string, subId: string) {
    updSectionCats(secId, cats => cats.map(c => c.id === catId ? { ...c, subCategories: c.subCategories.filter(s => s.id !== subId) } : c));
  }
  function addSegName(secId: string, catId: string, subId: string) {
    updSectionCats(secId, cats => cats.map(c => c.id === catId ? { ...c, subCategories: c.subCategories.map(s => s.id === subId ? { ...s, segmentNames: [...(s.segmentNames ?? ['']), ''] } : s) } : c));
  }
  function removeSegName(secId: string, catId: string, subId: string, idx: number) {
    updSectionCats(secId, cats => cats.map(c => c.id === catId ? { ...c, subCategories: c.subCategories.map(s => s.id === subId ? { ...s, segmentNames: (s.segmentNames ?? ['']).filter((_, i) => i !== idx) } : s) } : c));
  }
  function updSegName(secId: string, catId: string, subId: string, idx: number, value: string) {
    updSectionCats(secId, cats => cats.map(c => c.id === catId ? { ...c, subCategories: c.subCategories.map(s => s.id === subId ? { ...s, segmentNames: (s.segmentNames ?? ['']).map((n, i) => i === idx ? value : n) } : s) } : c));
  }
  function setSegmentsFromString(secId: string, catId: string, subId: string, full: string) {
    const parts = full.split('/').map(p => p.trim()).filter(Boolean);
    const segs = parts.length ? parts : [''];
    if (parts.length) saveOption('segName_0', parts.join(' / '));
    updSectionCats(secId, cats => cats.map(c => c.id === catId ? { ...c, subCategories: c.subCategories.map(s => s.id === subId ? { ...s, segmentNames: segs } : s) } : c));
  }

  function addGroup(secId: string, catId: string, subId: string) {
    updSectionCats(secId, cats => cats.map(c => c.id === catId ? { ...c, subCategories: c.subCategories.map(s => s.id === subId ? { ...s, groups: [...s.groups, newGroup()] } : s) } : c));
  }
  function removeGroup(secId: string, catId: string, subId: string, grpId: string) {
    updSectionCats(secId, cats => cats.map(c => c.id === catId ? { ...c, subCategories: c.subCategories.map(s => s.id === subId ? { ...s, groups: s.groups.filter(g => g.id !== grpId) } : s) } : c));
  }
  function updGroup(secId: string, catId: string, subId: string, grpId: string, patch: Partial<DocGroup>) {
    updSectionCats(secId, cats => cats.map(c => c.id === catId ? { ...c, subCategories: c.subCategories.map(s => s.id === subId ? { ...s, groups: s.groups.map(g => g.id === grpId ? { ...g, ...patch } : g) } : s) } : c));
  }

  function addItemToGroup(secId: string, catId: string, subId: string, grpId: string) {
    updSectionCats(secId, cats => cats.map(c => c.id === catId ? { ...c, subCategories: c.subCategories.map(s => s.id === subId ? { ...s, groups: s.groups.map(g => g.id === grpId ? { ...g, items: [...g.items, newItem()] } : g) } : s) } : c));
  }
  function removeItem(secId: string, catId: string, subId: string, grpId: string, itemId: string) {
    updSectionCats(secId, cats => cats.map(c => c.id === catId ? { ...c, subCategories: c.subCategories.map(s => s.id === subId ? { ...s, groups: s.groups.map(g => g.id === grpId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g) } : s) } : c));
  }
  function updItem(secId: string, catId: string, subId: string, grpId: string, itemId: string, patch: Partial<DocItem>) {
    updSectionCats(secId, cats => cats.map(c => c.id === catId ? { ...c, subCategories: c.subCategories.map(s => s.id === subId ? { ...s, groups: s.groups.map(g => g.id === grpId ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, ...patch } : i) } : g) } : s) } : c));
  }

  function applySugg(secId: string, catId: string, subId: string, grpId: string, itemId: string, sug: CatalogItem) {
    const patch = { itemCode: sug.item_code ?? '', description: sug.description, descriptionNote: sug.description_note ?? '', unitPrice: sug.unit_price, taking: sug.taking ?? '', vendor: sug.vendor ?? '', ...(sug.photo_base64 ? { photoBase64: sug.photo_base64 } : {}) };
    updItem(secId, catId, subId, grpId, itemId, patch);
    if (sug.item_code) writeCachedProduct({ itemCode: sug.item_code, description: sug.description, descriptionNote: sug.description_note ?? '', unitPrice: sug.unit_price, taking: sug.taking ?? '', vendor: sug.vendor ?? '', photoBase64: sug.photo_base64 ?? null });
    setSuggs([]); setActiveSugg(null);
  }

  function triggerPhoto(secId: string, catId: string, subId: string, grpId: string, itemId: string) {
    pendingPhotoRef.current = { secId, catId, subId, grpId, itemId };
    fileInputRef.current?.click();
  }

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const ctx  = pendingPhotoRef.current;
    if (!file || !ctx) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setPhotoUploading(ctx.itemId);
      updItem(ctx.secId, ctx.catId, ctx.subId, ctx.grpId, ctx.itemId, { photoBase64: base64 });
      try {
        const res  = await fetch('/api/products/upload-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base64, filename: file.name }) });
        const json = await res.json() as { dropboxPath?: string };
        if (json.dropboxPath) updItem(ctx.secId, ctx.catId, ctx.subId, ctx.grpId, ctx.itemId, { photoDropboxPath: json.dropboxPath });
      } catch { }
      finally { setPhotoUploading(null); }
    };
    reader.readAsDataURL(file);
  }

  async function saveCatalogItem(item: DocItem) {
    if (!item.description.trim()) return;

    if (item.itemCode.trim()) {
      const existing = getCachedProduct(item.itemCode);
      const changed  = existing && (existing.description !== item.description || existing.unitPrice !== item.unitPrice);
      if (!existing) {
        writeCachedProduct({ itemCode: item.itemCode, description: item.description, descriptionNote: item.descriptionNote, unitPrice: item.unitPrice, taking: item.taking, vendor: item.vendor, photoBase64: item.photoBase64 });
      } else if (changed) {
        toast(`Item "${item.itemCode}" already saved — update with new data?`, {
          duration: 8000,
          action: {
            label: 'Update',
            onClick: () => writeCachedProduct({ itemCode: item.itemCode, description: item.description, descriptionNote: item.descriptionNote, unitPrice: item.unitPrice, taking: item.taking, vendor: item.vendor, photoBase64: item.photoBase64 }),
          },
        });
      }
    }

    try {
      await fetch('/api/catalog-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ item_code: item.itemCode || null, description: item.description, description_note: item.descriptionNote || null, category: catGroup, unit_price: item.unitPrice, taking: item.taking || null, vendor: item.vendor || null }] }) });
    } catch { }
  }

  const allItems = sections.flatMap(s => s.categories.flatMap(c => c.subCategories.flatMap(sub => sub.groups.flatMap(g => g.items))));
  const totalQty   = allItems.reduce((a, i) => a + (i.quantity || 0), 0);
  const totalPrice = allItems.reduce((a, i) => a + (i.quantity || 0) * (i.unitPrice ?? 0), 0);

  async function handleGenerate() {
    const hasItem = sections.some(s => s.categories.some(c => c.subCategories.some(sub => sub.groups.some(g => g.items.some(i => i.description.trim())))));
    if (!hasItem) { toast.error('Add at least one item'); return; }
    setGenerating(true);
    try {
      saveOption('typeLabel', sections[0]?.typeLabel ?? '');
      sections.forEach(s => {
        saveOption('typeLabel', s.typeLabel);
        s.categories.forEach(c => {
          saveOption('catName', c.name);
          c.subCategories.forEach(sub => {
            {
              const segs = (sub.segmentNames ?? []).map(x => x.trim());
              const full = segs.filter(Boolean).join(' / ');
              if (full) saveOption('segName_0', full);
              segs.forEach((n, i) => { if (i > 0 && n) saveOption(`segName_${i}`, n); });
            }
            sub.groups.forEach(g => {
              saveOption('groupLabel', g.label);
              g.items.forEach(i => { saveOption('taking', i.taking); saveOption('vendor', i.vendor); });
            });
          });
        });
      });

      const payload: Record<string, unknown> = {
        docType, catGroup, catBadge: catLabel, showPrices,
        ...(editDocumentId ? { documentId: editDocumentId } : {}),
        sections: sections.map(s => ({
          typeLabel: s.typeLabel,
          categories: s.categories.map(c => ({
            name: c.name || 'SECTION',
            subCategories: c.subCategories.map(sub => ({
              segmentName: (sub.segmentNames ?? ['']).filter(n => n.trim()).join(' / ') || '',
              groups: sub.groups.map(g => ({
                label: g.label,
                items: g.items.filter(i => i.description.trim()).map(i => ({
                  itemCode: i.itemCode, description: i.description, descriptionNote: i.descriptionNote,
                  photoBase64: i.photoBase64, quantity: i.quantity || 1, unitPrice: i.unitPrice,
                  taking: i.taking, vendor: i.vendor,
                })),
              })).filter(g => g.items.length > 0),
            })).filter(sub => sub.groups.length > 0),
          })).filter(c => c.subCategories.length > 0),
        })).filter(s => s.categories.length > 0),
      };

      const res  = await fetch(`/api/projects/${projectId}/generate-doc`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json() as { ok?: boolean; error?: string; version?: number; fileName?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Generation failed');

      if (docType === 'item_list') {
        try {
          const lsKey = `docgen_il_${projectId}_${catGroup}`;
          const prev  = JSON.parse(localStorage.getItem(lsKey) ?? '[]') as { id: string; version: number; file_name: string; form_data: RawPdfSection[] }[];
          const entry = { id: `ls_${Date.now()}`, version: json.version ?? 1, file_name: json.fileName ?? `Item List V${json.version}`, form_data: (payload.sections as unknown) as RawPdfSection[] };
          localStorage.setItem(lsKey, JSON.stringify([entry, ...prev.filter(p => p.version !== entry.version)].slice(0, 10)));
        } catch { }
      }

      toast.success(editDocumentId ? 'Revision saved — back to Stage 1 approval' : `V${json.version} generated and uploaded!`);
      onGenerated(); onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Generation failed');
    } finally { setGenerating(false); }
  }

  const inp: React.CSSProperties    = { padding: '3px 6px', fontSize: 12, border: '1px solid var(--border-subtle)', borderRadius: 4, background: 'var(--bg-default)', color: 'var(--fg-default)', outline: 'none', width: '100%' };
  const numInp: React.CSSProperties = { ...inp, textAlign: 'right', width: 70 };
  const thCell: React.CSSProperties = { padding: '5px 6px', fontSize: 10, fontWeight: 700, color: 'var(--fg-subtle)', textAlign: 'center', whiteSpace: 'nowrap' };

  return (
    <div style={{ background: 'var(--bg-default)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoFile} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)', borderRadius: '8px 8px 0 0' }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
          {editDocumentId ? '✏️ Edit & Resubmit' : (showPrices ? '📄 Price List' : '📋 Item List')} — {catLabel}
        </h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={16} color="var(--fg-muted)" /></button>
      </div>

      <div style={{ padding: '12px 16px' }}>

        {showPrices && ilVersions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 12, background: '#f0f4ff', border: '1px solid #c5d3ff', borderRadius: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#2255aa', whiteSpace: 'nowrap' }}>Load from Item List:</span>
            <select value={selectedILVer} onChange={e => setSelectedILVer(e.target.value)}
              style={{ flex: 1, padding: '4px 8px', fontSize: 12, border: '1px solid #c5d3ff', borderRadius: 4, background: '#fff', color: '#111', outline: 'none' }}>
              <option value="">— select a saved version —</option>
              {ilVersions.map(v => (
                <option key={v.id} value={v.id}>V{v.version} — {v.file_name.replace(/\.pdf$/i, '')}</option>
              ))}
            </select>
            <button type="button" onClick={loadItemListVersion} disabled={!selectedILVer || loadingVersion}
              style={{ padding: '4px 14px', fontSize: 12, fontWeight: 700, background: '#2255aa', color: '#fff', border: 'none', borderRadius: 4, cursor: selectedILVer ? 'pointer' : 'not-allowed', opacity: selectedILVer ? 1 : 0.5 }}>
              {loadingVersion ? 'Loading…' : 'Load'}
            </button>
          </div>
        )}

        {sections.map((sec, secIdx) => (
          <div key={sec.id} style={{ marginBottom: 16, border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#cc0000' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', minWidth: 36 }}>TYPE:</span>
              <DropdownInput
                value={sec.typeLabel}
                onChange={v => updSectionType(sec.id, v)}
                onBlur={v => saveOption('typeLabel', v)}
                placeholder="e.g. CEILING & LIGHTING"
                optionsKey="typeLabel"
              />
              {sections.length > 1 && (
                <button type="button" onClick={() => removeSection(sec.id)} style={{ background: 'none', border: 'none', color: '#ffcccc', cursor: 'pointer', padding: '2px 6px', fontSize: 13 }}>×</button>
              )}
            </div>

            <div style={{ padding: '8px' }}>
              {sec.categories.map((cat) => (
                <div key={cat.id} style={{ marginBottom: 10, border: '1px solid var(--border-subtle)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#2d3748', color: '#fff' }}>
                    <button type="button" onClick={() => updCat(sec.id, cat.id, { collapsed: !cat.collapsed })} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, fontSize: 12 }}>▼</button>
                    <DropdownInput
                      dark bold
                      value={cat.name}
                      onChange={v => updCat(sec.id, cat.id, { name: v })}
                      onBlur={() => saveOption('catName', cat.name)}
                      placeholder=""
                      optionsKey="catName"
                      style={{ flex: 1 }}
                    />
                    <button type="button" onClick={() => removeCat(sec.id, cat.id)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: 2 }}>×</button>
                  </div>

                  {!cat.collapsed && (
                    <div>
                      {cat.subCategories.map((sub) => (
                        <div key={sub.id} style={{ marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, padding: '5px 10px', background: '#555', color: '#fff' }}>
                            {(sub.segmentNames ?? ['']).map((name, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                {idx > 0 && <span style={{ color: '#ccc', fontSize: 13, margin: '0 4px', userSelect: 'none' }}>/</span>}
                                <DropdownInput
                                  dark
                                  value={name}
                                  onChange={v => updSegName(sec.id, cat.id, sub.id, idx, v)}
                                  onBlur={() => {
                                    if (idx === 0) {
                                      const full = (sub.segmentNames ?? []).map(x => x.trim()).filter(Boolean).join(' / ');
                                      if (full) saveOption('segName_0', full);
                                    } else {
                                      saveOption(`segName_${idx}`, name);
                                    }
                                  }}
                                  onSelectOption={v => v.includes('/')
                                    ? setSegmentsFromString(sec.id, cat.id, sub.id, v)
                                    : updSegName(sec.id, cat.id, sub.id, idx, v)}
                                  placeholder={idx === 0 ? 'Segment name (e.g. CEILING LIGHTING)' : 'Segment name'}
                                  optionsKey={`segName_${idx}`}
                                  style={{ flex: '0 0 auto', minWidth: idx === 0 ? 200 : 130, width: idx === 0 ? 220 : 150 }}
                                />
                                {(sub.segmentNames ?? ['']).length > 1 && (
                                  <button type="button" onClick={() => removeSegName(sec.id, cat.id, sub.id, idx)} style={{ background: 'none', border: 'none', color: '#ffaaaa', cursor: 'pointer', padding: '2px 5px', lineHeight: 1, fontSize: 14 }}>×</button>
                                )}
                              </div>
                            ))}
                            <button type="button" onClick={() => addSegName(sec.id, cat.id, sub.id)} style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.5)', borderRadius: 3, color: '#fff', cursor: 'pointer', padding: '2px 8px', fontSize: 11, whiteSpace: 'nowrap', marginLeft: 4 }}>+ Segment</button>
                            {cat.subCategories.length > 1 && (
                              <button type="button" onClick={() => removeSub(sec.id, cat.id, sub.id)} style={{ background: 'none', border: '1px solid #ff6b6b', borderRadius: 3, color: '#ff6b6b', cursor: 'pointer', padding: '2px 7px', fontSize: 11, whiteSpace: 'nowrap', marginLeft: 'auto' }}>✕ Remove</button>
                            )}
                          </div>

                          {sub.groups.map((grp) => (
                            <div key={grp.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 4, margin: '5px 8px', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>GROUP:</span>
                                <DropdownInput value={grp.label} onChange={v => updGroup(sec.id, cat.id, sub.id, grp.id, { label: v })} onBlur={v => saveOption('groupLabel', v)} placeholder="Group label (e.g. F.C)" optionsKey="groupLabel" style={{ flex: 1, maxWidth: 220 }} />
                                {sub.groups.length > 1 && (
                                  <button type="button" onClick={() => removeGroup(sec.id, cat.id, sub.id, grp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e53e3e', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <X size={11} /> Remove Group
                                  </button>
                                )}
                              </div>

                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                                      <th style={{ ...thCell, width: 38 }}>Photo</th>
                                      <th style={{ ...thCell, width: 88 }}>Item Code</th>
                                      <th style={{ ...thCell }}>Description</th>
                                      <th style={{ ...thCell, width: 60 }}>QTY</th>
                                      <th style={{ ...thCell, width: 90, opacity: showPrices ? 1 : 0.35 }}>Amount</th>
                                      <th style={{ ...thCell, width: 80, opacity: showPrices ? 1 : 0.35 }}>Total</th>
                                      <th style={{ ...thCell, width: 100 }}>Taking</th>
                                      <th style={{ ...thCell, width: 100 }}>Vendor</th>
                                      <th style={{ width: 24 }} />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {grp.items.map((item) => {
                                      const rowTotal    = (item.quantity || 0) * (item.unitPrice ?? 0);
                                      const isCodeSug   = activeSugg?.id === item.id && activeSugg?.field === 'code';
                                      const isDescSug   = activeSugg?.id === item.id && activeSugg?.field === 'desc';
                                      return (
                                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                                          <td style={{ padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            <button type="button" onClick={() => triggerPhoto(sec.id, cat.id, sub.id, grp.id, item.id)} style={{ width: 28, height: 28, background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                              {photoUploading === item.id ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : item.photoBase64 ? <img src={item.photoBase64} style={{ width: 28, height: 28, objectFit: 'cover' }} alt="" /> : <Camera size={11} color="var(--fg-faint)" />}
                                            </button>
                                          </td>

                                          <td style={{ padding: '4px 3px' }}>
                                            <input value={item.itemCode}
                                              onChange={e => { updItem(sec.id, cat.id, sub.id, grp.id, item.id, { itemCode: e.target.value }); searchCatalogByCode(e.target.value, item.id); setSuggRect((e.target as HTMLInputElement).getBoundingClientRect()); }}
                                              onFocus={e => { setSuggRect((e.target as HTMLInputElement).getBoundingClientRect()); if (item.itemCode.length >= 1) searchCatalogByCode(item.itemCode, item.id); }}
                                              onBlur={() => { setTimeout(() => { setSuggs([]); setActiveSugg(null); }, 150); void saveCatalogItem(item); }}
                                              placeholder="Code" style={{ ...inp, textTransform: 'uppercase', fontSize: 11 }} />
                                            {isCodeSug && suggs.length > 0 && suggRect && createPortal(
                                              <div ref={sugRef} style={{ position: 'fixed', top: suggRect.bottom + 2, left: suggRect.left, minWidth: Math.max(suggRect.width, 320), zIndex: 99999, background: '#fff', border: '1px solid #d0d0d0', borderRadius: 5, boxShadow: '0 6px 20px rgba(0,0,0,.22)', maxHeight: 260, overflowY: 'auto' }}>
                                                {suggs.map(sg => (
                                                  <button key={sg.id} type="button" onMouseDown={() => applySugg(sec.id, cat.id, sub.id, grp.id, item.id, sg)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', borderBottom: '1px solid #f0f0f0', background: 'none', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = '#f0f4ff')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                                    {sg.photo_base64
                                                      ? <img src={sg.photo_base64} style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 3, border: '1px solid #ddd', flexShrink: 0 }} alt="" />
                                                      : <div style={{ width: 34, height: 34, background: '#f0f0f0', borderRadius: 3, border: '1px solid #ddd', flexShrink: 0 }} />
                                                    }
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                                        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', textTransform: 'uppercase', color: '#111' }}>{sg.item_code}</span>
                                                        {showPrices && sg.unit_price != null && <span style={{ fontSize: 10, color: '#2255aa', fontWeight: 600 }}>${sg.unit_price.toLocaleString()}</span>}
                                                      </div>
                                                      <div style={{ fontSize: 10, color: '#cc0000', fontStyle: 'italic', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sg.description}</div>
                                                    </div>
                                                  </button>
                                                ))}
                                              </div>,
                                              document.body,
                                            )}
                                          </td>

                                          <td style={{ padding: '4px 3px', minWidth: 200 }}>
                                            <input value={item.description}
                                              onChange={e => { updItem(sec.id, cat.id, sub.id, grp.id, item.id, { description: e.target.value }); searchCatalog(e.target.value, item.id); setSuggRect((e.target as HTMLInputElement).getBoundingClientRect()); }}
                                              onFocus={e => { setSuggRect((e.target as HTMLInputElement).getBoundingClientRect()); if (item.description.length >= 2) searchCatalog(item.description, item.id); }}
                                              onBlur={() => { setTimeout(() => { setSuggs([]); setActiveSugg(null); }, 150); void saveCatalogItem(item); }}
                                              placeholder="Description (main) *" style={{ ...inp, color: '#cc0000', fontStyle: 'italic', marginBottom: 3 }} />
                                            <input value={item.descriptionNote} onChange={e => updItem(sec.id, cat.id, sub.id, grp.id, item.id, { descriptionNote: e.target.value })} placeholder="Notes (optional)" style={{ ...inp, fontSize: 10, color: 'var(--fg-subtle)' }} />
                                            {isDescSug && suggs.length > 0 && suggRect && createPortal(
                                              <div ref={sugRef} style={{ position: 'fixed', top: suggRect.bottom + 2, left: suggRect.left, minWidth: Math.max(suggRect.width, 280), zIndex: 99999, background: '#fff', border: '1px solid #d0d0d0', borderRadius: 5, boxShadow: '0 6px 20px rgba(0,0,0,.22)', maxHeight: 200, overflowY: 'auto' }}>
                                                {suggs.map(sg => (
                                                  <button key={sg.id} type="button" onMouseDown={() => applySugg(sec.id, cat.id, sub.id, grp.id, item.id, sg)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', borderBottom: '1px solid #f0f0f0', background: 'none', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = '#f0f4ff')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                                    <div style={{ fontSize: 11, fontWeight: 600, color: '#cc0000', fontStyle: 'italic' }}>{sg.description}</div>
                                                    <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                                                      {sg.item_code && <span style={{ fontSize: 10, color: '#555', fontFamily: 'monospace' }}>{sg.item_code}</span>}
                                                      {showPrices && sg.unit_price != null && <span style={{ fontSize: 10, color: '#2255aa', fontWeight: 600 }}>${sg.unit_price.toLocaleString()}</span>}
                                                    </div>
                                                  </button>
                                                ))}
                                              </div>,
                                              document.body,
                                            )}
                                          </td>

                                          <td style={{ padding: '4px 3px', verticalAlign: 'middle' }}>
                                            <input type="number" min={0} value={item.quantity || ''} onChange={e => updItem(sec.id, cat.id, sub.id, grp.id, item.id, { quantity: parseInt(e.target.value) || 0 })} style={{ ...numInp, width: 56 }} />
                                          </td>

                                          <td style={{ padding: '4px 3px', verticalAlign: 'middle' }}>
                                            <input type="number" min={0} step={100}
                                              value={item.unitPrice ?? ''}
                                              onChange={e => showPrices && updItem(sec.id, cat.id, sub.id, grp.id, item.id, { unitPrice: e.target.value ? parseFloat(e.target.value) : null })}
                                              onBlur={() => showPrices && void saveCatalogItem(item)}
                                              placeholder={showPrices ? '0.00' : '—'}
                                              disabled={!showPrices}
                                              style={{ ...numInp, opacity: showPrices ? 1 : 0.3, cursor: showPrices ? 'text' : 'default', background: showPrices ? undefined : 'transparent', border: showPrices ? undefined : '1px solid transparent' }} />
                                          </td>

                                          <td style={{ padding: '4px 3px', textAlign: 'right', fontSize: 11, color: 'var(--fg-subtle)', verticalAlign: 'middle', whiteSpace: 'nowrap', paddingRight: 8, opacity: showPrices ? 1 : 0.3 }}>
                                            {showPrices && rowTotal > 0 ? fmt(rowTotal) : '—'}
                                          </td>

                                          <td style={{ padding: '4px 3px', verticalAlign: 'middle' }}>
                                            <DropdownInput value={item.taking} onChange={v => updItem(sec.id, cat.id, sub.id, grp.id, item.id, { taking: v })} onBlur={v => { saveOption('taking', v); void saveCatalogItem(item); }} placeholder="Taking" optionsKey="taking" />
                                          </td>

                                          <td style={{ padding: '4px 3px', verticalAlign: 'middle' }}>
                                            <VendorSelect
                                              vendors={vendors}
                                              displayValue={item.vendor}
                                              width={130}
                                              onPick={v => updItem(sec.id, cat.id, sub.id, grp.id, item.id, { vendor: `${v.code} - ${v.name}` })}
                                              onClear={() => updItem(sec.id, cat.id, sub.id, grp.id, item.id, { vendor: '' })}
                                              onAddNew={name => setAddVendor({ path: { secId: sec.id, catId: cat.id, subId: sub.id, grpId: grp.id, itemId: item.id }, name })}
                                              onDeleted={vid => setVendors(prev => prev.filter(v => v.id !== vid))}
                                            />
                                          </td>

                                          <td style={{ padding: '4px 3px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            {grp.items.length > 1 && (
                                              <button type="button" onClick={() => removeItem(sec.id, cat.id, sub.id, grp.id, item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.5 }}><X size={11} /></button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              <div style={{ padding: '5px 10px' }}>
                                <button type="button" onClick={() => addItemToGroup(sec.id, cat.id, sub.id, grp.id)} style={{ fontSize: 11, color: 'var(--brand-teal)', background: 'none', border: '1px dashed var(--border-subtle)', borderRadius: 3, cursor: 'pointer', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Plus size={10} /> Item</button>
                              </div>
                            </div>
                          ))}

                          <div style={{ padding: '4px 8px 6px' }}>
                            <button type="button" onClick={() => addGroup(sec.id, cat.id, sub.id)} style={{ fontSize: 11, color: 'var(--fg-subtle)', background: 'var(--bg-subtle)', border: '1px dashed var(--border-subtle)', borderRadius: 3, cursor: 'pointer', padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Plus size={10} /> Group</button>
                          </div>
                        </div>
                      ))}

                      <div style={{ padding: '4px 10px 8px' }}>
                        <button type="button" onClick={() => addSub(sec.id, cat.id)} style={{ fontSize: 11, color: 'var(--fg-subtle)', background: 'none', border: '1px dashed var(--border-subtle)', borderRadius: 4, cursor: 'pointer', padding: '4px 12px', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Plus size={10} /> Add Sub-Category</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <button type="button" onClick={() => addCat(sec.id)} style={{ width: '100%', fontSize: 12, color: 'var(--fg-subtle)', background: 'none', border: '1px dashed var(--border-subtle)', borderRadius: 5, cursor: 'pointer', padding: '6px', textAlign: 'center' as const }}>+ Add Category</button>
            </div>
          </div>
        ))}

        <div style={{ marginBottom: 14 }}>
          <button type="button" onClick={addSection} style={{ width: '100%', fontSize: 12, color: '#cc0000', background: 'none', border: '2px dashed #cc000040', borderRadius: 5, cursor: 'pointer', padding: '8px', textAlign: 'center' as const, fontWeight: 600 }}>+ Add TYPE Section</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', background: '#f5c518', borderRadius: 4, padding: '8px 14px', fontWeight: 700, fontSize: 13, marginBottom: 14 }}>
          <span style={{ flex: 1 }}>TOTAL</span>
          <span style={{ marginRight: 24 }}>{totalQty} units</span>
          {showPrices && totalPrice > 0 && <span>{fmt(totalPrice)}</span>}
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Signatures &amp; Approvals</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 8 }}>
            {['Production Manager', 'Trust PM', 'Client PM'].map(label => (
              <div key={label} style={{ border: '1px solid #2255aa', borderRadius: 6, padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#2255aa', textTransform: 'uppercase', marginBottom: 24 }}>{label}</div>
                <div style={{ borderBottom: '1px solid #ccc', marginBottom: 6 }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)', borderRadius: '0 0 8px 8px' }}>
        <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
          {allItems.filter(i => i.description).length} items · {totalQty} units
          {showPrices && totalPrice > 0 && <span> · <strong style={{ color: 'var(--fg-default)' }}>{fmt(totalPrice)}</strong></span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn btn-secondary" disabled={generating}>Cancel</button>
          <button onClick={handleGenerate} className="btn btn-primary" disabled={generating} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {generating
              ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> {editDocumentId ? 'Saving Revision…' : 'Generating…'}</>
              : editDocumentId ? '✅ Update & Resubmit' : '⬇ Generate PDF'
            }
          </button>
        </div>
      </div>

      {addVendor && (
        <AddVendorModal
          initialName={addVendor.name}
          onClose={() => setAddVendor(null)}
          onCreated={vendor => {
            setVendors(prev => [...prev, vendor].sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '')));
            const { secId, catId, subId, grpId, itemId } = addVendor.path;
            updItem(secId, catId, subId, grpId, itemId, { vendor: `${vendor.code} - ${vendor.name}` });
            setAddVendor(null);
          }}
        />
      )}
    </div>
  );
}
