'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, Download, ExternalLink, Maximize2, Plus, Pause } from 'lucide-react';
import { toast } from 'sonner';
import type { DocumentRow } from './ProjectDetailClient';
import { DocumentApprovalRail } from '../approvals/DocumentApprovalRail';
import { approvalStagesFor } from '@/lib/approvals/stageConfig';

const SignaturePad = dynamic(() => import('../SignaturePad').then(m => ({ default: m.SignaturePad })), { ssr: false });

interface Props {
  projectId: string;
  userId?: string;
  userRole?: string;
  userPerms?: import('@/lib/permissions/catalog').PermMap;
  catGroup: string;
  categoryLabel: string;
  documents?: DocumentRow[];
  onSynced?: () => void;
}

export function PoTab({ projectId, userId, userRole, userPerms, catGroup, categoryLabel, documents = [], onSynced }: Props) {
  const [generating, setGenerating] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [userSig, setUserSig] = useState<string | null | undefined>(undefined);
  const [showSigPad, setShowSigPad] = useState(false);
  const [cacheBust, setCacheBust] = useState(0);
  const [holding, setHolding] = useState(false);
  const [onHold, setOnHold] = useState(false);
  const [holdNote, setHoldNote] = useState<string | null>(null);
  const [ordered, setOrdered] = useState(false);
  const pendingApproveRef = useRef<(() => void) | null>(null);

  const poDocs = useMemo(() => documents
    .filter(d => d.doc_type === 'po_bo' && d.cat_group === catGroup)
    .sort((a, b) => (b.dropbox_version ?? b.version) - (a.dropbox_version ?? a.version)), [documents, catGroup]);

  const hasPriceList = documents.some(d => d.doc_type === 'price_list' && d.cat_group === catGroup);

  useEffect(() => {
    if (poDocs.length && (!selectedDocId || !poDocs.some(d => d.id === selectedDocId))) setSelectedDocId(poDocs[0].id);
    if (!poDocs.length) setSelectedDocId(null);
  }, [poDocs, selectedDocId]);

  useEffect(() => {
    fetch('/api/user/signature').then(r => r.json()).then((j: { base64?: string | null }) => setUserSig(j.base64 ?? null)).catch(() => setUserSig(null));
  }, []);

  const loadHold = useCallback(() => {
    fetch(`/api/projects/${projectId}/po-hold?catGroup=${encodeURIComponent(catGroup)}`)
      .then(r => r.json()).then((j: { onHold?: boolean; note?: string | null; ordered?: boolean }) => { setOnHold(!!j.onHold); setHoldNote(j.note ?? null); setOrdered(!!j.ordered); })
      .catch(() => {});
  }, [projectId, catGroup]);
  useEffect(() => { loadHold(); }, [loadHold]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dropbox/check-revisions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, docType: 'po_bo', catGroup }),
        });
        if (!res.ok) return;
        const json = await res.json() as { revisions?: { fileName: string }[] };
        if (!cancelled && json.revisions?.length) {
          toast.info(`PO changed in Dropbox: ${json.revisions.map(r => r.fileName).join(', ')} — signatures cleared, approval reset`, { duration: 7000 });
          setCacheBust(Date.now());
          onSynced?.();
        }
      } catch { }
    })();
    return () => { cancelled = true; };
   
  }, [projectId, catGroup]);

  const selectedDoc = poDocs.find(d => d.id === selectedDocId) ?? null;
  const proxyUrl = selectedDoc ? `/api/files/proxy/${encodeURIComponent(selectedDoc.file_name)}?documentId=${selectedDoc.id}${cacheBust ? `&t=${cacheBust}` : ''}` : null;

  const canHold = userRole === 'tlines_pm' || userRole === 'general_manager' || userRole === 'ops_manager';

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-po`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catGroup }),
      });
      const json = await res.json() as { ok?: boolean; poNumber?: string; version?: number; documentId?: string; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Failed');
      toast.success(`PO generated — ${json.poNumber} (V${json.version}, draft)`);
      if (json.documentId) setSelectedDocId(json.documentId);
      onSynced?.();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Generate failed'); }
    finally { setGenerating(false); }
  }

  async function holdT(release: boolean) {
    let note: string | null = null;
    if (!release) {
      if (ordered && !window.confirm('⚠️ This order is already ORDERED. Putting it on HOLD / T will alert the team (Trust PM, Client PM, Production Manager, General Manager). Continue?')) return;
      note = window.prompt('Reason for HOLD / T (required) — saved as a note, shown on the production board, and emailed to the people on this project:', holdNote ?? '');
      if (note === null) return;
      if (!note.trim()) { toast.error('A reason is required to hold'); return; }
    }
    setHolding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/po-hold`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catGroup, release, note }),
      });
      const json = await res.json() as { error?: string; wasOrdered?: boolean };
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      if (release) toast.success('HOLD / T released — status restored');
      else toast.success(json.wasOrdered ? 'ORDERED order put on HOLD / T — team notified by email' : 'Order put on HOLD / T — team notified');
      setOnHold(!release);
      setHoldNote(release ? null : (note?.trim() ?? null));
      onSynced?.();
      loadHold();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setHolding(false); }
  }

  async function openInDropbox() {
    if (!selectedDoc) return;
    try { const res = await fetch(`/api/files/view?documentId=${selectedDoc.id}`); const d = await res.json() as { link?: string }; if (d.link) window.open(d.link, '_blank'); } catch { }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="text-eyebrow">Purchase Order</div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{categoryLabel} PO</h3>
        </div>
        <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>Pulled from the Item Price List · Client PM → General Manager (Accountant optional)</div>
      </div>

      <div className="card-body" style={{ padding: 0 }}>
        <div style={{ display: 'flex', minHeight: 560 }}>
          <div style={{ width: 250, borderRight: '1px solid var(--border-subtle)', flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-subtle)' }}>
            <div style={{ padding: 12, borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={generate} disabled={generating || !hasPriceList} title={hasPriceList ? '' : 'Generate the Item Price List first'} style={{
                width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 12px', borderRadius: 8, border: 'none', background: hasPriceList ? '#1a2b4b' : '#cbd5e1', color: '#fff', fontSize: 12, fontWeight: 700, cursor: hasPriceList ? 'pointer' : 'not-allowed',
              }}>{generating ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />} Generate PO</button>
              {canHold && (
                <>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => holdT(false)} disabled={holding} title="Put the order on HOLD / T (a reason is required)" style={{
                      flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 8px', borderRadius: 7,
                      border: '1px solid #dc2626', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      background: onHold ? '#dc2626' : '#fff', color: onHold ? '#fff' : '#dc2626',
                    }}><Pause size={11} /> {onHold ? 'ON HOLD / T' : 'HOLD / T'}</button>
                    <button onClick={() => holdT(true)} disabled={holding || !onHold} style={{ flex: 1, padding: '7px 8px', borderRadius: 7, border: '1px solid var(--border-default)', background: '#fff', fontSize: 11, fontWeight: 600, cursor: onHold ? 'pointer' : 'not-allowed', opacity: onHold ? 1 : 0.5 }}>Release</button>
                  </div>
                  {onHold && holdNote && (
                    <div style={{ marginTop: 2, padding: '6px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 10, color: '#b91c1c' }}>
                      <span style={{ fontWeight: 700 }}>Hold reason:</span> {holdNote}
                    </div>
                  )}
                </>
              )}
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '4px 6px 8px' }}>Purchase Orders</div>
              {poDocs.length === 0 && <div style={{ fontSize: 11, color: 'var(--fg-faint)', padding: 6 }}>{hasPriceList ? 'None yet — generate one.' : 'Generate the Item Price List first.'}</div>}
              {poDocs.map(d => {
                const v = d.dropbox_version ?? d.version; const code = d.file_name.split(' - PO')[0]; const active = d.id === selectedDocId;
                return (
                  <button key={d.id} onClick={() => setSelectedDocId(d.id)} style={{ width: '100%', textAlign: 'left', display: 'block', padding: '8px 10px', marginBottom: 5, borderRadius: 7, cursor: 'pointer', border: `1px solid ${active ? 'var(--brand-teal, #1a6b6b)' : 'var(--border-subtle)'}`, background: active ? '#f0fdfa' : '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{code}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand-teal, #1a6b6b)', flexShrink: 0 }}>V{v}</span>
                    </div>
                    <span style={{ display: 'inline-block', marginTop: 5, fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: d.status === 'approved' ? '#dcfce7' : '#fef3c7', color: d.status === 'approved' ? '#15803d' : '#b45309' }}>{d.status === 'draft' ? 'DRAFT' : d.status.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, padding: 14, overflowX: 'auto' }}>
            {selectedDoc && proxyUrl ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedDoc.file_name}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={proxyUrl} download style={poLink}><Download size={12} /> Download</a>
                    <button onClick={openInDropbox} style={{ ...poLink, background: 'none', border: 'none', cursor: 'pointer' }}><ExternalLink size={12} /> Dropbox</button>
                    <a href={proxyUrl} target="_blank" rel="noreferrer" style={poLink}><Maximize2 size={12} /> Full</a>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <iframe key={`${selectedDoc.id}-${cacheBust}`} src={proxyUrl} title={selectedDoc.file_name} style={{ flex: 1, minWidth: 0, height: 660, border: '1px solid var(--border-subtle)', borderRadius: 8, background: '#e8eaed' }} />
                  <div style={{ width: 230, flexShrink: 0, border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 12px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>Document Approval</div>
                      <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 1 }}>Client PM → GM · Accountant optional</div>
                    </div>
                    <div style={{ padding: 12 }}>
                      <DocumentApprovalRail
                        projectId={projectId}
                        documentId={selectedDoc.id}
                        docType="po_bo"
                        catGroup={catGroup}
                        versionNum={selectedDoc.dropbox_version ?? selectedDoc.version}
                        userId={userId ?? ''}
                        userPerms={userPerms}
                        userSignature={userSig}
                        stages={approvalStagesFor('po_bo', catGroup).map(st => ({ label: st.label, hint: st.hint }))}
                        onNeedSignature={cb => { pendingApproveRef.current = cb; setShowSigPad(true); }}
                        onChanged={() => { setCacheBust(Date.now()); onSynced?.(); }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '70px 20px', textAlign: 'center', color: 'var(--fg-faint)', fontSize: 13 }}>
                {hasPriceList ? 'Generate a Purchase Order from the left.' : 'Approve the Item Price List, then generate the PO.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {showSigPad && (
        <SignaturePad
          existingBase64={userSig ?? null}
          onSaved={(base64) => { setUserSig(base64); setShowSigPad(false); const resume = pendingApproveRef.current; pendingApproveRef.current = null; if (resume) setTimeout(resume, 50); }}
          onClose={() => { setShowSigPad(false); pendingApproveRef.current = null; }}
        />
      )}
    </div>
  );
}

const poLink: React.CSSProperties = { fontSize: 11, color: 'var(--fg-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' };
