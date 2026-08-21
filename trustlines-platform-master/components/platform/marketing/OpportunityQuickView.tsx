'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { X, Loader2, ExternalLink, Paperclip, Send, Image as ImageIcon, Trash2, Link2, Upload, FileText } from 'lucide-react';
import { TaskList } from '@/components/platform/shared/TaskList';
import { DropboxFileList } from '@/components/platform/shared/DropboxFileList';
import { TagMultiSelect } from './TagMultiSelect';
import { hashColor } from '@/lib/marketing/pillColor';
import { normalizeIndustry, INDUSTRY_COLOR } from '@/lib/marketing/industry';
import { OPPORTUNITY_STAGE_LABEL } from '@/lib/marketing/classification';
import { REGIONS } from '@/lib/regions';
import type { OpportunityStage, PotentialStatus } from '@/types/database';

type Deal = Record<string, unknown>;
interface ProspectInfo { display_name: string; industry: string | null; brand_name: string | null }
interface ContactOption { id: string; name: string }
interface ProjectInfo { code: string; dropbox_root_path: string | null }
interface NeedNote {
  id: string; author_name: string | null; author_id?: string | null; body: string;
  image_path: string | null; link_url: string | null; link_title: string | null; link_thumbnail_url: string | null;
  source_created_at: string | null; created_at: string;
}
interface NeedFile { id: string; dropbox_path: string; file_name: string; uploaded_by: string | null; uploaded_by_name: string | null; created_at: string }
interface Tag { name: string; color: string }

const STAGE_OPTS: [string, string][] = Object.entries(OPPORTUNITY_STAGE_LABEL);
const POTENTIAL_STATUS_LABEL: Record<PotentialStatus, string> = {
  identified: 'Identified', nurture: 'Nurture', waiting_timing: 'Waiting Timing',
  contact_due: 'Contact Due', converted: 'Converted', lost: 'Lost', cancelled: 'Cancelled',
};
const POTENTIAL_STATUS_OPTS: [string, string][] = Object.entries(POTENTIAL_STATUS_LABEL);

