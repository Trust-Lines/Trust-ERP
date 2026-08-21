'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, UploadCloud, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Portal } from '@/components/platform/shared/Portal';
import type { DocType } from '@/types/database';
import { PROD_DOC_TYPES, PROD_TYPES } from '@/lib/dropbox/paths';
import type { ProdType } from '@/lib/dropbox/paths';

interface FileUploadZoneProps {
  projectId:       string;
  projectCode:     string;
  dropboxRootPath: string | null;
  userRole:        string;
  presetDocType?:  string | null;
  presetProdType?: ProdType | null;
  onSuccess: () => void;
  onClose:   () => void;
}

const DOC_TYPE_OPTIONS: { value: DocType; label: string }[] = [
  { value: 'plan_layout',           label: 'Plan Layout' },
  { value: 'proposal',              label: 'Design Proposal' },
  { value: 'construction_drawings', label: 'Construction Drawings' },
  { value: 'item_plan',             label: 'Item Plan' },
  { value: 'item_list',             label: 'Item List' },
  { value: 'price_list',            label: 'Item Price List' },
  { value: 'book',                  label: 'Book' },
  { value: 'po_bo',                 label: 'Purchase Order (PO)' },
  { value: 'pf',                    label: 'Proforma Invoice (PFS)' },
  { value: 'qc_checklist',          label: 'QC Checklist' },
  { value: 'packing_list',          label: 'Packing List' },
  { value: 'shipment_doc',          label: 'Shipment Document' },
  { value: 'delivery_confirm',      label: 'Delivery Confirmation' },
  { value: 'closed_deal_email',     label: 'Closed Deal Email' },
];

const VERSION_LESS = new Set(['closed_deal_email', 'qc_checklist', 'packing_list', 'shipment_doc', 'delivery_confirm']);

function needsProdType(docType: string) { return PROD_DOC_TYPES.has(docType); }
function needsVersion(docType: string)  { return !VERSION_LESS.has(docType); }

const label12: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--fg-muted)', marginBottom: 5,
};
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px',
  border: '1px solid var(--border-default)', borderRadius: 5,
  fontSize: 13, background: 'white', color: 'var(--fg-default)', fontFamily: 'inherit',
};

