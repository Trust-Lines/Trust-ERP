'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { DocumentRow, AuditRow } from './ProjectDetailClient';
import { approvalStagesFor } from '@/lib/approvals/stageConfig';
import type { PermMap } from '@/lib/permissions/catalog';
import dynamic from 'next/dynamic';
import type { ApprovalRow, ILVer } from './plan-layout/shared';
import { FilePreview } from './plan-layout/FilePreview';
import { SignatureBanner } from './plan-layout/SignatureBanner';
import { VersionsPanel } from './plan-layout/VersionsPanel';
import { PreviewToolbar } from './plan-layout/PreviewToolbar';
import { FullscreenViewer } from './plan-layout/FullscreenViewer';
import { ApprovalPanel } from './plan-layout/ApprovalPanel';
import { ActivityTimeline } from './plan-layout/ActivityTimeline';

const DocGeneratorModal = dynamic(() => import('./DocGeneratorModal'), { ssr: false });
const SignaturePad      = dynamic(() => import('../SignaturePad').then(m => ({ default: m.SignaturePad })), { ssr: false });

const PROD_DOC_TYPES_WITH_APPROVAL = ['proposal', 'item_plan', 'item_list', 'price_list', 'book', 'po_bo', 'pf'];

interface Props {
  projectId:          string;
  userId:             string;
  userRole?:          string;
  userPerms?:         PermMap;
  documents:          DocumentRow[];
  auditEvents:        AuditRow[];
  docType?:           string;
  title?:             string;
  catGroup?:          string | null;
  dropboxRootPath?:   string | null;
  onSynced?:          () => void;
  onFullyApproved?:   () => void;
  trustlinesPmId?:    string | null;
  tlinesPmId?:        string | null;
}