export function OpportunityQuickView({ opportunityId, kind = 'opportunity', assignees, onClose, onChanged, canEdit = true }: {
  opportunityId: string;
  kind?: 'opportunity' | 'potential';
  assignees: { id: string; full_name: string }[];
  onClose: () => void;
  onChanged?: (patch: Record<string, unknown>) => void;
  canEdit?: boolean;
}) {
  const apiBase = `/api/marketing/${kind === 'potential' ? 'potentials' : 'opportunities'}/${opportunityId}`;
  const [opp, setOpp] = useState<Deal | null>(null);
  const [prospect, setProspect] = useState<ProspectInfo | null>(null);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [notes, setNotes] = useState<NeedNote[]>([]);
  const [files, setFiles] = useState<NeedFile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageLinks, setImageLinks] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [draftImage, setDraftImage] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const noteFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/marketing/opportunities/tag-options').then(r => r.json()).then(b => setTagOptions(b.options ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiBase);
      const body = await res.json();
      setOpp((kind === 'potential' ? body.potential : body.opportunity) ?? null);
      setProspect(body.prospect ?? null);
      setContacts(body.contacts ?? []);
      setProject(body.project ?? null);
      setNotes(body.notes ?? []);
      setFiles(body.files ?? []);
    } catch { }
    finally { setLoaded(true); }
  }, [apiBase, kind]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const missing = notes.filter(n => n.image_path && !imageLinks[n.image_path]);
    if (!missing.length) return;
    (async () => {
      const entries = await Promise.all(missing.map(async n => {
        const res = await fetch(`${apiBase}/dropbox-link?path=${encodeURIComponent(n.image_path!)}`);
        const body = await res.json().catch(() => ({}));
        return res.ok && body.link ? [n.image_path as string, body.link as string] as const : null;
      }));
      const found = Object.fromEntries(entries.filter((e): e is readonly [string, string] => e !== null));
      if (Object.keys(found).length) setImageLinks(prev => ({ ...prev, ...found }));
    })();
  }, [notes, apiBase]);

  const mouseDownOnBackdrop = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (lightbox) { setLightbox(null); return; }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, lightbox]);

  async function saveField(name: string, value: unknown, extra?: Record<string, unknown>) {
    setOpp(prev => (prev ? { ...prev, [name]: value, ...extra } : prev));
    setSaving(true);
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [name]: value, ...extra }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Could not save'); load(); return; }
      onChanged?.({ [name]: value, ...extra });
    } catch { toast.error('Could not save'); load(); }
    finally { setSaving(false); }
  }

  function changeStage(next: string) {
    if (next === opp?.stage) return;
    const reason = window.prompt(`Move to "${OPPORTUNITY_STAGE_LABEL[next as OpportunityStage]}" — why?`);
    if (!reason?.trim()) return;
    saveField('stage', next, { admin_correction_reason: reason.trim() });
  }

  async function postComment() {
    if (!draft.trim() && !draftImage) return;
    setPosting(true);
    try {
      let res: Response;
      if (draftImage) {
        const form = new FormData();
        form.set('body', draft.trim());
        form.set('image', draftImage);
        res = await fetch(`${apiBase}/notes`, { method: 'POST', body: form });
      } else {
        res = await fetch(`${apiBase}/notes`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: draft.trim() }),
        });
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Could not post'); return; }
      setNotes(prev => [...prev, body.note]);
      setDraft('');
      setDraftImage(null);
      if (noteFileInputRef.current) noteFileInputRef.current.value = '';
    } finally { setPosting(false); }
  }

  async function deleteNote(n: NeedNote) {
    if (!window.confirm('Permanently delete this comment? This cannot be undone.')) return;
    const res = await fetch(`${apiBase}/notes/${n.id}`, { method: 'DELETE' });
    if (!res.ok) { const body = await res.json().catch(() => ({})); toast.error(body.error ?? 'Could not delete'); return; }
    setNotes(prev => prev.filter(x => x.id !== n.id));
  }

  async function uploadFile(f: File) {
    setUploadingFile(true);
    try {
      const form = new FormData();
      form.set('file', f);
      const res = await fetch(`${apiBase}/files`, { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Could not upload'); return; }
      setFiles(prev => [body.file, ...prev]);
    } finally { setUploadingFile(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  async function deleteFile(f: NeedFile) {
    if (!window.confirm(`Remove "${f.file_name}" from this ${kind === 'potential' ? 'Potential' : 'Opportunity'}? (file itself stays in Dropbox)`)) return;
    const res = await fetch(`${apiBase}/files/${f.id}`, { method: 'DELETE' });
    if (!res.ok) { const body = await res.json().catch(() => ({})); toast.error(body.error ?? 'Could not remove'); return; }
    setFiles(prev => prev.filter(x => x.id !== f.id));
  }

  async function viewFile(f: NeedFile) {
    const res = await fetch(`${apiBase}/dropbox-link?path=${encodeURIComponent(f.dropbox_path)}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.link) { toast.error(body.error ?? 'Could not open file'); return; }
    window.open(body.link, '_blank', 'noopener,noreferrer');
  }

  const v = (k: string) => (opp?.[k] as string | number | null) ?? '';
  const tags = (opp?.tags as Tag[] | null) ?? [];
  const businessTypes = (opp?.business_types as string[] | null) ?? [];
  const title = (opp?.title as string) || prospect?.display_name || (kind === 'potential' ? 'Potential' : 'Opportunity');

  return (
    <div
      onMouseDown={e => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={e => { if (mouseDownOnBackdrop.current && e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3vh 16px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', width: '96vw', maxWidth: 1680, height: '92vh',
          boxShadow: '0 12px 48px rgba(0,0,0,.3)', display: 'flex', overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {project?.code && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-faint)' }}>{project.code}</div>}
              <h2 style={{ fontSize: 19, fontWeight: 700, margin: '2px 0 0' }}>{title}</h2>
              <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 2 }}>
                {prospect?.industry || '—'} · {prospect?.brand_name || '—'}
              </div>
              <div style={{ marginTop: 6 }}>
                {canEdit ? (
                  <TagMultiSelect
                    values={tags.map(t => t.name)}
                    options={tagOptions}
                    placeholder="Add tag…"
                    onChange={next => {
                      const nextTags = next.map(name => tags.find(t => t.name === name) ?? { name, color: hashColor(name) });
                      saveField('tags', nextTags);
                    }}
                  />
                ) : tags.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {tags.map(t => (
                      <span key={t.name} style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: t.color || 'var(--bg-subtle)', color: readableOn(t.color) }}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            {saving && <Loader2 size={14} className="qv-spin" style={{ color: 'var(--fg-faint)', marginTop: 6 }} />}
            <Link href={`/marketing/prospects/${opp?.prospect_id}`} title="Contacts, locations & other Needs for this Lead"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--fg-faint)', textDecoration: 'none', marginTop: 6 }}>
              <ExternalLink size={12} /> Lead profile
            </Link>
          </div>

          <style>{`.qv-spin{animation:qv-spin 1s linear infinite}@keyframes qv-spin{to{transform:rotate(360deg)}}`}</style>

          {!loaded ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-subtle)' }}><Loader2 size={18} className="qv-spin" /> Loading…</div>
          ) : !opp ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-subtle)' }}>Couldn&apos;t load this {kind === 'potential' ? 'Potential' : 'Opportunity'}.</div>
          ) : (
            <div style={{ padding: '16px 20px 20px' }}>
              <SectionLabel>Fields</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2px 24px', marginBottom: 20 }}>
                {kind === 'opportunity' ? (
                  <Row label="Stage"><Sel value={String(v('stage'))} onChange={changeStage} opts={STAGE_OPTS} /></Row>
                ) : (
                  <Row label="Status">
                    <Sel value={String(v('status') || 'identified')} onChange={x => saveField('status', x)} opts={POTENTIAL_STATUS_OPTS} />
                  </Row>
                )}
                <Row label="Region">
                  <Sel value={String(v('region'))} onChange={x => saveField('region', x || null)}
                    opts={[['', '—'], ...REGIONS.map(r => [r.code, r.label] as [string, string])]}
                    emphasize={!v('region')} />
                  {!v('region') && <div style={{ fontSize: 11, color: 'var(--status-warning-fg)', marginTop: 2 }}>Set a region so your team can see this</div>}
                </Row>
                <Row label="Priority">
                  <Sel value={String(v('priority') || 'medium')} onChange={x => saveField('priority', x)}
                    opts={[['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]} />
                </Row>
                {kind === 'opportunity' ? (
                  <>
                    <Row label="Marketing Owner">
                      <Sel value={String(v('marketing_owner_id'))} onChange={x => saveField('marketing_owner_id', x || null)}
                        opts={[['', 'Unassigned'], ...assignees.map(a => [a.id, a.full_name] as [string, string])]} />
                    </Row>
                    <Row label="Sales Owner">
                      <Sel value={String(v('sales_owner_id'))} onChange={x => saveField('sales_owner_id', x || null)}
                        opts={[['', 'Unassigned'], ...assignees.map(a => [a.id, a.full_name] as [string, string])]} />
                    </Row>
                  </>
                ) : (
                  <Row label="Assignee">
                    <Sel value={String(v('assigned_to'))} onChange={x => saveField('assigned_to', x || null)}
                      opts={[['', 'Unassigned'], ...assignees.map(a => [a.id, a.full_name] as [string, string])]} />
                  </Row>
                )}
                <Row label="Contact">
                  <Sel value={String(v('primary_contact_id'))} onChange={x => saveField('primary_contact_id', x || null)}
                    opts={[['', '—'], ...contacts.map(c => [c.id, c.name] as [string, string])]} />
                </Row>
                <Row label="Deal Size"><Inp type="number" value={v('estimated_value')} ph="e.g. 250000" onSave={x => saveField('estimated_value', x === '' ? null : Number(x))} /></Row>
                <Row label="Deposit"><span style={ro}>{v('deposit') !== '' ? `$${Number(v('deposit')).toLocaleString('en-US')}` : '—'}</span></Row>
                <Row label="Payment"><span style={ro}>{String(v('payment_raw')) || '—'}</span></Row>
                <Row label="Targeted"><span style={ro}>{opp?.targeted ? 'Yes' : 'No'}</span></Row>
                {kind === 'opportunity' ? (
                  <>
                    <Row label="Due date (Deadline)"><Inp type="date" value={v('deadline')} onSave={x => saveField('deadline', x || null)} /></Row>
                    <Row label="Expected Close"><Inp type="date" value={v('expected_close_date')} onSave={x => saveField('expected_close_date', x || null)} /></Row>
                    <Row label="Next Action"><Inp value={v('next_action')} ph="e.g. Send estimate" onSave={x => saveField('next_action', x)} /></Row>
                    <Row label="Next Action Date"><Inp type="date" value={v('next_action_date')} onSave={x => saveField('next_action_date', x || null)} /></Row>
                    <Row label="Date done"><span style={ro}>{v('closed_at') ? new Date(String(v('closed_at'))).toLocaleDateString('en-US') : '—'}</span></Row>
                  </>
                ) : (
                  <>
                    <Row label="Due date"><span style={ro}>{v('due_date') ? new Date(String(v('due_date'))).toLocaleDateString('en-US') : '—'}</span></Row>
                    <Row label="Target Contact Date"><Inp type="date" value={v('target_contact_date')} onSave={x => saveField('target_contact_date', x || null)} /></Row>
                    <Row label="Date done"><span style={ro}>{v('date_done') ? new Date(String(v('date_done'))).toLocaleDateString('en-US') : '—'}</span></Row>
                  </>
                )}
                <Row label="Source"><span style={ro}>{String(v('source_raw_label') || v('source_label')) || '—'}</span></Row>
                <Row label="Notes">
                  <Inp value={v(kind === 'opportunity' ? 'description' : 'notes')} ph="Notes…" onSave={x => saveField(kind === 'opportunity' ? 'description' : 'notes', x)} />
                </Row>
              </div>

              <SectionLabel>ClickUp Fields</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2px 24px', marginBottom: 20 }}>
                <Row label="Direct Contact"><span style={ro}>{String(v('direct_contact_raw')) || '—'}</span></Row>
                <Row label="01-State"><span style={ro}>{String(v('state')) || '—'}</span></Row>
                <Row label="11-Location"><span style={ro}>{String(v('formatted_address')) || '—'}</span></Row>
                <Row label="Brand"><span style={ro}>{String(v('brand')) || '—'}</span></Row>
                <Row label="Industry">
                  {(() => {
                    const industry = normalizeIndustry(v('industry_raw') as string);
                    if (!industry) return <span style={ro}>—</span>;
                    const bg = INDUSTRY_COLOR[industry];
                    return <span style={{ fontWeight: 700, fontSize: 11, padding: '3px 10px', borderRadius: 999, background: bg, color: readableOn(bg) }}>{industry}</span>;
                  })()}
                </Row>
                <Row label="Project Type"><span style={ro}>{String(v('project_type_raw')) || '—'}</span></Row>
                <Row label="Business Type">
                  <span style={ro}>{businessTypes.length ? businessTypes.join(', ') : '—'}</span>
                </Row>
                <Row label="Status OP"><span style={ro}>{String(v('external_stage_label')) || '—'}</span></Row>
                <Row label="Request"><span style={ro}>{String(v('request_raw')) || '—'}</span></Row>
                <Row label="To Do"><span style={ro}>{String(v('to_do_raw')) || '—'}</span></Row>
              </div>
              {!!v('source_description_raw') && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <FileText size={12} style={{ color: 'var(--fg-faint)' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, color: 'var(--fg-default)', background: 'var(--bg-subtle)', borderRadius: 8, padding: '10px 12px' }}>
                    {String(v('source_description_raw'))}
                  </div>
                </div>
              )}

              {kind === 'opportunity' && (
                <div style={{ marginBottom: 16 }}>
                  <TaskList apiBasePath={apiBase} assignees={assignees} />
                </div>
              )}

              <SectionLabel>Files</SectionLabel>
              <div style={{ marginBottom: 16 }}>
                {project?.dropbox_root_path && (
                  <div style={{ marginBottom: 10 }}>
                    <DropboxFileList rootPath={project.dropbox_root_path} rootLabel={project.code} />
                  </div>
                )}
                {files.map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <button onClick={() => viewFile(f)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-fg, var(--fg-default))', fontSize: 12.5, textAlign: 'left', flex: 1, minWidth: 0, textDecoration: 'underline' }}>
                      {f.file_name}
                    </button>
                    <span style={{ fontSize: 10.5, color: 'var(--fg-faint)' }}>{f.uploaded_by_name ?? ''}</span>
                    {canEdit && (
                      <button onClick={() => deleteFile(f)} title="Remove (temporary, dev-only)" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)', padding: 0, display: 'flex' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {!files.length && !project?.dropbox_root_path && (
                  <div style={{ fontSize: 12.5, color: 'var(--fg-faint)', padding: '6px 0' }}>No files yet.</div>
                )}
                {canEdit && (
                  <div style={{ marginTop: 8 }}>
                    <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
                    <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}>
                      {uploadingFile ? <Loader2 size={13} className="qv-spin" /> : <Upload size={13} />} Attach file
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ width: 360, flexShrink: 0, borderLeft: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', background: 'var(--bg-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Activity</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)', padding: 4 }} aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'grid', gap: 10, alignContent: 'start' }}>
            {notes.length === 0 && loaded && (
              <div style={{ fontSize: 12.5, color: 'var(--fg-subtle)', textAlign: 'center', marginTop: 24 }}>No activity yet.</div>
            )}
            {notes.map(n => (
              <div key={n.id} style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 12.5 }}>{n.author_name || 'Unknown'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--fg-subtle)', fontSize: 11 }}>
                      {n.source_created_at ? new Date(n.source_created_at).toLocaleDateString('en-US') : ''}
                    </span>
                    {canEdit && (
                      <button onClick={() => deleteNote(n)} title="Delete (temporary, dev-only)" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)', padding: 0, display: 'flex' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                {n.body && n.body !== n.link_url && <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, color: 'var(--fg-default)' }}>{n.body}</div>}
                {n.link_url && (
                  <a href={n.link_url} target="_blank" rel="noopener noreferrer"
                    style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 10px', background: 'var(--bg-subtle)' }}>
                    {n.link_thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={n.link_thumbnail_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Link2 size={16} style={{ color: 'var(--fg-faint)' }} />
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-default)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.link_title || n.link_url}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--fg-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.link_url}</div>
                    </div>
                  </a>
                )}
                {n.image_path && (
                  imageLinks[n.image_path] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageLinks[n.image_path]}
                      alt=""
                      onClick={() => setLightbox(imageLinks[n.image_path!])}
                      style={{ marginTop: 6, maxWidth: 140, maxHeight: 140, borderRadius: 6, cursor: 'zoom-in', display: 'block', border: '1px solid var(--border-subtle)' }}
                    />
                  ) : (
                    <div style={{ marginTop: 6, width: 140, height: 90, borderRadius: 6, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-faint)' }}>
                      <ImageIcon size={16} />
                    </div>
                  )
                )}
              </div>
            ))}
          </div>

          {canEdit && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 12, background: 'var(--bg-surface)' }}>
              {draftImage && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--fg-subtle)', marginBottom: 6 }}>
                  <ImageIcon size={12} /> {draftImage.name}
                  <button onClick={() => { setDraftImage(null); if (noteFileInputRef.current) noteFileInputRef.current.value = ''; }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)' }}>
                    <X size={12} />
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                <textarea
                  className="form-input"
                  placeholder="Write a comment…"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  rows={2}
                  style={{ flex: 1, resize: 'none', fontSize: 12.5 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <input ref={noteFileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => setDraftImage(e.target.files?.[0] ?? null)} />
                  <button className="btn btn-ghost btn-sm" onClick={() => noteFileInputRef.current?.click()} title="Attach image">
                    <Paperclip size={14} />
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={postComment} disabled={posting || (!draft.trim() && !draftImage)} title="Post">
                    {posting ? <Loader2 size={14} className="qv-spin" /> : <Send size={14} />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}
        >
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 24, background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }} aria-label="Close image">
            <X size={26} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function readableOn(bg: string): string {
  if (!bg) return 'var(--fg-default)';
  const hex = bg.replace('#', '');
  if (hex.length !== 6) return '#fff';
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000' : '#fff';
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{children}</div>;
}

const ro: React.CSSProperties = { fontSize: 13, color: 'var(--fg-muted)' };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', minHeight: 34 }}>
      <div style={{ width: 130, flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)' }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

const cellInput: React.CSSProperties = {
  width: '100%', fontSize: 13, padding: '3px 6px', border: '1px solid transparent',
  borderRadius: 5, background: 'transparent', color: 'var(--fg-default)',
};

function Inp({ value, onSave, type = 'text', ph }: { value: string | number; onSave: (v: string) => void; type?: string; ph?: string }) {
  const [val, setVal] = useState(String(value ?? ''));
  useEffect(() => { setVal(String(value ?? '')); }, [value]);
  return (
    <input
      type={type} value={val} placeholder={ph ?? '—'}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { if (val !== String(value ?? '')) onSave(val); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      style={cellInput}
      onFocus={e => { e.target.style.border = '1px solid var(--border-default)'; e.target.style.background = 'var(--bg-surface)'; }}
      onBlurCapture={e => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent'; }}
    />
  );
}

function Sel({ value, onChange, opts, emphasize }: { value: string; onChange: (v: string) => void; opts: [string, string][]; emphasize?: boolean }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...cellInput, border: `1px solid ${emphasize ? 'var(--status-warning)' : 'var(--border-subtle)'}`, background: 'var(--bg-surface)' }}>
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
