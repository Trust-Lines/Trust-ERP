'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { FileText, Image as ImageIcon, Link2, Plus, Video } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { FORM_BOX } from '@/components/platform/customers/customer-detail/ui';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/select';
import { REGIONS, SERVICE_LINES } from '@/lib/regions';
import { FIELD } from '@/components/platform/shared/panelStyles';
import { CHIP, HEADING } from './shared';
import { type Need } from './types';

const FILE_BTN = 'h-auto min-h-10 cursor-pointer gap-2 rounded-[6px] font-medium';
const LABEL = 'text-[12px] font-medium leading-4 text-ui-body';
const SELECT = 'h-10 w-full rounded-[6px] border-ui-input-border bg-ui-input-bg px-3 text-[13px] text-[var(--color-secondary-700)] dark:rounded-[6px] dark:border-ui-input-border dark:bg-ui-input-bg dark:px-3 dark:text-ui-heading';

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
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Could not load documents'); return; }
      setDocs(body.documents ?? []);
      setProjectCode(body.projectCode ?? null);
    } catch { toast.error('Could not load documents'); }
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
    <div className={cn(FORM_BOX, 'flex flex-col gap-2.5')}>
      <div className="flex items-center gap-2">
        <h3 className={cn('m-0 text-[13px] font-semibold', HEADING)}>Evidence</h3>
        {projectCode && <span className={cn(CHIP, 'bg-[var(--status-t9-bg)] text-[var(--status-t9-fg)]')}>{projectCode}</span>}
      </div>

      {docs.length === 0 ? (
        <p className="m-0 text-[12px] text-ui-text-secondary">
          No layout, photo, or reference link yet — stays a Potential until one is added.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {docs.map(d => {
            const Icon = DOC_ICON[d.category];
            return (
              <div key={d.id} className="flex items-center gap-1.5 text-[12px] text-ui-body">
                <Icon size={13} />
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer" className="break-all text-ui-link">{d.url}</a>
                ) : (
                  <span>{d.file_name}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && !setupReady && (
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Region</span>
            <Select aria-label="Region" className={SELECT} value={region} onValueChange={v => setRegion(v ?? '')}
              options={[{ value: '', label: '—' }, ...REGIONS.map(r => ({ value: r.code, label: r.label }))]} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Service line</span>
            <Select aria-label="Service line" className={SELECT} value={serviceLine} onValueChange={v => setServiceLine(v ?? '')}
              options={[{ value: '', label: '—' }, ...SERVICE_LINES.map(s => ({ value: s.value, label: s.label }))]} />
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>State</span>
            <input className={FIELD} value={state} onChange={e => setState(e.target.value)} placeholder="e.g. NY" />
          </label>
          <Button size="md" loading={savingSetup} disabled={savingSetup || !draftReady} onClick={saveSetup}>Save</Button>
          <p className="col-span-full m-0 text-[11px] text-ui-text-secondary">
            Set these once so a project folder can be created the moment a document/link is attached.
          </p>
        </div>
      )}

      {canEdit && setupReady && (
        <div className="flex flex-wrap gap-2">
          <label className={buttonVariants({ variant: 'outline', className: FILE_BTN })}>
            <FileText aria-hidden /> Layout
            <input type="file" hidden disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile('layout', f); e.target.value = ''; }} />
          </label>
          <label className={buttonVariants({ variant: 'outline', className: FILE_BTN })}>
            <ImageIcon aria-hidden /> Photo
            <input type="file" hidden disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile('photo', f); e.target.value = ''; }} />
          </label>
          <Select aria-label="Link type" className={cn(SELECT, 'w-[140px]')} value={linkCategory}
            onValueChange={v => setLinkCategory((v ?? 'matterport') as 'matterport' | 'link')}
            options={[{ value: 'matterport', label: 'Matterport' }, { value: 'link', label: 'Link' }]} />
          <input aria-label="Link URL" className={cn(FIELD, 'w-auto min-w-[160px] flex-1')}
            placeholder="https://…" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addLink(); }} />
          <Button size="md" loading={uploading} disabled={uploading || !linkUrl.trim()} onClick={addLink}>
            <Plus aria-hidden /> Add
          </Button>
        </div>
      )}
    </div>
  );
}
