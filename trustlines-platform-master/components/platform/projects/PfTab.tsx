'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Loader2, Plus, X, FileText, Download, ExternalLink, Maximize2, Camera, PenLine, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import type { PdfSection, PdfItem } from '@/lib/pdf/PriceListPdf';
import type { DocumentRow } from './ProjectDetailClient';
import { DocumentApprovalRail } from '../approvals/DocumentApprovalRail';
import { AssemblyModal } from './AssemblyModal';
import { statusCellCss } from '@/lib/excel/projectsExcelExport';

const PF_STATUSES: { value: string; label: string; desc: string }[] = [
  { value: 'HOLD_PM',          label: 'HOLD / PM',        desc: 'Hold — Project Management' },
  { value: 'NOT_ORDERED',      label: 'NOT ORDERED',      desc: 'Not yet ordered' },
  { value: 'ORDERED',          label: 'ORDERED',          desc: 'Ordered — STD set to today' },
  { value: 'WAITING_PAYMENT',  label: 'WAITING PAYMENT',  desc: 'Awaiting payment' },
  { value: 'ASSEMBLY',         label: 'ASSEMBLY',         desc: 'In assembly' },
  { value: 'READY_TO_RECEIVE', label: 'READY TO RECEIVE', desc: 'Ready for delivery' },
  { value: 'RECEIVED',         label: 'RECEIVED',         desc: 'Received at facility' },
  { value: 'READY',            label: 'READY',            desc: 'Ready for installation — RDY set to today' },
  { value: 'SENT_TO_TLINES',   label: 'SENT TO TLINES',   desc: 'Sent to TLines' },
  { value: 'PARTIAL_SENT',     label: 'PARTIAL SENT',     desc: 'Partially sent' },
  { value: 'SENT',             label: 'SENT',             desc: 'Fully sent' },
];

const SignaturePad = dynamic(() => import('../SignaturePad').then(m => ({ default: m.SignaturePad })), { ssr: false });

const PF_STAGES = [
  { label: 'Production Manager', hint: 'Production Manager signature' },
  { label: 'Project Manager',    hint: 'Project Manager signature' },
  { label: 'General Manager',    hint: 'General Manager signature' },
  { label: 'Accountant',         hint: 'Optional · sign any time' },
];

interface Props {
  projectId: string;
  userId?: string;
  userRole?: string;
  userPerms?: import('@/lib/permissions/catalog').PermMap;
  catGroup:  string;
  categoryLabel: string;
  documents?: DocumentRow[];
  dropboxRootPath?: string | null;
  onSynced?: () => void;
}

interface ItemListVersion { id: string; version: number; dropbox_version: number | null; form_data: PdfSection[] | null }

function vendorCodeOf(vendorStr: string): string { return vendorStr.split(' - ')[0]?.trim() ?? vendorStr.trim(); }
function vendorNameOf(vendorStr: string): string { const p = vendorStr.split(' - '); return (p[1] ?? p[0] ?? '').trim(); }

function pfTypeFromCode(code: string): string {
  const sfx = code.split('-').pop()?.toUpperCase() ?? '';
  switch (sfx) {
    case 'M01': return 'Standard / Basic';
    case 'M02': return 'Standard / Selective';
    case 'M03': return 'Selective / Custom';
    case 'F01': return 'Furniture';
    default:    return '';
  }
}

function suffixForType(t: string | null): string {
  const o = (t ?? '').toUpperCase().replace(/\s+/g, '');
  if (o.includes('FURNITURE'))                            return 'F01';
  if (o.includes('SELECTIVE') && o.includes('CUSTOM'))    return 'M03';
  if (o.includes('STANDARD')  && o.includes('SELECTIVE')) return 'M02';
  if (o.includes('STANDARD')  && o.includes('BASIC'))     return 'M01';
  return '';
}
const suffixOfCode = (code: string) => code.split('-').pop()?.toUpperCase() ?? '';

function blankSections(catGroup: string, vendor: string): PdfSection[] {
  return [{
    typeLabel: catGroup.toUpperCase(),
    categories: [{
      name: 'ITEMS',
      subCategories: [{
        segmentName: '',
        groups: [{ label: '', items: [{ itemCode: '', description: '', descriptionNote: '', photoBase64: null, quantity: 1, unitPrice: null, taking: '', vendor }] }],
      }],
    }],
  }];
}

function filterSectionsByVendor(sections: PdfSection[], vendor: string): PdfSection[] {
  return sections.map(sec => ({
    ...sec,
    categories: sec.categories.map(cat => ({
      ...cat,
      subCategories: cat.subCategories.map(sub => ({
        ...sub,
        groups: sub.groups.map(grp => ({
          ...grp,
          items: grp.items.filter(i => i.vendor === vendor && i.description.trim()).map(i => ({ ...i })),
        })).filter(grp => grp.items.length > 0),
      })).filter(sub => sub.groups.length > 0),
    })).filter(cat => cat.subCategories.length > 0),
  })).filter(sec => sec.categories.length > 0);
}

