'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { X, Loader2, ExternalLink, Paperclip, Send, Image as ImageIcon, Trash2, Link2, Upload, FileText, ChevronDown } from 'lucide-react';
import { TaskList } from '@/components/platform/shared/TaskList';
import { DealProgressPanel } from '@/components/platform/shared/DealProgressPanel';
import { MarkdownLite } from '@/components/platform/shared/MarkdownLite';
import type { DealProgress } from '@/lib/sales/dealProgress';
import { DropboxFileList } from '@/components/platform/shared/DropboxFileList';
import { TagMultiSelect } from './TagMultiSelect';
import { ContactSearchSelect } from './ContactSearchSelect';
import { hashColor } from '@/lib/marketing/pillColor';
import { normalizeIndustry, INDUSTRY_COLOR } from '@/lib/marketing/industry';
import { OPPORTUNITY_STAGE_LABEL, TIMING_LABEL } from '@/lib/marketing/classification';
import { REGIONS } from '@/lib/regions';
import type { OpportunityStage, PotentialStatus, LeadTiming } from '@/types/database';

type Deal = Record<string, unknown>;
interface ProspectInfo { display_name: string; industry: string | null; brand_name: string | null }
interface ContactOption { id: string; name: string }
interface ProjectInfo { code: string; dropbox_root_path: string | null }
// Timing/has_active_project/etc. only ever live on the linked Need — never copied onto the
// Opportunity/Potential row itself (no columns there) — fetched read-only for display.
interface NeedInfo { timing: LeadTiming | null; has_active_project: boolean | null; expected_start_date: string | null; layout_available: boolean | null }
interface NeedNote {
  id: string; author_name: string | null; author_id?: string | null; body: string;
  image_path: string | null; link_url: string | null; link_title: string | null; link_thumbnail_url: string | null;
  source_created_at: string | null; created_at: string; external_source?: string | null;
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
  // Separate from `contacts` (that list is scoped to THIS record's own prospect) — once the
  // Contact field is re-linked via search to a contact belonging to a different Contact
  // entirely, its name has to be tracked independently to still render correctly.
  const [contactLabel, setContactLabel] = useState('');
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [need, setNeed] = useState<NeedInfo | null>(null);
  const [progress, setProgress] = useState<DealProgress | null>(null);
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
      const dealRow = (kind === 'potential' ? body.potential : body.opportunity) ?? null;
      setOpp(dealRow);
      setProspect(body.prospect ?? null);
      const contactList = body.contacts ?? [];
      setContacts(contactList);
      setContactLabel((contactList as ContactOption[]).find(c => c.id === dealRow?.primary_contact_id)?.name ?? '');
      setProject(body.project ?? null);
      setNeed(body.need ?? null);
      setProgress(body.progress ?? null);
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