export function FileUploadZone({
  projectId, projectCode, dropboxRootPath, userRole,
  presetDocType, presetProdType,
  onSuccess, onClose,
}: FileUploadZoneProps) {
  const [docType, setDocType]           = useState<DocType>((presetDocType as DocType | undefined) ?? 'plan_layout');
  const [prodType, setProdType]         = useState<ProdType | ''>(presetProdType ?? '');
  const [dropboxVersion, setDropboxVersion] = useState<number>(1);
  const [availableVersions, setVersions]    = useState<number[]>([]);
  const [nextVersion, setNextVersion]       = useState<number>(1);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [file, setFile]                 = useState<File | null>(null);
  const [dragOver, setDragOver]         = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [clientApproved, setClientApproved] = useState(false);
  const [notes, setNotes]               = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dropboxRootPath || !needsVersion(docType)) return;
    if (needsProdType(docType) && !prodType) return;

    setLoadingVersions(true);
    const params = new URLSearchParams({
      projectRoot: dropboxRootPath,
      docType,
      ...(prodType ? { prodType } : {}),
    });
    fetch(`/api/dropbox/list-versions?${params}`)
      .then(r => r.json() as Promise<{ versions?: number[]; nextVersion?: number; error?: string }>)
      .then(data => {
        const vv  = data.versions ?? [];
        const nxt = data.nextVersion ?? 1;
        setVersions(vv);
        setNextVersion(nxt);
        setDropboxVersion(vv.length > 0 ? vv[vv.length - 1] : nxt);
      })
      .catch(() => { setVersions([]); setNextVersion(1); setDropboxVersion(1); })
      .finally(() => setLoadingVersions(false));
  }, [docType, prodType, dropboxRootPath]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  async function handleUpload() {
    if (!file) { toast.error('Please select a file'); return; }
    if (needsProdType(docType) && !prodType) { toast.error('Select a production type'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file',           file);
      fd.append('projectId',      projectId);
      fd.append('docType',        docType);
      fd.append('dropboxVersion', String(dropboxVersion));
      if (prodType)       fd.append('prodType',      prodType);
      if (notes)          fd.append('notes',         notes);
      if (clientApproved) fd.append('clientApproved','true');

      const res = await fetch('/api/files/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const { error } = await res.json() as { error: string };
        throw new Error(error);
      }
      toast.success('Document uploaded');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally { setUploading(false); }
  }

  const isNewVersion = dropboxVersion === nextVersion && !availableVersions.includes(dropboxVersion);

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(15,42,68,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  };
  const box: React.CSSProperties = {
    background: 'white', borderRadius: 10, width: '100%', maxWidth: 480,
    boxShadow: '0 24px 64px rgba(15,42,68,0.22)',
    fontFamily: 'var(--font-ui)',
    maxHeight: '90vh', overflowY: 'auto',
  };

  return (
    <Portal>
      <div style={overlay} onClick={onClose}>
        <div style={box} onClick={e => e.stopPropagation()}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--fg-default)' }}>Upload document</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', padding: 4, borderRadius: 4, lineHeight: 0 }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {!presetDocType && (
              <div>
                <label style={label12}>Document type <span style={{ color: 'var(--status-danger)' }}>*</span></label>
                <select
                  value={docType}
                  onChange={e => { setDocType(e.target.value as DocType); setFile(null); setProdType(presetProdType ?? ''); }}
                  style={selectStyle}
                >
                  {DOC_TYPE_OPTIONS
                    .filter(t => !(t.value === 'pf' && userRole === 'tlines_pm'))
                    .map(t => <option key={t.value} value={t.value}>{t.label}</option>)
                  }
                </select>
              </div>
            )}

            {needsProdType(docType) && !presetProdType && (
              <div>
                <label style={label12}>Production type <span style={{ color: 'var(--status-danger)' }}>*</span></label>
                <select value={prodType} onChange={e => setProdType(e.target.value as ProdType)} style={selectStyle}>
                  <option value="">Select type…</option>
                  {PROD_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                </select>
              </div>
            )}

            {needsVersion(docType) && (!needsProdType(docType) || prodType) && (
              <div>
                <label style={label12}>
                  Version
                  {loadingVersions && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--fg-faint)', fontWeight: 400 }}>Loading…</span>}
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {availableVersions.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setDropboxVersion(v)}
                      style={{
                        padding: '5px 12px', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: `1.5px solid ${dropboxVersion === v ? 'var(--brand-navy)' : 'var(--border-default)'}`,
                        background: dropboxVersion === v ? 'var(--brand-navy)' : 'white',
                        color: dropboxVersion === v ? 'white' : 'var(--fg-default)',
                      }}
                    >
                      V{v}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDropboxVersion(nextVersion)}
                    style={{
                      padding: '5px 12px', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: `1.5px dashed ${dropboxVersion === nextVersion ? 'var(--brand-teal)' : 'var(--border-default)'}`,
                      background: dropboxVersion === nextVersion ? 'var(--brand-teal-100)' : 'white',
                      color: dropboxVersion === nextVersion ? 'var(--brand-teal-600)' : 'var(--fg-subtle)',
                    }}
                  >
                    + V{nextVersion} (new)
                  </button>
                </div>
                {isNewVersion && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--fg-subtle)', padding: '5px 8px', background: 'var(--bg-subtle)', borderRadius: 4 }}>
                    A new V{nextVersion} folder will be created in Dropbox.
                  </div>
                )}
              </div>
            )}

            {docType === 'proposal' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 6, border: '1px solid var(--border-default)' }}>
                <input
                  id="clientApproved"
                  type="checkbox"
                  checked={clientApproved}
                  onChange={e => setClientApproved(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: 'var(--brand-teal)', cursor: 'pointer', flexShrink: 0 }}
                />
                <label htmlFor="clientApproved" style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-default)', cursor: 'pointer' }}>
                  Client approved this design proposal
                </label>
              </div>
            )}

            <div>
              <label style={label12}>File <span style={{ color: 'var(--status-danger)' }}>*</span></label>
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragOver || file ? 'var(--brand-teal)' : 'var(--border-default)'}`,
                  borderRadius: 6, padding: '24px 20px', textAlign: 'center', cursor: 'pointer',
                  background: dragOver || file ? 'var(--brand-teal-100)' : 'var(--bg-subtle)',
                  transition: 'all 120ms',
                }}
              >
                {file ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <FileText size={24} color="var(--brand-teal)" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-default)' }}>{file.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{(file.size / 1024).toFixed(0)} KB</span>
                    <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }}
                      style={{ fontSize: 11, color: 'var(--status-danger)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 2 }}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--fg-subtle)' }}>
                    <UploadCloud size={26} strokeWidth={1.5} />
                    <div style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: 'var(--brand-teal)' }}>Drop file here</span> or click to browse
                    </div>
                    <span style={{ fontSize: 11 }}>PDF · images · DWG accepted</span>
                  </div>
                )}
              </div>
              <input ref={inputRef} type="file" accept="application/pdf,image/*,.dwg,.dxf" style={{ display: 'none' }}
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>

            <div>
              <label style={label12}>Notes (optional)</label>
              <textarea
                rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Any notes about this file…"
                style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border-default)', borderRadius: 5, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border-subtle)' }}>
            <button onClick={onClose} disabled={uploading}
              style={{ padding: '7px 16px', borderRadius: 5, border: '1px solid var(--border-default)', background: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button onClick={handleUpload} disabled={uploading || !file || (needsProdType(docType) && !prodType)}
              style={{
                padding: '7px 18px', borderRadius: 5, border: 'none', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                background: uploading || !file ? 'var(--border-default)' : 'var(--brand-navy)',
                color: 'white', cursor: uploading || !file ? 'not-allowed' : 'pointer',
              }}>
              {uploading ? 'Uploading…' : `Upload to V${dropboxVersion}`}
            </button>
          </div>

        </div>
      </div>
    </Portal>
  );
}