export function PfTab({ projectId, userId, userRole, userPerms, catGroup, categoryLabel, documents = [], onSynced }: Props) {
  const [loading, setLoading]   = useState(true);
  const [itemList, setItemList] = useState<PdfSection[]>([]);
  const [priceList, setPriceList] = useState<PdfSection[]>([]);
  const [activeVendor, setActiveVendor] = useState<string | null>(null);
  const [editSections, setEditSections] = useState<PdfSection[]>([]);
  const [orderType, setOrderType] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingPhotoRef = useRef<{ si: number; ci: number; sbi: number; gi: number; ii: number } | null>(null);
  const [userSig, setUserSig] = useState<string | null | undefined>(undefined);
  const [pfCacheBust, setPfCacheBust] = useState(0);
  const [showSigPad, setShowSigPad] = useState(false);
  const pendingApproveRef = useRef<(() => void) | null>(null);
  const [pfStatus, setPfStatus] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [showAssembly, setShowAssembly] = useState(false);
  const [etdOpen, setEtdOpen] = useState(false);
  const [etdValue, setEtdValue] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ilRes, plRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/doc-versions?doc_type=item_list&cat_group=${catGroup}`),
        fetch(`/api/projects/${projectId}/doc-versions?doc_type=price_list&cat_group=${catGroup}`),
      ]);
      const ilJson = await ilRes.json() as { versions?: ItemListVersion[] };
      const plJson = await plRes.json() as { versions?: ItemListVersion[] };
      const pickLatest = (vs: ItemListVersion[]) => vs.sort((a, b) => (b.dropbox_version ?? b.version) - (a.dropbox_version ?? a.version))[0];
      setItemList(pickLatest(ilJson.versions ?? [])?.form_data ?? []);
      setPriceList(pickLatest(plJson.versions ?? [])?.form_data ?? []);
    } catch { setItemList([]); setPriceList([]); }
    finally { setLoading(false); }
  }, [projectId, catGroup]);

  useEffect(() => { void load(); }, [load]);

  const vendors = useMemo(() => {
    const set = new Set<string>();
    for (const sec of itemList)
      for (const cat of sec.categories)
        for (const sub of cat.subCategories)
          for (const grp of sub.groups)
            for (const it of grp.items)
              if (it.vendor?.trim()) set.add(it.vendor.trim());
    return [...set].sort();
  }, [itemList]);

  useEffect(() => {
    if (vendors.length && (!activeVendor || !vendors.includes(activeVendor))) setActiveVendor(vendors[0]);
  }, [vendors, activeVendor]);

  const vendorSections = useMemo(() => activeVendor ? filterSectionsByVendor(itemList, activeVendor) : [], [activeVendor, itemList]);
  const vendorTypes = useMemo(() => [...new Set(vendorSections.map(s => s.typeLabel?.trim()).filter(Boolean))] as string[], [vendorSections]);
  const [activeType, setActiveType] = useState<string | null>(null);
  useEffect(() => {
    if (vendorTypes.length && (!activeType || !vendorTypes.includes(activeType))) setActiveType(vendorTypes[0]);
    if (!vendorTypes.length) setActiveType(null);
  }, [vendorTypes, activeType]);

  useEffect(() => {
    if (activeType) setOrderType(activeType);
  }, [activeType]);

  const priceMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const sec of priceList)
      for (const cat of sec.categories)
        for (const sub of cat.subCategories)
          for (const grp of sub.groups)
            for (const it of grp.items) {
              if (it.unitPrice == null) continue;
              const byCode = it.itemCode?.trim().toUpperCase();
              const byDesc = it.description?.trim().toUpperCase();
              if (byCode) m.set(`C:${byCode}`, it.unitPrice);
              if (byDesc) m.set(`D:${byDesc}`, it.unitPrice);
            }
    return m;
  }, [priceList]);

  const enrichPrices = useCallback((secs: PdfSection[]): PdfSection[] => secs.map(sec => ({
    ...sec,
    categories: sec.categories.map(cat => ({
      ...cat,
      subCategories: cat.subCategories.map(sub => ({
        ...sub,
        groups: sub.groups.map(grp => ({
          ...grp,
          items: grp.items.map(it => {
            if (it.unitPrice != null) return it;
            const byCode = it.itemCode?.trim().toUpperCase();
            const byDesc = it.description?.trim().toUpperCase();
            const price = (byCode ? priceMap.get(`C:${byCode}`) : undefined) ?? (byDesc ? priceMap.get(`D:${byDesc}`) : undefined);
            return price != null ? { ...it, unitPrice: price } : it;
          }),
        })),
      })),
    })),
  })), [priceMap]);

  useEffect(() => {
    if (!activeVendor) return;
    const secs = activeType ? vendorSections.filter(s => (s.typeLabel?.trim() || '') === activeType) : vendorSections;
    setEditSections(secs.length ? enrichPrices(secs) : blankSections(catGroup, activeVendor));
  }, [activeVendor, activeType, vendorSections, catGroup, enrichPrices]);

  function updItem(si: number, ci: number, sbi: number, gi: number, ii: number, patch: Partial<PdfItem>) {
    setEditSections(prev => prev.map((sec, s) => s !== si ? sec : {
      ...sec, categories: sec.categories.map((cat, c) => c !== ci ? cat : {
        ...cat, subCategories: cat.subCategories.map((sub, sb) => sb !== sbi ? sub : {
          ...sub, groups: sub.groups.map((grp, g) => g !== gi ? grp : {
            ...grp, items: grp.items.map((it, i) => i !== ii ? it : { ...it, ...patch }),
          }),
        }),
      }),
    }));
  }
  function removeItem(si: number, ci: number, sbi: number, gi: number, ii: number) {
    setEditSections(prev => prev.map((sec, s) => s !== si ? sec : {
      ...sec, categories: sec.categories.map((cat, c) => c !== ci ? cat : {
        ...cat, subCategories: cat.subCategories.map((sub, sb) => sb !== sbi ? sub : {
          ...sub, groups: sub.groups.map((grp, g) => g !== gi ? grp : {
            ...grp, items: grp.items.filter((_, i) => i !== ii),
          }),
        }),
      }),
    }));
  }
  function addItem(si: number, ci: number, sbi: number, gi: number) {
    const blank: PdfItem = { itemCode: '', description: '', descriptionNote: '', photoBase64: null, quantity: 1, unitPrice: null, taking: '', vendor: activeVendor ?? '' };
    setEditSections(prev => prev.map((sec, s) => s !== si ? sec : {
      ...sec, categories: sec.categories.map((cat, c) => c !== ci ? cat : {
        ...cat, subCategories: cat.subCategories.map((sub, sb) => sb !== sbi ? sub : {
          ...sub, groups: sub.groups.map((grp, g) => g !== gi ? grp : { ...grp, items: [...grp.items, blank] }),
        }),
      }),
    }));
  }

  function triggerPhoto(si: number, ci: number, sbi: number, gi: number, ii: number) {
    pendingPhotoRef.current = { si, ci, sbi, gi, ii };
    fileInputRef.current?.click();
  }
  function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const ctx  = pendingPhotoRef.current;
    if (!file || !ctx) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = ev => {
      const base64 = ev.target?.result as string;
      updItem(ctx.si, ctx.ci, ctx.sbi, ctx.gi, ctx.ii, { photoBase64: base64 });
      fetch('/api/products/upload-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base64, filename: file.name }) }).catch(() => {});
    };
    reader.readAsDataURL(file);
  }

  const itemCount = editSections.flatMap(s => s.categories.flatMap(c => c.subCategories.flatMap(sb => sb.groups.flatMap(g => g.items)))).length;

  const PF_PREREQS: { type: string; label: string; scoped: boolean }[] = [
    { type: 'plan_layout', label: 'Plan Layout',     scoped: false },
    { type: 'item_list',   label: 'Item List',       scoped: true  },
    { type: 'price_list',  label: 'Item Price List', scoped: true  },
    { type: 'book',        label: 'Book',            scoped: true  },
    { type: 'po_bo',       label: 'PO',              scoped: true  },
  ];
  const pendingPrereqs = PF_PREREQS.filter(p =>
    !documents.some(d => d.doc_type === p.type && (p.scoped ? d.cat_group === catGroup : true) && d.status === 'approved'),
  );
  const canCreatePf = pendingPrereqs.length === 0;

  const vendorCode = activeVendor ? vendorCodeOf(activeVendor) : '';
  const pfDocs = useMemo(() => {
    if (!vendorCode) return [] as DocumentRow[];
    const activeSfx = suffixForType(activeType);
    const validSfx  = new Set(vendorTypes.map(suffixForType).filter(Boolean));
    return documents
      .filter(d => d.doc_type === 'pf' && d.cat_group === catGroup && d.file_name.includes(vendorCode))
      .filter(d => {
        if (!activeSfx) return true;
        const sfx = suffixOfCode(d.file_name.split(' - PF')[0]);
        return sfx === activeSfx || !validSfx.has(sfx);
      })
      .sort((a, b) => (b.dropbox_version ?? b.version) - (a.dropbox_version ?? a.version));
  }, [documents, vendorCode, catGroup, activeType, vendorTypes]);

  useEffect(() => {
    if (pfDocs.length && (!selectedDocId || !pfDocs.some(d => d.id === selectedDocId))) {
      setSelectedDocId(pfDocs[0].id);
      setShowEditor(false);
    }
    if (!pfDocs.length) { setSelectedDocId(null); setShowEditor(true); }
  }, [pfDocs, selectedDocId]);

  const selectedDoc = pfDocs.find(d => d.id === selectedDocId) ?? null;
  const proxyUrl = selectedDoc ? `/api/files/proxy/${encodeURIComponent(selectedDoc.file_name)}?documentId=${selectedDoc.id}${pfCacheBust ? `&t=${pfCacheBust}` : ''}` : null;

  useEffect(() => {
    fetch('/api/user/signature').then(r => r.json()).then((j: { base64?: string | null }) => setUserSig(j.base64 ?? null)).catch(() => setUserSig(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dropbox/check-revisions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, docType: 'pf', catGroup }),
        });
        if (!res.ok) return;
        const json = await res.json() as { revisions?: { fileName: string }[] };
        if (!cancelled && json.revisions?.length) {
          toast.info(`PF changed in Dropbox: ${json.revisions.map(r => r.fileName).join(', ')} — signatures cleared, approval reset`, { duration: 7000 });
          setPfCacheBust(Date.now());
          onSynced?.();
        }
      } catch { }
    })();
    return () => { cancelled = true; };
   
  }, [projectId, catGroup]);

  useEffect(() => {
    if (!activeVendor) { setPfStatus(null); return; }
    let cancelled = false;
    fetch(`/api/projects/${projectId}/pf-status?catGroup=${catGroup}&vendorCode=${vendorCodeOf(activeVendor)}`)
      .then(r => r.json()).then((j: { status?: string | null }) => { if (!cancelled) setPfStatus(j.status ?? null); })
      .catch(() => { if (!cancelled) setPfStatus(null); });
    return () => { cancelled = true; };
  }, [activeVendor, projectId, catGroup, selectedDocId]);

  function setStatus(status: string) {
    if (!activeVendor) return;
    if (status === 'ORDERED') {
      const today = new Date().toISOString().slice(0, 10);
      setEtdValue(v => v || today);
      setEtdOpen(true);
      return;
    }
    void applyStatus(status);
  }

  async function applyStatus(status: string, etd?: string) {
    if (!activeVendor) return;
    setStatusBusy(true);
    const prev = pfStatus;
    setPfStatus(status);
    try {
      const res = await fetch(`/api/projects/${projectId}/pf-status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catGroup, vendorCode: vendorCodeOf(activeVendor), status, etd }),
      });
      if (!res.ok) {
        const err = (await res.json() as { error?: string }).error ?? 'Failed';
        throw new Error(err === 'ETD_REQUIRED' ? 'ETD is required for ORDERED' : err);
      }
      const MSG: Record<string, string> = {
        ORDERED:          'ORDERED — STD set to today, ETD saved',
        WAITING_PAYMENT:  'WAITING PAYMENT — accountant notified',
        READY_TO_RECEIVE: 'READY TO RECEIVE — accountant asked to pay the balance',
        READY:            'READY — Client PM notified',
      };
      toast.success(MSG[status] ?? `Status → ${status.replace(/_/g, ' ')}`);
      if (status === 'ASSEMBLY') setShowAssembly(true);
      onSynced?.();
    } catch (e) {
      setPfStatus(prev);
      toast.error(e instanceof Error ? e.message : 'Status update failed');
    } finally { setStatusBusy(false); }
  }

  async function editSelectedDraft() {
    if (!selectedDoc) return;
    setShowEditor(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/${selectedDoc.id}`);
      if (!res.ok) return;
      const doc = await res.json() as { form_data?: PdfSection[]; pf_meta?: { orderTypeLabel?: string } };
      if (doc.form_data?.length) setEditSections(doc.form_data);
      if (doc.pf_meta?.orderTypeLabel) setOrderType(doc.pf_meta.orderTypeLabel);
    } catch { }
  }

  async function deletePf(docId: string, code: string) {
    if (!window.confirm(`Delete ${code}? This removes the draft and its Dropbox file.`)) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? 'Failed');
      toast.success(`${code} deleted`);
      if (selectedDocId === docId) { setSelectedDocId(null); setShowEditor(true); }
      onSynced?.();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed'); }
  }

  async function openInDropbox() {
    if (!selectedDoc) return;
    try {
      const res = await fetch(`/api/files/view?documentId=${selectedDoc.id}`);
      const data = await res.json() as { link?: string };
      if (data.link) window.open(data.link, '_blank');
    } catch { }
  }

  async function generate() {
    if (!activeVendor) return;
    if (!itemCount) { toast.error('No items to generate'); return; }
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-pf`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catGroup, vendorCode: vendorCodeOf(activeVendor), vendorName: vendorNameOf(activeVendor),
          orderType, typeLabel: activeType ?? '', sections: editSections,
        }),
      });
      const json = await res.json() as { ok?: boolean; documentId?: string; pfCode?: string; version?: number; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Failed');
      toast.success(`PF generated — ${json.pfCode} (V${json.version}, draft)`);
      if (json.documentId) setSelectedDocId(json.documentId);
      setShowEditor(false);
      onSynced?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Generate failed');
    } finally { setGenerating(false); }
  }

  async function generateAllTypes() {
    if (!activeVendor) return;
    const types = vendorTypes.length ? vendorTypes : [activeType];
    setGenerating(true);
    try {
      let lastId: string | null = null; let made = 0;
      for (const t of types) {
        const secs = t ? vendorSections.filter(s => (s.typeLabel?.trim() || '') === t) : vendorSections;
        const enriched = secs.length ? enrichPrices(secs) : [];
        const cnt = enriched.flatMap(s => s.categories.flatMap(c => c.subCategories.flatMap(sb => sb.groups.flatMap(g => g.items)))).length;
        if (!cnt) continue;
        const res = await fetch(`/api/projects/${projectId}/generate-pf`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            catGroup, vendorCode: vendorCodeOf(activeVendor), vendorName: vendorNameOf(activeVendor),
            orderType: t ?? '', typeLabel: t ?? '', sections: enriched,
          }),
        });
        const json = await res.json() as { ok?: boolean; documentId?: string; error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? 'Failed');
        if (json.documentId) lastId = json.documentId;
        made++;
      }
      if (lastId) setSelectedDocId(lastId);
      setShowEditor(false);
      toast.success(`Generated ${made} PF${made !== 1 ? 's' : ''} — one per type`);
      onSynced?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Generate failed');
    } finally { setGenerating(false); }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--fg-subtle)' }} /></div>;
  }
  if (!vendors.length) {
    return (
      <div className="card"><div className="card-body" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--fg-subtle)' }}>
        <FileText size={26} style={{ color: 'var(--fg-faint)', marginBottom: 8 }} />
        <div style={{ fontSize: 13, fontWeight: 600 }}>No vendors in the {categoryLabel} Item List yet</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>Add vendors to items in the Item List — a PF sub-tab opens here for each vendor.</div>
      </div></div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="text-eyebrow">Production Form</div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{categoryLabel} PF</h3>
        </div>
        <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>Multiple PFs per vendor (by order type) · pre-filled from the Item List · review, generate, then each version is approved</div>
      </div>

      {!canCreatePf && (
        <div style={{ margin: '0 14px 12px', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>Drafts OK — signing locked until these are approved</div>
          <div style={{ fontSize: 11, color: '#b45309', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {pendingPrereqs.map(p => (
              <span key={p.type} style={{ padding: '2px 8px', borderRadius: 99, background: '#fef3c7', fontWeight: 600 }}>{p.label}</span>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: '#a16207', marginTop: 5 }}>You can generate &amp; preview the PF draft now. The signature chain opens once the {categoryLabel} Plan Layout, Item List, Item Price List, Book and PO are approved (V0).</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border-subtle)', padding: '0 14px', overflowX: 'auto' }}>
        {vendors.map(v => {
          const active = v === activeVendor;
          return (
            <button key={v} onClick={() => setActiveVendor(v)} style={{
              padding: '8px 14px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 12, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap',
              color: active ? 'var(--brand-teal, #1a6b6b)' : 'var(--fg-muted)',
              borderBottom: `2px solid ${active ? 'var(--brand-teal, #1a6b6b)' : 'transparent'}`, marginBottom: -1,
            }}>{vendorCodeOf(v)} <span style={{ color: 'var(--fg-faint)', fontWeight: 400 }}>{vendorNameOf(v)}</span></button>
          );
        })}
      </div>

      {vendorTypes.length > 1 && (
        <div style={{ display: 'flex', gap: 2, padding: '6px 14px 0', overflowX: 'auto', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-faint)', textTransform: 'uppercase', marginRight: 4 }}>Type:</span>
          {vendorTypes.map(t => {
            const active = t === activeType;
            return (
              <button key={t} onClick={() => { setActiveType(t); setShowEditor(true); setSelectedDocId(null); }} style={{
                padding: '4px 11px', borderRadius: 99, border: `1px solid ${active ? 'var(--brand-teal, #1a6b6b)' : 'var(--border-default)'}`,
                background: active ? '#f0fdfa' : '#fff', color: active ? 'var(--brand-teal, #1a6b6b)' : 'var(--fg-muted)',
                fontSize: 11, fontWeight: active ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>{t}</button>
            );
          })}
        </div>
      )}

      <div className="card-body" style={{ padding: 0 }}>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoFile} />
        <div style={{ display: 'flex', minHeight: 580 }}>
          <div style={{ width: 252, borderRight: '1px solid var(--border-subtle)', flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-subtle)' }}>
            <div style={{ padding: 12, borderBottom: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => { if (activeVendor) { const f = filterSectionsByVendor(itemList, activeVendor); const ft = activeType ? f.filter(s => (s.typeLabel?.trim() || '') === activeType) : f; setEditSections(ft.length ? enrichPrices(ft) : blankSections(catGroup, activeVendor)); } setShowEditor(true); setSelectedDocId(null); }}
                style={{
                  width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 12px', borderRadius: 8, border: 'none', background: '#1a2b4b', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}><Plus size={14} /> New PF</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 8px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Production Forms</span>
                {vendorTypes.length > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--fg-faint)' }}>{vendorTypes.length} type{vendorTypes.length !== 1 ? 's' : ''}</span>
                )}
              </div>
              {pfDocs.length === 0 && <div style={{ fontSize: 11, color: 'var(--fg-faint)', padding: 6, lineHeight: 1.5 }}>None yet — prepare one with “New PF”, or use “Generate all {Math.max(vendorTypes.length, 1)} types”.</div>}
              {pfDocs.map(d => {
                const v = d.dropbox_version ?? d.version;
                const code = d.file_name.split(' - PF')[0];
                const tlabel = pfTypeFromCode(code);
                const active = !showEditor && d.id === selectedDocId;
                return (
                  <div key={d.id} onClick={() => { setSelectedDocId(d.id); setShowEditor(false); }} style={{
                    position: 'relative', width: '100%', textAlign: 'left', display: 'block', padding: '8px 10px', marginBottom: 5, borderRadius: 7, cursor: 'pointer',
                    border: `1px solid ${active ? 'var(--brand-teal, #1a6b6b)' : 'var(--border-subtle)'}`,
                    background: active ? '#f0fdfa' : '#fff', boxShadow: active ? '0 1px 4px rgba(26,107,107,.18)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{code}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand-teal, #1a6b6b)', flexShrink: 0 }}>V{v}</span>
                    </div>
                    {tlabel && <div style={{ marginTop: 3, fontSize: 9, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: 0.2 }}>{tlabel}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }}>
                      <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: d.status === 'approved' ? '#dcfce7' : '#fef3c7', color: d.status === 'approved' ? '#15803d' : '#b45309' }}>{d.status === 'draft' ? 'DRAFT' : d.status.toUpperCase()}</span>
                      {d.status !== 'approved' && (
                        <button onClick={e => { e.stopPropagation(); void deletePf(d.id, code); }} title="Delete this PF" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 2, lineHeight: 0 }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, padding: 14, overflowX: 'auto' }}>
          {!showEditor && selectedDoc && proxyUrl ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-default)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedDoc.file_name}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {selectedDoc.status === 'draft' && (
                    <button onClick={editSelectedDraft} style={{ ...pfLink, color: 'var(--brand-teal, #1a6b6b)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}><PenLine size={12} /> Edit</button>
                  )}
                  <a href={proxyUrl} download style={pfLink}><Download size={12} /> Download</a>
                  <button onClick={openInDropbox} style={{ ...pfLink, background: 'none', border: 'none', cursor: 'pointer' }}><ExternalLink size={12} /> Dropbox</button>
                  <a href={proxyUrl} target="_blank" rel="noreferrer" style={pfLink}><Maximize2 size={12} /> Full</a>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <iframe key={`${selectedDoc.id}-${pfCacheBust}`} src={proxyUrl} title={selectedDoc.file_name} style={{ flex: 1, minWidth: 0, height: 660, border: '1px solid var(--border-subtle)', borderRadius: 8, background: '#e8eaed' }} />
                <div style={{ width: 234, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 12px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>Actions</div>
                    <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 1 }}>Production status · flows to the board</div>
                  </div>
                  <div style={{ padding: 8 }}>
                    {PF_STATUSES.map((st, i) => {
                      const active = pfStatus === st.value;
                      const css = statusCellCss(st.label);
                      return (
                        <button key={st.value} onClick={() => setStatus(st.value)} disabled={statusBusy}
                          style={{
                            width: '100%', textAlign: 'left', display: 'block',
                            padding: '6px 9px', marginBottom: 3, borderRadius: 5, cursor: statusBusy ? 'default' : 'pointer',
                            border: `1px solid ${active ? '#111' : 'var(--border-subtle)'}`,
                            background: active && css ? css.bg : '#fff', color: active && css ? css.fg : 'var(--fg-default)',
                          }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 9, fontWeight: 800, opacity: 0.55, width: 14, flexShrink: 0 }}>{i + 1}</span>
                            <span style={{ fontWeight: active ? 800 : 600, fontSize: 11 }}>{st.label}</span>
                          </div>
                          <div style={{ fontSize: 9, marginLeft: 22, marginTop: 1, opacity: active ? 0.85 : 0.55 }}>{st.desc}</div>
                        </button>
                      );
                    })}
                    {pfStatus === 'ASSEMBLY' && (
                      <button onClick={() => setShowAssembly(true)} style={{ width: '100%', marginTop: 6, padding: '7px 9px', borderRadius: 6, border: '1px solid #1a6b6b', background: '#f0fdfa', color: '#1a6b6b', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        🔗 Open assembly relationships
                      </button>
                    )}
                    {pfStatus === 'RECEIVED' && (
                      <button onClick={() => toast.info('QC step — coming soon')} style={{ width: '100%', marginTop: 6, padding: '7px 9px', borderRadius: 6, border: '1px solid #d97706', background: '#fffbeb', color: '#b45309', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        ✅ QC (quality check)
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 12px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>Document Approval</div>
                    <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 1 }}>Approved after General Manager · Accountant optional</div>
                  </div>
                  {userSig === null && canCreatePf && (
                    <div style={{ fontSize: 10, color: '#b45309', background: '#fffbeb', padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
                      ✍️ You&apos;ll draw your signature before approving.
                    </div>
                  )}
                  <div style={{ padding: 12 }}>
                    {canCreatePf ? (
                      <DocumentApprovalRail
                        projectId={projectId}
                        documentId={selectedDoc.id}
                        docType="pf"
                        catGroup={catGroup}
                        versionNum={selectedDoc.dropbox_version ?? selectedDoc.version}
                        userId={userId ?? ''}
                        userPerms={userPerms}
                        userSignature={userSig}
                        stages={PF_STAGES}
                        onNeedSignature={cb => { pendingApproveRef.current = cb; setShowSigPad(true); }}
                        onChanged={() => { setPfCacheBust(Date.now()); onSynced?.(); }}
                      />
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--fg-faint)', lineHeight: 1.6 }}>
                        🔒 Signing opens once these are approved:
                        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {pendingPrereqs.map(p => <span key={p.type} style={{ padding: '2px 7px', borderRadius: 99, background: '#fef3c7', color: '#b45309', fontWeight: 600 }}>{p.label}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                </div>
              </div>
            </div>
          ) : showEditor ? (<>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ color: 'var(--fg-muted)', fontWeight: 600 }}>Type</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
              {activeType || catGroup.toUpperCase()}
            </span>
            <span style={{ fontSize: 10, color: 'var(--fg-faint)' }}>from the Item List section · drives the PF number</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {vendorTypes.length > 1 && (
              <button onClick={generateAllTypes} disabled={generating} title="Generate one PF per TYPE section" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 7,
                border: '1px solid #1a2b4b', background: '#fff', color: '#1a2b4b', fontSize: 13, fontWeight: 700,
                cursor: generating ? 'default' : 'pointer',
              }}>
                {generating ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={13} />}
                Generate all {vendorTypes.length} types
              </button>
            )}
            <button onClick={generate} disabled={generating || !itemCount} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, border: 'none',
              background: itemCount ? '#1a2b4b' : '#cbd5e1', color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: (generating || !itemCount) ? 'default' : 'pointer',
            }}>
              {generating ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={13} />}
              Generate this type
            </button>
          </div>
        </div>

        {itemCount === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 12 }}>
            This vendor has no items in the Item List.
          </div>
        ) : editSections.map((sec, si) => (
          <div key={si} style={{ marginBottom: 12 }}>
            {sec.categories.map((cat, ci) => (
              <div key={ci} style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ background: '#2d3748', color: '#fff', padding: '6px 10px', fontSize: 12, fontWeight: 700 }}>{cat.name || 'CATEGORY'}</div>
                {cat.subCategories.map((sub, sbi) => (
                  <div key={sbi}>
                    {!!sub.segmentName && <div style={{ background: '#a6a6a6', color: '#fff', padding: '3px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{sub.segmentName}</div>}
                    {sub.groups.map((grp, gi) => (
                      <div key={gi}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-subtle)' }}>
                              <th style={pfTh(40)}>Pic</th><th style={pfTh(90)}>Item Code</th><th style={pfTh()}>Description</th>
                              <th style={pfTh(56)}>Qty</th><th style={pfTh(90)}>Price</th><th style={pfTh(28)} />
                            </tr>
                          </thead>
                          <tbody>
                            {grp.items.map((it, ii) => (
                              <tr key={ii} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={{ ...pfTd, textAlign: 'center' }}>
                                  <button type="button" onClick={() => triggerPhoto(si, ci, sbi, gi, ii)} title="Add photo" style={{ width: 30, height: 30, background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 0 }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    {it.photoBase64 ? <img src={it.photoBase64} alt="" style={{ width: 30, height: 30, objectFit: 'cover' }} /> : <Camera size={12} color="var(--fg-faint)" />}
                                  </button>
                                </td>
                                <td style={pfTd}><input value={it.itemCode} onChange={e => updItem(si, ci, sbi, gi, ii, { itemCode: e.target.value })} style={pfInput} placeholder="Code" /></td>
                                <td style={pfTd}><input value={it.description} onChange={e => updItem(si, ci, sbi, gi, ii, { description: e.target.value })} style={{ ...pfInput, color: '#1f3864', fontWeight: 600 }} placeholder="Description" /></td>
                                <td style={pfTd}><input type="number" min={0} value={it.quantity || ''} onChange={e => updItem(si, ci, sbi, gi, ii, { quantity: parseInt(e.target.value) || 0 })} style={{ ...pfInput, textAlign: 'center' }} /></td>
                                <td style={pfTd}><input type="number" min={0} value={it.unitPrice ?? ''} onChange={e => updItem(si, ci, sbi, gi, ii, { unitPrice: e.target.value === '' ? null : parseFloat(e.target.value) })} style={{ ...pfInput, textAlign: 'right' }} placeholder="0.00" /></td>
                                <td style={{ ...pfTd, textAlign: 'center' }}><button onClick={() => removeItem(si, ci, sbi, gi, ii)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 2 }}><X size={12} /></button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <button onClick={() => addItem(si, ci, sbi, gi)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, margin: '5px 8px', fontSize: 11, color: 'var(--brand-teal, #1a6b6b)', background: 'none', border: 'none', cursor: 'pointer' }}>
                          <Plus size={11} /> Add item
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
          </>) : (
            <div style={{ padding: '70px 20px', textAlign: 'center', color: 'var(--fg-faint)', fontSize: 13 }}>
              Select a Production Form on the left, or create one with “New PF”.
            </div>
          )}
          </div>
        </div>
      </div>

      {etdOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => !statusBusy && setEtdOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 'min(360px, 94vw)', padding: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Mark as ORDERED</div>
            <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginBottom: 12 }}>STD is set to today. Pick the <b>Estimated Delivery Date (ETD)</b> — required.</div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)' }}>Estimated Delivery Date</label>
            <input type="date" value={etdValue} onChange={e => setEtdValue(e.target.value)} autoFocus
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '8px 10px', border: '1px solid var(--border-default)', borderRadius: 7, marginTop: 4 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setEtdOpen(false)} disabled={statusBusy} className="btn btn-ghost btn-sm">Cancel</button>
              <button
                onClick={async () => { if (!etdValue) { toast.error('Pick an ETD'); return; } await applyStatus('ORDERED', etdValue); setEtdOpen(false); }}
                disabled={statusBusy || !etdValue}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, border: 'none', background: (statusBusy || !etdValue) ? '#cbd5e1' : '#1a2b4b', color: '#fff', fontSize: 13, fontWeight: 700, cursor: (statusBusy || !etdValue) ? 'default' : 'pointer' }}>
                {statusBusy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null} Confirm ORDERED
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssembly && (
        <AssemblyModal
          projectId={projectId}
          catGroup={catGroup}
          currentPfCode={selectedDoc ? selectedDoc.file_name.split(' - PF')[0] : (pfDocs[0]?.file_name.split(' - PF')[0] ?? null)}
          onClose={() => setShowAssembly(false)}
          onSaved={() => onSynced?.()}
        />
      )}

      {showSigPad && (
        <SignaturePad
          existingBase64={userSig ?? null}
          onSaved={(base64) => {
            setUserSig(base64);
            setShowSigPad(false);
            const resume = pendingApproveRef.current;
            pendingApproveRef.current = null;
            if (resume) setTimeout(resume, 50);
          }}
          onClose={() => { setShowSigPad(false); pendingApproveRef.current = null; }}
        />
      )}
    </div>
  );
}

const pfLink: React.CSSProperties = { fontSize: 11, color: 'var(--fg-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' };

function pfTh(width?: number): React.CSSProperties {
  return { padding: '6px 8px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--fg-subtle)', textAlign: 'left', width, whiteSpace: 'nowrap' };
}
const pfTd: React.CSSProperties = { padding: '3px 6px' };
const pfInput: React.CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 11, padding: '4px 6px', border: '1px solid var(--border-subtle)', borderRadius: 4, background: 'var(--bg-default)', outline: 'none' };
