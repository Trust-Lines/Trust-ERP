'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Loader2, FileCheck2, ExternalLink, Maximize2, ChevronDown, ChevronUp, Inbox,
} from 'lucide-react';
import { ApprovalActionBar } from './ApprovalActionBar';

export interface MyApproval {
  approvalId:   string;
  projectId:    string;
  projectName:  string;
  projectCode:  string;
  documentId:   string;
  fileName:     string;
  docType:      string;
  catGroup:     string | null;
  version:      number;
  versionNum:   number | null;
  stage:        number;
  totalStages:  number;
  isFinalStage: boolean;
  stageLabel:   string;
  createdAt:    string;
}

const SignaturePad = dynamic(() => import('../SignaturePad').then(m => ({ default: m.SignaturePad })), { ssr: false });

const DOC_LABELS: Record<string, string> = {
  plan_layout: 'Item Plan', proposal: 'Design Proposal', construction_drawings: 'Construction Drawing',
  // 🔴 FIX (Roadmap Month 2, task 12): 'shop_drawing' shares construction_drawings' exact
  // approval chain (Trust PM → Client PM, lib/approvals/stageConfig.ts) so it already flows
  // through this same inbox — it just fell through to the raw snake_case docType because this
  // map never had an entry for it.
  shop_drawing: 'Shop Drawing',
  item_plan: 'Item Plan', item_list: 'Item List', price_list: 'Item Price List',
  book: 'Book', po_bo: 'Purchase Order', pf: 'Production Form',
};

function fileType(name: string): 'pdf' | 'image' | 'other' {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  return 'other';
}

export function ApprovalsPageClient() {
  const router = useRouter();
  const [items, setItems]       = useState<MyApproval[] | null>(null);
  const [userSignature, setUserSignature] = useState<string | null | undefined>(undefined);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [cacheBust, setCacheBust] = useState<Record<string, number>>({});
  const pendingApproveRef = useRef<(() => void) | null>(null);

  const load = useCallback(async () => {
    try {
      const res  = await fetch('/api/approvals/mine');
      const json = await res.json() as { approvals?: MyApproval[] };
      setItems(json.approvals ?? []);
      if (json.approvals?.length) setExpanded(prev => Object.keys(prev).length ? prev : { [json.approvals![0].approvalId]: true });
    } catch { setItems([]); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    fetch('/api/automations/run-approval-reminders', { method: 'POST' }).catch(() => {});
  }, []);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    const iv = setInterval(() => { if (!document.hidden) void load(); }, 30000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(iv); };
  }, [load]);

  useEffect(() => {
    fetch('/api/user/signature')
      .then(r => r.json())
      .then((j: { base64?: string | null }) => setUserSignature(j.base64 ?? null))
      .catch(() => setUserSignature(null));
  }, []);

  function afterAction() {
    void load();
    router.refresh();
  }

  const proxyUrl = (a: MyApproval) =>
    `/api/files/proxy/${encodeURIComponent(a.fileName)}?documentId=${a.documentId}${cacheBust[a.approvalId] ? `&t=${cacheBust[a.approvalId]}` : ''}`;

  if (items === null) {
    return (
      <div className="main-inner">
        <div className="page-head"><h1>My Approvals</h1></div>
        <div className="card"><div className="card-body" style={{ padding: 48, textAlign: 'center' }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--fg-subtle)' }} />
        </div></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="main-inner">
        <div className="page-head"><h1>My Approvals</h1></div>
        <div className="card"><div className="card-body" style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--fg-subtle)' }}>
          <Inbox size={32} style={{ color: 'var(--fg-faint)', marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-muted)' }}>You&apos;re all caught up</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>No documents are waiting for your review right now.</div>
        </div></div>
      </div>
    );
  }

  return (
    <div className="main-inner">
      <div className="page-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>My Approvals</h1>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: '3px 11px', borderRadius: 99,
          background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d',
        }}>
          {items.length} waiting for you
        </span>
      </div>

      {userSignature === null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 14,
          background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8,
        }}>
          <span style={{ fontSize: 18 }}>✍️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>Set up your signature</div>
            <div style={{ fontSize: 11, color: '#b45309' }}>You&apos;ll be asked to draw it the first time you approve — it&apos;s then stamped on every PDF you sign.</div>
          </div>
          <button onClick={() => setShowSignaturePad(true)} style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid #f59e0b',
            background: '#f59e0b', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>Set up now</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map(a => {
          const isOpen = !!expanded[a.approvalId];
          const ftype  = fileType(a.fileName);
          const url    = proxyUrl(a);
          return (
            <div key={a.approvalId} className="card" style={{ overflow: 'hidden' }}>
              <div
                onClick={() => setExpanded(p => ({ ...p, [a.approvalId]: !p[a.approvalId] }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                  cursor: 'pointer', borderBottom: isOpen ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FileCheck2 size={18} color="#2563eb" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-default)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.projectName} <span style={{ color: 'var(--fg-faint)', fontWeight: 500 }}>· {a.projectCode}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                    {DOC_LABELS[a.docType] ?? a.docType}{a.catGroup ? ` · ${a.catGroup.charAt(0).toUpperCase() + a.catGroup.slice(1)}` : ''} · {a.stageLabel}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 99, flexShrink: 0,
                  background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd',
                }}>
                  V{a.version}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, flexShrink: 0,
                  background: '#fef3c7', color: '#b45309',
                }}>
                  Stage {a.stage}/{a.totalStages}
                </span>
                {isOpen ? <ChevronUp size={16} color="var(--fg-faint)" /> : <ChevronDown size={16} color="var(--fg-faint)" />}
              </div>

              {isOpen && (
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.fileName}
                    </span>
                    <a
                      href={`/projects/${a.projectId}`}
                      style={{ fontSize: 11, color: 'var(--brand-teal, #1a6b6b)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', flexShrink: 0 }}
                    >
                      Open in project <ExternalLink size={11} />
                    </a>
                  </div>

                  <div style={{
                    background: '#e8eaed', borderRadius: 8, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 420,
                  }}>
                    {ftype === 'pdf' ? (
                      <iframe key={url} src={url} style={{ border: 'none', width: '100%', height: 560, display: 'block' }} title={a.fileName} />
                    ) : ftype === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={url} src={url} alt={a.fileName} style={{ maxWidth: '100%', maxHeight: 560, objectFit: 'contain' }} />
                    ) : (
                      <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 13 }}>
                        <Maximize2 size={20} style={{ marginBottom: 8 }} /><br />
                        Preview not available — open in the project to view this file.
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ minWidth: 280 }}>
                      <ApprovalActionBar
                        approvalId={a.approvalId}
                        projectId={a.projectId}
                        isFinalStage={a.isFinalStage}
                        versionNum={a.versionNum}
                        userSignature={userSignature}
                        size="md"
                        onNeedSignature={(resume) => { pendingApproveRef.current = resume; setShowSignaturePad(true); }}
                        onPdfSigned={() => setCacheBust(p => ({ ...p, [a.approvalId]: Date.now() }))}
                        onDone={afterAction}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showSignaturePad && (
        <SignaturePad
          existingBase64={userSignature ?? null}
          onSaved={(base64) => {
            setUserSignature(base64);
            setShowSignaturePad(false);
            const resume = pendingApproveRef.current;
            pendingApproveRef.current = null;
            if (resume) setTimeout(resume, 50);
          }}
          onClose={() => { setShowSignaturePad(false); pendingApproveRef.current = null; }}
        />
      )}
    </div>
  );
}