export function PlanLayoutTab({
  projectId, userId, userRole, userPerms, documents, auditEvents,
  docType = 'plan_layout', title = 'Item Plan', catGroup,
  dropboxRootPath, onSynced, onFullyApproved, trustlinesPmId, tlinesPmId,
}: Props) {
  const planDocs = (() => {
    const filtered = documents.filter(d =>
      d.doc_type === docType &&
      (catGroup != null ? d.cat_group === catGroup : d.cat_group == null),
    );
    const sorted = [...filtered].sort((a, b) => a.version - b.version);
    const seen   = new Map<string, DocumentRow>();
    for (const doc of sorted) {
      const key = `${doc.dropbox_version ?? doc.version}::${doc.file_name}`;
      seen.set(key, doc);
    }
    return [...seen.values()].sort(
      (a, b) => (a.dropbox_version ?? a.version) - (b.dropbox_version ?? b.version),
    );
  })();

  const planDocsByVersion = (() => {
    const map = new Map<number, DocumentRow[]>();
    for (const doc of planDocs) {
      const v = doc.dropbox_version ?? doc.version;
      if (!map.has(v)) map.set(v, []);
      map.get(v)!.push(doc);
    }
    return map;
  })();

  const versionNumbers = [...planDocsByVersion.keys()].sort((a, b) => a - b);
  const latestVersion  = versionNumbers[versionNumbers.length - 1] ?? 0;
  const [activeVersion, setActiveVersion] = useState<number>(latestVersion);

  const safeVersion = planDocsByVersion.has(activeVersion) ? activeVersion : (versionNumbers[versionNumbers.length - 1] ?? 0);
  const activeVersionDocs = planDocsByVersion.get(safeVersion) ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(
    activeVersionDocs.length > 0 ? activeVersionDocs[activeVersionDocs.length - 1].id : null,
  );
  const selected = planDocs.find(d => d.id === selectedId) ?? null;
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfReady, setPdfReady]     = useState(false);
  const [pdfCacheBust, setPdfCacheBust] = useState(0);
  const [zoom, setZoom]             = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGenerator, setShowGenerator]         = useState(false);
  const [generatorInitSections, setGeneratorInitSections] = useState<unknown[] | undefined>(undefined);
  const [editDocumentId, setEditDocumentId]       = useState<string | undefined>(undefined);
  const [userSignature, setUserSignature]           = useState<string | null | undefined>(undefined);
  const [showSignaturePad, setShowSignaturePad]     = useState(false);
  const pendingApproveRef                           = useRef<(() => void) | null>(null);

  useEffect(() => {
    fetch('/api/user/signature')
      .then(r => r.json())
      .then((j: { base64?: string | null }) => setUserSignature(j.base64 ?? null))
      .catch(() => setUserSignature(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dropbox/check-revisions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, docType, catGroup: catGroup ?? null }),
        });
        if (!res.ok) return;
        const json = await res.json() as { revisions?: { fileName: string }[] };
        if (!cancelled && json.revisions?.length) {
          const names = json.revisions.map(r => r.fileName).join(', ');
          toast.info(`Revision detected in Dropbox: ${names} — approval flow restarted from Stage 1`, { duration: 7000 });
          setPdfCacheBust(Date.now());
          onSynced?.();
        }
      } catch { }
    })();
    return () => { cancelled = true; };
   
  }, [projectId, docType, catGroup]);

  const isGeneratable = (docType === 'item_list' || docType === 'price_list') && !!catGroup;

  const [ilVersions, setIlVersions] = useState<ILVer[]>([]);

  useEffect(() => {
    if (docType !== 'price_list' || !catGroup) return;
    const lsKey  = `docgen_il_${projectId}_${catGroup}`;
    const lsData = (() => { try { return JSON.parse(localStorage.getItem(lsKey) ?? '[]') as ILVer[]; } catch { return [] as ILVer[]; } })();
    if (lsData.length > 0) setIlVersions(lsData);
    fetch(`/api/projects/${projectId}/doc-versions?doc_type=item_list&cat_group=${catGroup}`)
      .then(r => r.json())
      .then((j: { versions: ILVer[] }) => {
        const db    = j.versions ?? [];
        const dbIds = new Set(db.map(v => v.version));
        const merged = [...db, ...lsData.filter(v => !dbIds.has(v.version))].sort((a, b) => b.version - a.version);
        setIlVersions(merged.length > 0 ? merged : lsData);
      })
      .catch(() => {});
  }, [projectId, catGroup, docType]);

  function fileType(name: string): 'pdf' | 'image' | 'other' {
    if (/\.pdf$/i.test(name)) return 'pdf';
    if (/\.(jpe?g|png|gif|webp|bmp|svg|tiff?)$/i.test(name)) return 'image';
    return 'other';
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!isFullscreen) return;
      if (e.key === 'Escape') setIsFullscreen(false);
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(300, z + 10));
      if (e.key === '-') setZoom(z => Math.max(25, z - 10));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  const [approvals, setApprovals]           = useState<ApprovalRow[]>([]);
  const [approvalsForDoc, setApprovalsForDoc] = useState<string | null>(null);
  const [approvalsLoading, setApprLoading]  = useState(false);
  const [initiating, setInitiating]       = useState(false);
  const initiateAttempted = useRef<Set<string>>(new Set());

  function handleOptimisticApprove(stageIndex: number, action: 'approve' | 'reject') {
    const now = new Date().toISOString();
    setApprovals(prev => prev.map(a => {
      if (a.stage === stageIndex + 1) {
        return { ...a, status: action === 'approve' ? 'approved' : 'rejected', resolved_at: now };
      }
      if (action === 'approve' && stageIndex === 0 && a.stage === 2 && a.status === 'waiting') {
        return { ...a, status: 'pending' };
      }
      return a;
    }));
  }

  const loadingForDocId = useRef<string | null>(null);

  const loadApprovals = useCallback(async (docId: string, allowClear = true) => {
    loadingForDocId.current = docId;
    setApprLoading(true);
    try {
      const res  = await fetch(`/api/projects/${projectId}/doc-approvals?documentId=${docId}`);
      const data = await res.json() as { approvals?: ApprovalRow[] };
      if (loadingForDocId.current !== docId) return;
      const fetched = data.approvals ?? [];
      setApprovals(prev => (fetched.length > 0 || allowClear) ? fetched : prev);
      setApprovalsForDoc(docId);
    } catch { }
    finally {
      if (loadingForDocId.current === docId) setApprLoading(false);
    }
  }, [projectId]);

  async function handleInitiateApproval() {
    if (!selected || initiating) return;
    setInitiating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/doc-approvals`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:     'initiate',
          documentId: selected.id,
          docType,
          catGroup:   catGroup ?? null,
          versionNum: selected.dropbox_version ?? selected.version,
        }),
      });
      if (!res.ok) {
        if (res.status !== 409) {
          const e = await res.json() as { error?: string };
          console.error('[initiate approval] server error:', e.error);
          throw new Error(e.error ?? 'Failed');
        }
      }
      await new Promise(r => setTimeout(r, 600));
      await loadApprovals(selected.id);
      onSynced?.();
    } catch (e) {
      console.error('[initiate approval]', e);
    } finally {
      setInitiating(false);
    }
  }

  useEffect(() => {
    setPdfReady(false);
    setApprovals([]);
    if (selectedId) {
      setPdfLoading(true);
      loadApprovals(selectedId);
    }
  }, [selectedId, loadApprovals]);

  const PROD_APPROVAL_TYPES = ['proposal', 'item_plan', 'item_list', 'price_list', 'book', 'po_bo', 'pf'];
  const APPROVAL_DOC_TYPES_UI = catGroup
    ? PROD_APPROVAL_TYPES
    : ['plan_layout', 'proposal', 'construction_drawings'];
  const expectedStages = docType === 'pf' ? 4 : approvalStagesFor(docType, catGroup ?? null).length;
  useEffect(() => {
    if (!selected) return;
    if (!APPROVAL_DOC_TYPES_UI.includes(docType)) return;
    if (approvalsLoading) return;
    if (approvals.length >= expectedStages) return;
    if (initiating) return;
    const attemptKey = `${selected.id}::${expectedStages}`;
    if (initiateAttempted.current.has(attemptKey)) return;
    initiateAttempted.current.add(attemptKey);
    void handleInitiateApproval();
   
  }, [selected?.id, approvals.length, approvalsLoading]);

  const SHARED_TYPES = ['proposal', 'item_plan', 'item_list', 'price_list'];
  const SHARED_LABELS: Record<string, string> = { proposal: 'Proposal', item_plan: 'Item Plan', item_list: 'Item List', price_list: 'Item Price List' };
  const catUpperShared = (catGroup ?? '').charAt(0).toUpperCase() + (catGroup ?? '').slice(1);
  const requiredShared = ['Millwork', 'Shelving'].includes(catUpperShared)
    ? ['proposal', 'item_plan', 'item_list', 'price_list']
    : ['item_plan', 'item_list', 'price_list'];
  const isSharedDoc = !!catGroup && SHARED_TYPES.includes(docType);
  const missingShared = isSharedDoc
    ? requiredShared.filter(t => !documents.some(d => d.doc_type === t && d.cat_group === catGroup))
    : [];
  const sharedLocked = isSharedDoc && missingShared.length > 0;

  async function handleEditDoc(doc: DocumentRow) {
    try {
      const res = await fetch(`/api/projects/${projectId}/doc-versions?doc_type=${docType}&cat_group=${catGroup ?? ''}`);
      const json = await res.json() as { versions: { id: string; form_data: unknown[] | null }[] };
      const found = (json.versions ?? []).find(v => v.id === doc.id);
      if (!found?.form_data?.length) {
        toast.error('No saved form data for this version. Regenerate the document first.');
        return;
      }
      setGeneratorInitSections(found.form_data);
      setEditDocumentId(doc.id);
      setShowGenerator(true);
    } catch {
      toast.error('Failed to load document data.');
    }
  }

  const versionLabel = (doc: DocumentRow) =>
    `${title} V${doc.dropbox_version ?? doc.version}`;

  const proxyUrl = selectedId && selected
    ? `/api/files/proxy/${encodeURIComponent(selected.file_name)}?documentId=${selectedId}${pdfCacheBust ? `&t=${pdfCacheBust}` : ''}`
    : null;

  const lifecycle = (() => {
    if (!selected) return null;
    const v = selected.dropbox_version ?? selected.version;
    if (selected.status === 'approved') return { label: `Completed V${v}`, bg: 'var(--status-success-bg)', fg: 'var(--status-success-fg)', border: 'var(--status-success)' };
    if (selected.status === 'rejected') return { label: `Rejected V${v}`,  bg: 'var(--status-danger-bg)', fg: 'var(--status-danger)', border: 'var(--status-danger)' };
    const rows  = approvalsForDoc === selectedId ? approvals : [];
    const total = rows.length;
    const trustPmSigned = total >= 2 && rows[total - 2]?.status === 'approved';
    if (trustPmSigned) return { label: `Signed V${v}`, bg: 'var(--status-info-bg)', fg: 'var(--status-info-fg)', border: 'var(--status-info)' };
    return { label: `DRAFT V${v}`, bg: 'var(--status-warning-bg)', fg: 'var(--status-warning)', border: 'var(--status-warning)' };
  })();

  async function handleDownload() {
    if (!selectedId || !selected) return;
    const res  = await fetch(`/api/files/view?documentId=${selectedId}`);
    const data = await res.json() as { link?: string };
    if (!data.link) return;
    const a = document.createElement('a');
    a.href = data.link;
    a.download = selected.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleOpenNew() {
    if (!selectedId) return;
    const res  = await fetch(`/api/files/view?documentId=${selectedId}`);
    const data = await res.json() as { link?: string };
    if (data.link) window.open(data.link, '_blank');
  }

  if (showGenerator && isGeneratable) {
    return (
      <DocGeneratorModal
        projectId={projectId}
        catGroup={catGroup!}
        docType={docType as 'item_list' | 'price_list'}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialSections={generatorInitSections as any}
        editDocumentId={editDocumentId}
        onClose={() => { setShowGenerator(false); setGeneratorInitSections(undefined); setEditDocumentId(undefined); }}
        onGenerated={() => {
          setShowGenerator(false); setGeneratorInitSections(undefined); setEditDocumentId(undefined);
          onSynced?.();
        }}
      />
    );
  }

  const isAssignedApprover = approvals.some(a => a.assigned_to === userId);

  return (
    <>
    {showSignaturePad && (
      <SignaturePad
        existingBase64={userSignature}
        onSaved={b64 => {
          setUserSignature(b64);
          setShowSignaturePad(false);
          const cb = pendingApproveRef.current;
          pendingApproveRef.current = null;
          cb?.();
        }}
        onClose={() => { setShowSignaturePad(false); pendingApproveRef.current = null; }}
      />
    )}

    <SignatureBanner
      isAssignedApprover={isAssignedApprover}
      userSignature={userSignature}
      onOpenSignaturePad={() => setShowSignaturePad(true)}
    />

    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 300px', gap: 16, alignItems: 'start' }}>

      <VersionsPanel
        projectId={projectId}
        docType={docType}
        catGroup={catGroup}
        title={title}
        dropboxRootPath={dropboxRootPath}
        isGeneratable={isGeneratable}
        onSynced={onSynced}
        planDocs={planDocs}
        ilVersions={ilVersions}
        versionNumbers={versionNumbers}
        safeVersion={safeVersion}
        activeVersionDocs={activeVersionDocs}
        selectedId={selectedId}
        onSelectVersion={vNum => {
          setActiveVersion(vNum);
          const first = planDocsByVersion.get(vNum)?.[0];
          if (first) setSelectedId(first.id);
        }}
        onSelectDoc={setSelectedId}
        onCreateItemList={() => { setGeneratorInitSections(undefined); setShowGenerator(true); }}
        onOpenForPricing={formData => {
          setGeneratorInitSections(formData);
          setShowGenerator(true);
        }}
        onEditDoc={doc => { void handleEditDoc(doc); }}
      />

      <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 700 }}>
        <PreviewToolbar
          viewingLabel={selected ? versionLabel(selected) : null}
          lifecycle={lifecycle}
          hasSelection={!!selected}
          zoom={zoom}
          setZoom={setZoom}
          onDownload={handleDownload}
          onOpenNew={handleOpenNew}
          onFullscreen={() => { setIsFullscreen(true); setZoom(100); }}
        />

        <FilePreview
          proxyUrl={proxyUrl}
          selected={selected}
          pdfLoading={pdfLoading}
          pdfReady={pdfReady}
          zoom={zoom}
          selectedId={selectedId}
          cacheBust={pdfCacheBust}
          fileType={fileType}
          onLoad={() => { setPdfLoading(false); setPdfReady(true); }}
        />
      </div>

      {isFullscreen && selected && proxyUrl && (
        <FullscreenViewer
          fileName={selected.file_name}
          proxyUrl={proxyUrl}
          selectedId={selectedId}
          cacheBust={pdfCacheBust}
          fileType={fileType}
          zoom={zoom}
          setZoom={setZoom}
          onDownload={handleDownload}
          onOpenNew={handleOpenNew}
          onClose={() => setIsFullscreen(false)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        <ApprovalPanel
          projectId={projectId}
          userId={userId}
          userPerms={userPerms}
          docType={docType}
          catGroup={catGroup}
          selected={selected}
          selectedId={selectedId}
          approvals={approvals}
          approvalsForDoc={approvalsForDoc}
          approvalsLoading={approvalsLoading}
          initiating={initiating}
          sharedLocked={sharedLocked}
          catUpperShared={catUpperShared}
          missingShared={missingShared}
          sharedLabels={SHARED_LABELS}
          trustlinesPmId={trustlinesPmId}
          tlinesPmId={tlinesPmId}
          userSignature={userSignature}
          onLoadApprovals={loadApprovals}
          onSynced={onSynced}
          onPdfSigned={() => { setPdfLoading(true); setPdfReady(false); setPdfCacheBust(Date.now()); }}
          onApproveOptimistic={handleOptimisticApprove}
          onNeedSignature={cb => { pendingApproveRef.current = cb; setShowSignaturePad(true); }}
        />

        <ActivityTimeline auditEvents={auditEvents} />

      </div>
    </div>

    </>
  );
}