  // Imported ClickUp Docs live in their own section; everything else is the comment thread.
  const docNotes = notes.filter(n => n.external_source === 'clickup_doc');
  const activityNotes = notes.filter(n => n.external_source !== 'clickup_doc');

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
          background: 'var(--bg-surface)', borderRadius: 20, width: '96vw', maxWidth: 1680, height: '92vh',
          boxShadow: '0 24px 64px rgba(15,42,68,.28), 0 4px 16px rgba(15,42,68,.12)', display: 'flex', overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 16, padding: '26px 28px 22px',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <div style={{
              width: 4, alignSelf: 'stretch', borderRadius: 4, flexShrink: 0,
              background: kind === 'potential' ? 'var(--brand-teal)' : 'var(--brand-navy)',
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {project?.code && (
                <div style={{
                  display: 'inline-flex', fontSize: 11.5, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  color: 'var(--fg-subtle)', letterSpacing: '0.03em', background: 'var(--bg-subtle)',
                  padding: '2px 8px', borderRadius: 6, marginBottom: 8,
                }}>
                  {project.code}
                </div>
              )}
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--fg-default)', letterSpacing: '-0.015em', lineHeight: 1.15 }}>{title}</h2>
              <div style={{ fontSize: 13.5, color: 'var(--fg-subtle)', marginTop: 5, fontWeight: 500 }}>
                {prospect?.industry || '—'} · {prospect?.brand_name || '—'}
              </div>
              <div style={{ marginTop: 12 }}>
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
                      <span key={t.name} style={{ fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: t.color || 'var(--bg-subtle)', color: readableOn(t.color) }}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {saving && <Loader2 size={14} className="qv-spin" style={{ color: 'var(--fg-faint)' }} />}
              <Link href={`/marketing/prospects/${opp?.prospect_id}`} title="Contacts, locations & other Needs for this Lead"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                  color: 'var(--fg-subtle)', textDecoration: 'none',
                  background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', padding: '6px 12px', borderRadius: 8,
                  transition: 'background .15s',
                }}>
                <ExternalLink size={12} /> Lead profile
              </Link>
            </div>
          </div>

          <style>{`
            .qv-spin{animation:qv-spin 1s linear infinite}
            @keyframes qv-spin{to{transform:rotate(360deg)}}
            .qv-field{transition:background .12s,box-shadow .12s}
            .qv-field:hover{background:var(--bg-surface);box-shadow:var(--shadow-xs)}
          `}</style>

          {!loaded ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-subtle)' }}><Loader2 size={18} className="qv-spin" /> Loading…</div>
          ) : !opp ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-subtle)' }}>Couldn&apos;t load this {kind === 'potential' ? 'Potential' : 'Opportunity'}.</div>
          ) : (
            <div style={{ padding: '22px 28px 24px' }}>
              {kind === 'opportunity' && (
                <div style={{ marginBottom: 24 }}>
                  <SectionLabel icon="◆">Start here</SectionLabel>
                  <StillToFillIn missing={missingForDeal(opp)} stage={String(opp.stage)} />
                  <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 10 }}>
                    <TaskList apiBasePath={apiBase} assignees={assignees} />
                  </div>
                </div>
              )}
              {kind === 'opportunity' && (
                <div style={{ marginBottom: 24 }}>
                  <SectionLabel icon="◆">Progress</SectionLabel>
                  <DealProgressPanel stage={String(opp.stage) as OpportunityStage} progress={progress} />
                </div>
              )}
              {docNotes.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <SectionLabel icon="◆">Documents</SectionLabel>
                  <DocumentsList docs={docNotes} />
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'start' }}>
                <Group title="Status & Ownership">
                  {kind === 'opportunity' ? (
                    <Row label="Stage"><Sel value={String(v('stage'))} onChange={changeStage} opts={STAGE_OPTS} /></Row>
                  ) : (
                    <Row label="Status">
                      <Sel value={String(v('status') || 'identified')} onChange={x => saveField('status', x)} opts={POTENTIAL_STATUS_OPTS} />
                    </Row>
                  )}
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
                    <ContactSearchSelect
                      value={String(v('primary_contact_id'))}
                      valueLabel={contactLabel || contacts.find(c => c.id === v('primary_contact_id'))?.name || ''}
                      disabled={!canEdit}
                      onChange={(id, name) => {
                        setContactLabel(name ?? '');
                        saveField('primary_contact_id', id);
                      }}
                    />
                  </Row>
                  <Row label="Region">
                    <Sel value={String(v('region'))} onChange={x => saveField('region', x || null)}
                      opts={[['', '—'], ...REGIONS.map(r => [r.code, r.label] as [string, string])]}
                      emphasize={!v('region')} />
                    {!v('region') && <div style={{ fontSize: 12, color: 'var(--status-warning-fg)', marginTop: 2 }}>Set a region so your team can see this</div>}
                  </Row>
                  {need?.timing && (
                    <Row label="Timing"><span style={ro}>{TIMING_LABEL[need.timing]}</span></Row>
                  )}
                  {Array.isArray(opp?.classification_reasons) && (opp!.classification_reasons as string[]).length > 0 && (
                    <Row label="Why this stage">
                      <span style={{ ...ro, fontSize: 12.5 }}>{(opp!.classification_reasons as string[]).join(' · ')}</span>
                    </Row>
                  )}
                </Group>

                <Group title="Value & Timeline">
                  <Row label="Deal Size"><Inp type="number" value={v('estimated_value')} ph="e.g. 250000" onSave={x => saveField('estimated_value', x === '' ? null : Number(x))} /></Row>
                  <Row label="Deposit"><Inp type="number" value={v('deposit')} ph="e.g. 5000" onSave={x => saveField('deposit', x === '' ? null : Number(x))} /></Row>
                  <Row label="Payment"><Inp value={v('payment_raw')} ph="Payment terms…" onSave={x => saveField('payment_raw', x)} /></Row>
                  <Row label="Targeted">
                    <Sel value={String(!!opp?.targeted)} onChange={x => saveField('targeted', x === 'true')}
                      opts={[['false', 'No'], ['true', 'Yes']]} />
                  </Row>
                  {kind === 'opportunity' ? (
                    <>
                      <Row label="Due date (Deadline)"><Inp type="date" value={v('deadline')} onSave={x => saveField('deadline', x || null)} /></Row>
                      <Row label="Expected Close"><Inp type="date" value={v('expected_close_date')} onSave={x => saveField('expected_close_date', x || null)} /></Row>
                      <Row label="Next Action"><Inp value={v('next_action')} ph="e.g. Send estimate" onSave={x => saveField('next_action', x)} /></Row>
                      <Row label="Next Action Date"><Inp type="date" value={v('next_action_date')} onSave={x => saveField('next_action_date', x || null)} /></Row>
                      <Row label="Date done"><Inp type="date" value={v('closed_at') ? String(v('closed_at')).slice(0, 10) : ''} onSave={x => saveField('closed_at', x || null)} /></Row>
                    </>
                  ) : (
                    <>
                      <Row label="Due date"><Inp type="date" value={v('due_date')} onSave={x => saveField('due_date', x || null)} /></Row>
                      <Row label="Target Contact Date"><Inp type="date" value={v('target_contact_date')} onSave={x => saveField('target_contact_date', x || null)} /></Row>
                      <Row label="Date done"><Inp type="date" value={v('date_done')} onSave={x => saveField('date_done', x || null)} /></Row>
                    </>
                  )}
                  <Row label="Source"><Inp value={v('source_raw_label') || v('source_label')} ph="Source…" onSave={x => saveField('source_raw_label', x)} /></Row>
                  <Row label="Notes">
                    <Inp value={v(kind === 'opportunity' ? 'description' : 'notes')} ph="Notes…" onSave={x => saveField(kind === 'opportunity' ? 'description' : 'notes', x)} />
                  </Row>
                </Group>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, marginBottom: 20, alignItems: 'start' }}>
                <Group title="Location & Business">
                  <Row label="01-State"><Inp value={v('state')} ph="e.g. TX" onSave={x => saveField('state', x)} /></Row>
                  <Row label="11-Location"><Inp value={v('formatted_address')} ph="Address…" onSave={x => saveField('formatted_address', x)} /></Row>
                  <Row label="Brand"><Inp value={v('brand')} ph="Brand…" onSave={x => saveField('brand', x)} /></Row>
                  <Row label="Industry">
                    {(() => {
                      const industry = normalizeIndustry(v('industry_raw') as string);
                      const bg = industry ? INDUSTRY_COLOR[industry] : null;
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {bg && (
                            <span style={{ fontWeight: 700, fontSize: 12, padding: '3px 10px', borderRadius: 999, background: bg, color: readableOn(bg), flexShrink: 0 }}>
                              {industry}
                            </span>
                          )}
                          <Inp value={v('industry_raw')} ph="Industry…" onSave={x => saveField('industry_raw', x)} />
                        </div>
                      );
                    })()}
                  </Row>
                  <Row label="Project Type"><Inp value={v('project_type_raw')} ph="Project type…" onSave={x => saveField('project_type_raw', x)} /></Row>
                  <Row label="Business Type">
                    <Inp value={businessTypes.join(', ')} ph="Comma-separated…" onSave={x => saveField('business_types', x.split(',').map(s => s.trim()).filter(Boolean))} />
                  </Row>
                </Group>

                <Group title="ClickUp Reference" muted>
                  <Row label="Direct Contact"><Inp value={v('direct_contact_raw')} ph="Name, phone, email…" onSave={x => saveField('direct_contact_raw', x)} /></Row>
                  <Row label="Status OP"><Inp value={v('external_stage_label')} ph="Status OP…" onSave={x => saveField('external_stage_label', x)} /></Row>
                  <Row label="Request"><Inp value={v('request_raw')} ph="Request…" onSave={x => saveField('request_raw', x)} /></Row>
                  <Row label="To Do"><Inp value={v('to_do_raw')} ph="To do…" onSave={x => saveField('to_do_raw', x)} /></Row>
                </Group>
              </div>
              {!!v('source_description_raw') && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <FileText size={12} style={{ color: 'var(--fg-faint)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.6, color: 'var(--fg-default)', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 14px' }}>
                    {String(v('source_description_raw'))}
                  </div>
                </div>
              )}

              <SectionLabel icon="◆">Files</SectionLabel>
              <div style={{ marginBottom: 16, background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: files.length || project?.dropbox_root_path ? 6 : 12 }}>
                {project?.dropbox_root_path && (
                  <div style={{ marginBottom: 10 }}>
                    <DropboxFileList rootPath={project.dropbox_root_path} rootLabel={project.code} />
                  </div>
                )}
                {files.map(f => (
                  <div key={f.id} className="qv-field" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--brand-teal-100)', color: 'var(--brand-teal-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={13} />
                    </div>
                    <button onClick={() => viewFile(f)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-default)', fontSize: 13.5, fontWeight: 600, textAlign: 'left', flex: 1, minWidth: 0 }}>
                      {f.file_name}
                    </button>
                    <span style={{ fontSize: 11.5, color: 'var(--fg-faint)' }}>{f.uploaded_by_name ?? ''}</span>
                    {canEdit && (
                      <button onClick={() => deleteFile(f)} title="Remove (temporary, dev-only)" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)', padding: 0, display: 'flex' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {!files.length && !project?.dropbox_root_path && (
                  <div style={{ fontSize: 13.5, color: 'var(--fg-faint)', padding: '6px 0' }}>No files yet.</div>
                )}
                {canEdit && (
                  <div style={{ marginTop: 8, padding: files.length || project?.dropbox_root_path ? '0 4px 4px' : 0 }}>
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

        <div style={{ width: 368, flexShrink: 0, borderLeft: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', background: 'var(--bg-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--brand-teal)' }} />
              <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em' }}>Activity</div>
              {activityNotes.length > 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-faint)', background: 'var(--bg-subtle)', borderRadius: 999, padding: '1px 7px' }}>{activityNotes.length}</span>
              )}
            </div>
            <button onClick={onClose} style={{ background: 'var(--bg-subtle)', border: 'none', borderRadius: 8, cursor: 'pointer', color: 'var(--fg-subtle)', padding: 6, display: 'flex' }} aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'grid', gap: 10, alignContent: 'start' }}>
            {activityNotes.length === 0 && loaded && (
              <div style={{ fontSize: 13.5, color: 'var(--fg-subtle)', textAlign: 'center', marginTop: 24 }}>No activity yet.</div>
            )}
            {activityNotes.map(n => (
              <div key={n.id} style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '11px 13px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 999, background: 'var(--brand-teal-100)', color: 'var(--brand-teal-600)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0,
                    }}>
                      {(n.author_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{n.author_name || 'Unknown'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--fg-faint)', fontSize: 11.5 }}>
                      {n.source_created_at ? new Date(n.source_created_at).toLocaleDateString('en-US') : ''}
                    </span>
                    {canEdit && (
                      <button onClick={() => deleteNote(n)} title="Delete (temporary, dev-only)" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)', padding: 0, display: 'flex' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                {n.body && n.body !== n.link_url && <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.5, color: 'var(--fg-default)', paddingLeft: 29 }}>{n.body}</div>}
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
                      <div style={{ fontSize: 11.5, color: 'var(--fg-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.link_url}</div>
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
            <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 14, background: 'var(--bg-surface)' }}>
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
                  style={{ flex: 1, resize: 'none', fontSize: 13.5, borderRadius: 10 }}
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

// Imported ClickUp Docs ("Collect Information" briefs etc.). Collapsible; the first one starts open.
function DocumentsList({ docs }: { docs: NeedNote[] }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(docs.slice(0, 1).map(d => d.id)));
  const toggle = (id: string) => setOpen(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : '');
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {docs.map(d => {
        const isOpen = open.has(d.id);
        return (
          <div key={d.id} style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
              <button
                onClick={() => toggle(d.id)} aria-expanded={isOpen}
                style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
              >
                <FileText size={15} style={{ color: 'var(--brand-teal-600)', flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.link_title || 'Document'}</span>
                <ChevronDown size={14} style={{ color: 'var(--fg-faint)', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </button>
              <span style={{ fontSize: 11.5, color: 'var(--fg-faint)', whiteSpace: 'nowrap' }}>{when(d.source_created_at)}</span>
              {d.link_url && (
                <a href={d.link_url} target="_blank" rel="noopener noreferrer" title="Open in ClickUp" style={{ color: 'var(--fg-faint)', display: 'flex' }}>
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
            {isOpen && (
              <div style={{ padding: '4px 18px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                <MarkdownLite text={d.body} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// What a salesperson still has to get from the client / fill in on an open deal. Purely a reminder —
// nothing here blocks anything.
function missingForDeal(opp: Deal): string[] {
  const empty = (k: string) => opp[k] == null || opp[k] === '';
  const stage = String(opp.stage);
  if (stage === 'closed_won' || stage === 'closed_lost') return [];
  const out: string[] = [];
  if (empty('primary_contact_id')) out.push('Contact');
  if (empty('estimated_value')) out.push('Deal size');
  if (empty('deadline')) out.push('Due date');
  if (['sales_accepted', 'working_on_it_trust', 'proposal', 'negotiation'].includes(stage)) {
    if (empty('deposit')) out.push('Deposit');
    if (empty('payment_raw')) out.push('Payment terms');
  }
  return out;
}

function StillToFillIn({ missing, stage }: { missing: string[]; stage: string }) {
  if (stage === 'closed_won' || stage === 'closed_lost') return null;
  if (missing.length === 0) {
    return (
      <div style={{ marginBottom: 10, fontSize: 12.5, fontWeight: 600, padding: '8px 12px', borderRadius: 10, background: 'var(--status-success-bg)', color: 'var(--status-success-fg)' }}>
        ✓ Everything Sales needs on this deal is filled in.
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, padding: '8px 12px', borderRadius: 10, background: 'var(--status-warning-bg)', color: 'var(--status-warning-fg)' }}>
      <span style={{ fontSize: 12.5, fontWeight: 700 }}>Still to fill in:</span>
      {missing.map(m => (
        <span key={m} style={{ fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: 'rgba(255,255,255,.65)' }}>{m}</span>
      ))}
    </div>
  );
}

function SectionLabel({ children, icon }: { children: React.ReactNode; icon?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      {icon && <span style={{ fontSize: 7, color: 'var(--brand-teal)' }}>{icon}</span>}
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</div>
      <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
    </div>
  );
}

function Group({ title, muted, children }: { title: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      background: muted ? 'var(--bg-subtle)' : 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)', borderRadius: 14,
      // 🔴 no overflow:hidden here — Sel/ContactSearchSelect open a position:absolute panel
      // that needs to escape this card's rounded corners, not get clipped by them.
      boxShadow: muted ? 'none' : 'var(--shadow-xs)',
    }}>
      <div style={{
        fontSize: 11.5, fontWeight: 800, color: muted ? 'var(--fg-faint)' : 'var(--fg-muted)',
        textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px 0',
      }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2, padding: 6 }}>
        {children}
      </div>
    </div>
  );
}

const ro: React.CSSProperties = { fontSize: 14, color: 'var(--fg-default)', fontWeight: 500 };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="qv-field" style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 10px', borderRadius: 9, minHeight: 52 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

const cellInput: React.CSSProperties = {
  width: '100%', fontSize: 14, fontWeight: 500, padding: '4px 4px', border: '1px solid transparent',
  borderRadius: 6, background: 'transparent', color: 'var(--fg-default)',
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
      onFocus={e => { e.target.style.border = '1px solid var(--brand-teal)'; e.target.style.background = 'var(--bg-surface)'; e.target.style.boxShadow = 'var(--shadow-focus)'; }}
      onBlurCapture={e => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent'; e.target.style.boxShadow = 'none'; }}
    />
  );
}

// Custom combobox, not a native <select> — the browser's own dropdown chrome (especially on
// Windows) looks dated next to the rest of this panel. Same value/onChange/opts contract as
// before so every call site stayed unchanged.
function Sel({ value, onChange, opts, emphasize }: { value: string; onChange: (v: string) => void; opts: [string, string][]; emphasize?: boolean }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = opts.find(([v]) => v === value)?.[1] ?? opts[0]?.[1] ?? '';

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(s => !s)}
        style={{
          ...cellInput, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
          border: `1px solid ${emphasize ? 'var(--status-warning)' : 'transparent'}`,
          background: emphasize ? 'var(--status-warning-bg)' : 'transparent',
        }}
        onMouseEnter={e => { if (!emphasize) e.currentTarget.style.background = 'var(--bg-subtle)'; }}
        onMouseLeave={e => { if (!emphasize) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current}</span>
        <ChevronDown size={13} style={{ color: 'var(--fg-faint)', flexShrink: 0, marginLeft: 4, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .12s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: '100%', width: 'max-content', maxWidth: 260, zIndex: 100,
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,.15)', overflow: 'hidden', maxHeight: 260, overflowY: 'auto',
        }}>
          {opts.map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => { onChange(v); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none',
                background: v === value ? 'var(--bg-subtle)' : 'transparent', cursor: 'pointer',
                fontSize: 13.5, fontWeight: v === value ? 700 : 500, color: 'var(--fg-default)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
              onMouseLeave={e => (e.currentTarget.style.background = v === value ? 'var(--bg-subtle)' : 'transparent')}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
