'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { FileText, Image as ImageIcon, Link2, Video, Loader2 } from 'lucide-react';
import { Select } from '@/components/platform/shared/Select';
import { REGIONS, SERVICE_LINES } from '@/lib/regions';
import { type Need } from './types';

interface NeedDocument {
  id: string; category: 'layout' | 'photo' | 'matterport' | 'link';
  dropbox_path: string | null; file_name: string | null; url: string | null; created_at: string;
}

const DOC_ICON: Record<NeedDocument['category'], React.ComponentType<{ size?: number }>> = {
  layout: FileText, photo: ImageIcon, matterport: Video, link: Link2,
};

export function NeedDocumentsSection({ need, canEdit, prospectId, onNeedChange, onSync }: {
  need: Need; canEdit: boolean; prospectId: string;
  onNeedChange: (n: Partial<Need> & { id: string }) => void;
  onSync: (opportunity: Record<string, unknown> | null, potential: Record<string, unknown> | null) => void;
}) {
  const [docs, setDocs] = useState<NeedDocument[]>([]);
  const [projectCode, setProjectCode] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [region, setRegion] = useState(need.region ?? '');
  const [serviceLine, setServiceLine] = useState(need.service_line ?? '');
  const [state, setState] = useState(need.state ?? '');
  const [savingSetup, setSavingSetup] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkCategory, setLinkCategory] = useState<'matterport' | 'link'>('matterport');
  const [linkUrl, setLinkUrl] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/marketing/prospects/${prospectId}/needs/${need.id}/documents`);
      const body = await res.json();
      setDocs(body.documents ?? []);
      setProjectCode(body.projectCode ?? null);
    } catch { }
    finally { setLoaded(true); }
  }, [prospectId, need.id]);

  useEffect(() => { load(); }, [load]);

  const setupReady = !!(need.region && need.service_line && need.state);
  const draftReady = !!(region && serviceLine && state.trim());

  async function saveSetup() {
    setSavingSetup(true);
    const res = await fetch(`/api/marketing/prospects/${prospectId}/needs/${need.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, service_line: serviceLine, state: state.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    setSavingSetup(false);
    if (!res.ok) { toast.error(body.error ?? 'Could not save'); return; }
    onNeedChange(body.need);
  }

  async function afterAdd(res: Response) {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Could not add'); return; }
    setDocs(prev => [...prev, body.document]);
    onNeedChange({
      id: need.id,
      classification: body.needClassification,
      classification_reasons: body.classification?.reasons ?? [],
      ...(body.project ? { project_id: body.project.id } : {}),
    });
    if (body.project) {
      setProjectCode(body.project.code);
      toast.success(`Evidence attached — became an Opportunity, project ${body.project.code} created`);
    } else if (body.projectWarning) {
      toast.success(body.opportunity ? 'Evidence attached — became an Opportunity' : 'Evidence attached', {
        description: `No project folder yet: ${body.projectWarning}`,
      });
    } else {
      toast.success('Evidence attached');
    }
    onSync(body.opportunity ?? null, body.potential ?? null);
  }

  async function uploadFile(category: 'layout' | 'photo', file: File) {
    setUploading(true);
    const form = new FormData();
    form.append('category', category);
    form.append('file', file);
    const res = await fetch(`/api/marketing/prospects/${prospectId}/needs/${need.id}/documents`, { method: 'POST', body: form });
    await afterAdd(res);
    setUploading(false);
  }

  async function addLink() {
    if (!linkUrl.trim()) return;
    setUploading(true);
    const form = new FormData();
    form.append('category', linkCategory);
    form.append('url', linkUrl.trim());
    const res = await fetch(`/api/marketing/prospects/${prospectId}/needs/${need.id}/documents`, { method: 'POST', body: form });
    setLinkUrl('');
    await afterAdd(res);
    setUploading(false);
  }

  if (!loaded) return null;

  return (
    <div style={{ marginTop: 8, marginBottom: 8, padding: '8px 10px', border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Evidence</div>
        {projectCode && <span className="pill" style={{ fontSize: 9.5, background: 'var(--status-success-bg)', color: 'var(--status-success-fg)' }}>{projectCode}</span>}
      </div>

      {docs.length === 0 ? (
        <div style={{ fontSize: 11.5, color: 'var(--fg-faint)', marginBottom: 6 }}>
          No layout, photo, or reference link yet — stays a Potential until one is added.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
          {docs.map(d => {
            const Icon = DOC_ICON[d.category];
            return (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Icon size={13} />
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-navy)' }}>{d.url}</a>
                ) : (
                  <span>{d.file_name}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && !setupReady && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', marginBottom: 2 }}>Region</div>
            <Select className="form-input" style={{ fontSize: 12, padding: '4px 6px' }} value={region} onChange={e => setRegion(e.target.value)}>
              <option value="">—</option>
              {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
            </Select>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', marginBottom: 2 }}>Service line</div>
            <Select className="form-input" style={{ fontSize: 12, padding: '4px 6px' }} value={serviceLine} onChange={e => setServiceLine(e.target.value)}>
              <option value="">—</option>
              {SERVICE_LINES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', marginBottom: 2 }}>State</div>
            <input className="form-input" style={{ fontSize: 12, padding: '4px 6px' }} value={state} onChange={e => setState(e.target.value)} placeholder="e.g. NY" />
          </div>
          <button className="btn btn-secondary btn-sm" disabled={savingSetup || !draftReady} onClick={saveSetup}>
            {savingSetup ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save'}
          </button>
          <div style={{ gridColumn: '1 / -1', fontSize: 10.5, color: 'var(--fg-faint)' }}>
            Set these once so a project folder can be created the moment a document/link is attached.
          </div>
        </div>
      )}

      {canEdit && setupReady && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
            <FileText size={12} /> Layout
            <input type="file" hidden disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile('layout', f); e.target.value = ''; }} />
          </label>
          <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
            <ImageIcon size={12} /> Photo
            <input type="file" hidden disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile('photo', f); e.target.value = ''; }} />
          </label>
          <Select className="form-input" style={{ fontSize: 12, padding: '3px 6px', width: 110 }} value={linkCategory} onChange={e => setLinkCategory(e.target.value as 'matterport' | 'link')}>
            <option value="matterport">Matterport</option>
            <option value="link">Link</option>
          </Select>
          <input className="form-input" style={{ fontSize: 12, padding: '3px 6px', flex: 1, minWidth: 160 }}
            placeholder="https://…" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addLink(); }} />
          <button className="btn btn-secondary btn-sm" disabled={uploading || !linkUrl.trim()} onClick={addLink}>
            {uploading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : '+ Add'}
          </button>
        </div>
      )}
    </div>
  );
}

