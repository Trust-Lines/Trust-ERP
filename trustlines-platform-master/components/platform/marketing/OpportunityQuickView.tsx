'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  X, Loader2, ExternalLink, Paperclip, SendHorizontal, Image as ImageIcon, Trash2, Link2, FileText, FileSpreadsheet, ChevronDown, Activity,
  SquareArrowOutUpRight, CloudUpload, CircleCheck, CircleX, CircleDashed, Hash, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskList } from '@/components/platform/shared/TaskList';
import { DealProgressPanel } from '@/components/platform/shared/DealProgressPanel';
import { MarkdownLite } from '@/components/platform/shared/MarkdownLite';
import type { DealProgress } from '@/lib/sales/dealProgress';
import { DropboxFileList } from '@/components/platform/shared/DropboxFileList';
import { TagMultiSelect } from './TagMultiSelect';
import { compressImage, MAX_UPLOAD_BYTES } from '@/lib/client/compressImage';
import { uploadImageDirect } from '@/lib/client/directDropboxUpload';
import { ContactSearchSelect } from './ContactSearchSelect';
import { EmptyState } from '@/components/ui/empty-state';
import { hashColor } from '@/lib/marketing/pillColor';
import { normalizeIndustry, INDUSTRY_COLOR } from '@/lib/marketing/industry';
import { OPPORTUNITY_STAGE_LABEL, TIMING_LABEL } from '@/lib/marketing/classification';
import { REGIONS } from '@/lib/regions';
import type { OpportunityStage, PotentialStatus, LeadTiming } from '@/types/database';
import { feedback } from '@/components/ui/feedback-toast';
import { DealDocuments } from '@/components/platform/sales/DealDocuments';
import { DealDesign } from '@/components/platform/sales/DealDesign';

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
// A file in flight (or one that failed) — finished uploads move into `files`.
interface UploadItem { key: string; name: string; size: number; error?: string }

const STAGE_OPTS: [string, string][] = Object.entries(OPPORTUNITY_STAGE_LABEL);
const POTENTIAL_STATUS_LABEL: Record<PotentialStatus, string> = {
  identified: 'Identified', nurture: 'Nurture', waiting_timing: 'Waiting Timing',
  contact_due: 'Contact Due', converted: 'Converted', lost: 'Lost', cancelled: 'Cancelled',
};
const POTENTIAL_STATUS_OPTS: [string, string][] = Object.entries(POTENTIAL_STATUS_LABEL);

export function OpportunityQuickView({ opportunityId, kind = 'opportunity', assignees, onClose, onChanged, canEdit = true, focusFields = [] }: {
  opportunityId: string;
  kind?: 'opportunity' | 'potential';
  assignees: { id: string; full_name: string }[];
  onClose: () => void;
  onChanged?: (patch: Record<string, unknown>) => void;
  canEdit?: boolean;
  /** Fields to point at while they're empty ('region', 'state', 'contact') — e.g. from a
   *  "needs region/state" notification. Highlighted until filled; the panel scrolls to the first. */
  focusFields?: string[];
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
  const originalImageRef = useRef<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
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

  // Opened to fill something in: bring the first highlighted field into view once the data is here.
  const scrolledToFocus = useRef(false);
  const focusKey = focusFields.join(',');
  useEffect(() => {
    if (!focusKey || !opp || scrolledToFocus.current) return;
    scrolledToFocus.current = true;
    requestAnimationFrame(() => document.querySelector('[data-focus-field="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }, [focusKey, opp]);

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
      // Preferred: original photo straight to Dropbox. Any failure falls back to the classic upload.
      const directPath = draftImage ? await uploadImageDirect(`${apiBase}/notes`, originalImageRef.current ?? draftImage) : null;
      let direct: Response | null = null;
      if (directPath) {
        direct = await fetch(`${apiBase}/notes`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: draft.trim(), imagePath: directPath }),
        });
      }
      if (direct?.ok) {
        res = direct;
      } else if (draftImage) {
        // Direct upload unavailable, or the note could not be saved from it: classic upload of the compressed copy.
        if (draftImage.size > MAX_UPLOAD_BYTES) { toast.error('This photo is too large to upload (max 4 MB). Try a smaller one.'); return; }
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
      if (!res.ok) { toast.error(res.status === 413 ? 'The photo is too large to upload (max 4 MB).' : (body.error ?? 'Could not post')); return; }
      setNotes(prev => [...prev, body.note]);
      setDraft('');
      setDraftImage(null);
      originalImageRef.current = null;
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
    const key = `${f.name}-${f.size}-${Date.now()}`;
    // A retry replaces the failed row for the same file.
    setUploads(prev => [...prev.filter(u => !(u.error && u.name === f.name)), { key, name: f.name, size: f.size }]);
    const fail = (msg: string) => {
      setUploads(prev => prev.map(u => (u.key === key ? { ...u, error: msg } : u)));
      feedback.error('Upload interrupted', {
        description: `${f.name} could not be uploaded. ${msg}`,
        action: { label: 'Retry upload', onClick: () => void uploadFile(f) },
      });
    };
    try {
      const form = new FormData();
      form.set('file', f);
      const res = await fetch(`${apiBase}/files`, { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { fail(body.error ?? (res.status === 413 ? 'File is too large' : 'Upload failed')); return; }
      setFiles(prev => [body.file, ...prev]);
      setUploads(prev => prev.filter(u => u.key !== key));
    } catch { fail('Network error'); }
  }

  function uploadMany(list: FileList | null) {
    if (!list) return;
    for (const f of Array.from(list)) void uploadFile(f);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  const statusLabel = kind === 'opportunity'
    ? OPPORTUNITY_STAGE_LABEL[String(v('stage')) as OpportunityStage]
    : POTENTIAL_STATUS_LABEL[(String(v('status') || 'identified')) as PotentialStatus];
  const assigneeOpts: [string, string][] = [['', 'Unassigned'], ...assignees.map(a => [a.id, a.full_name] as [string, string])];
  const failedCount = uploads.filter(u => u.error).length;
  const inProgress = uploads.length - failedCount;
  const fileRows = uploads.length + files.length;

  // Figma "Lead detail" (node 305:10279): header, 2×2 field cards + Files, Activity on the right.
  return (
    <div
      onMouseDown={e => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={e => { if (mouseDownOnBackdrop.current && e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3vh 16px' }}
    >
      <div
        role="dialog" aria-modal="true" aria-label={title}
        onClick={e => e.stopPropagation()}
        className="qv-root flex h-[94vh] w-[96vw] max-w-[1616px] flex-col gap-6 overflow-hidden rounded-card bg-ui-page-bg p-8 shadow-04"
      >
        <style>{`
          .qv-root{--qv-value:var(--color-secondary-700)}
          .dark .qv-root{--qv-value:var(--ui-heading)}
          .qv-spin{animation:qv-spin 1s linear infinite}
          @keyframes qv-spin{to{transform:rotate(360deg)}}
          .qv-input::placeholder{color:var(--ui-text-disabled);font-weight:500}
          .qv-input:focus-visible{outline:2px solid var(--ui-focus-ring);outline-offset:1px}
          .qv-indeterminate{animation:qv-slide 1.2s ease-in-out infinite}
          @keyframes qv-slide{0%{left:-40%}100%{left:100%}}
        `}</style>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-[5px]">
            <h2 className={cn('m-0 truncate text-[28px] font-semibold leading-[1.35]', HEADING)}>{title}</h2>
            <div className="flex flex-wrap items-center gap-[5px]">
              {project?.code && <Chip tone="t0" icon={Hash}>{project.code}</Chip>}
              {opp && statusLabel && <Chip tone="t0" icon={CircleDashed}>{statusLabel}</Chip>}
              {canEdit ? (
                <TagMultiSelect
                  variant="chip"
                  values={tags.map(t => t.name)}
                  options={tagOptions}
                  placeholder="Add tag"
                  onChange={next => {
                    const nextTags = next.map(name => tags.find(t => t.name === name) ?? { name, color: hashColor(name) });
                    saveField('tags', nextTags);
                  }}
                />
              ) : tags.map(t => (
                <span key={t.name} style={{ fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 4, background: t.color || 'var(--status-t0-bg)', color: readableOn(t.color) }}>
                  {t.name}
                </span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {saving && <Loader2 size={16} className="qv-spin text-ui-text-secondary" aria-label="Saving" />}
            {opp?.prospect_id ? (
              <Link
                href={`/marketing/prospects/${opp.prospect_id}`}
                title="Contacts, locations & other Needs for this Lead"
                className={cn('inline-flex h-10 items-center gap-2 rounded-[6px] border border-[var(--color-secondary-700)] pl-3.5 pr-6 text-[13px] font-medium no-underline transition-colors hover:bg-ui-hover-bg dark:border-ui-heading', HEADING)}
              >
                <SquareArrowOutUpRight size={16} aria-hidden />
                Lead Profile
              </Link>
            ) : null}
            <button
              type="button" onClick={onClose} aria-label="Close"
              className="grid size-10 place-items-center rounded-[6px] border border-ui-divider bg-transparent text-ui-body transition-colors hover:bg-ui-hover-bg"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="min-w-0 flex-1 overflow-y-auto pr-1">
            {!loaded ? (
              <div className="flex items-center justify-center gap-2 p-12 text-[13px] text-ui-body"><Loader2 size={18} className="qv-spin" /> Loading…</div>
            ) : !opp ? (
              <div className="p-12 text-center text-[13px] text-ui-body">Couldn&apos;t load this {kind === 'potential' ? 'Potential' : 'Opportunity'}.</div>
            ) : (
              <div className="flex flex-col gap-4">
                {kind === 'opportunity' && (
                  <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                    <Card title="Start here">
                      <StillToFillIn missing={missingForDeal(opp)} stage={String(opp.stage)} />
                      <TaskList apiBasePath={apiBase} assignees={assignees} />
                    </Card>
                    <Card title="Progress">
                      <DealProgressPanel stage={String(opp.stage) as OpportunityStage} progress={progress} />
                    </Card>
                  </div>
                )}
                {/* System drawing: Design → Estimate → Contract → Closed Deal (migration 131). */}
                {kind === 'opportunity' && (
                  <Card title="Design">
                    <DealDesign opportunityId={opportunityId} />
                  </Card>
                )}
                {kind === 'opportunity' && (
                  <Card title="Estimate & Contract">
                    <DealDocuments opportunityId={opportunityId} dealTitle={title} defaultCurrency={(opp.currency as string | null) ?? null} canEdit={canEdit} />
                  </Card>
                )}

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <Card title="Status & Ownership">
                    <Fields>
                      {kind === 'opportunity' ? (
                        <Field label="Stage" span={2}><Sel value={String(v('stage'))} onChange={changeStage} opts={STAGE_OPTS} /></Field>
                      ) : (
                        <Field label="Status" span={2}>
                          <Sel value={String(v('status') || 'identified')} onChange={x => saveField('status', x)} opts={POTENTIAL_STATUS_OPTS} />
                        </Field>
                      )}
                      <Field label="Priority" span={2}>
                        <Sel value={String(v('priority') || 'medium')} onChange={x => saveField('priority', x)}
                          opts={[['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]} />
                      </Field>
                      {kind === 'opportunity' ? (
                        <>
                          <Field label="Marketing Owner" span={2}>
                            <Sel value={String(v('marketing_owner_id'))} onChange={x => saveField('marketing_owner_id', x || null)} opts={assigneeOpts} />
                          </Field>
                          <Field label="Sales Owner" span={2}>
                            <Sel value={String(v('sales_owner_id'))} onChange={x => saveField('sales_owner_id', x || null)} opts={assigneeOpts} />
                          </Field>
                        </>
                      ) : (
                        <Field label="Assignee" span={2}>
                          <Sel value={String(v('assigned_to'))} onChange={x => saveField('assigned_to', x || null)} opts={assigneeOpts} />
                        </Field>
                      )}
                      <Field label="Contact" span={kind === 'opportunity' ? 4 : 6} focus={focusFields.includes('contact') && !v('primary_contact_id') && !v('direct_contact_raw')}>
                        <ContactSearchSelect
                          value={String(v('primary_contact_id'))}
                          valueLabel={contactLabel || contacts.find(c => c.id === v('primary_contact_id'))?.name || ''}
                          disabled={!canEdit}
                          placeholder="Search contacts…"
                          buttonStyle={{ ...fieldBox, cursor: canEdit ? 'pointer' : 'default' }}
                          placeholderStyle={{ color: 'var(--ui-text-disabled)', fontWeight: 500 }}
                          onChange={(id, name) => {
                            setContactLabel(name ?? '');
                            saveField('primary_contact_id', id);
                          }}
                        />
                      </Field>
                      {need?.timing && (
                        <Field label="Timing" span={3}><ReadOnly>{TIMING_LABEL[need.timing]}</ReadOnly></Field>
                      )}
                      {Array.isArray(opp.classification_reasons) && (opp.classification_reasons as string[]).length > 0 && (
                        <Field label="Why this stage" span={need?.timing ? 3 : 6}>
                          <ReadOnly>{(opp.classification_reasons as string[]).join(' · ')}</ReadOnly>
                        </Field>
                      )}
                    </Fields>
                  </Card>

                  <Card title="Value & Timeline">
                    <Fields>
                      <Field label="Deal Size" span={3}><Inp type="number" value={v('estimated_value')} ph="e.g 250000" onSave={x => saveField('estimated_value', x === '' ? null : Number(x))} /></Field>
                      <Field label="Deposit" span={3}><Inp type="number" value={v('deposit')} ph="e.g 5000" onSave={x => saveField('deposit', x === '' ? null : Number(x))} /></Field>
                      <Field label="Payment" span={4}><Inp value={v('payment_raw')} ph="Payment terms.." onSave={x => saveField('payment_raw', x)} /></Field>
                      <Field label="Targeted" span={2}>
                        <Sel value={String(!!opp.targeted)} onChange={x => saveField('targeted', x === 'true')} opts={[['false', 'No'], ['true', 'Yes']]} />
                      </Field>
                      {kind === 'opportunity' ? (
                        <>
                          <Field label="Due Date" span={2}><Inp type="date" value={v('deadline')} onSave={x => saveField('deadline', x || null)} /></Field>
                          <Field label="Expected Close" span={2}><Inp type="date" value={v('expected_close_date')} onSave={x => saveField('expected_close_date', x || null)} /></Field>
                          <Field label="Date done" span={2}><Inp type="date" value={v('closed_at') ? String(v('closed_at')).slice(0, 10) : ''} onSave={x => saveField('closed_at', x || null)} /></Field>
                          <Field label="Next Action" span={3}><Inp value={v('next_action')} ph="e.g Send estimate" onSave={x => saveField('next_action', x)} /></Field>
                          <Field label="Next Action Date" span={3}><Inp type="date" value={v('next_action_date')} onSave={x => saveField('next_action_date', x || null)} /></Field>
                        </>
                      ) : (
                        <>
                          <Field label="Due Date" span={2}><Inp type="date" value={v('due_date')} onSave={x => saveField('due_date', x || null)} /></Field>
                          <Field label="Targeted contact date" span={2}><Inp type="date" value={v('target_contact_date')} onSave={x => saveField('target_contact_date', x || null)} /></Field>
                          <Field label="Date done" span={2}><Inp type="date" value={v('date_done')} onSave={x => saveField('date_done', x || null)} /></Field>
                        </>
                      )}
                      <Field label="Source" span={3}><Inp value={v('source_raw_label') || v('source_label')} ph="type.." onSave={x => saveField('source_raw_label', x)} /></Field>
                      <Field label="Notes" span={3}>
                        <Inp value={v(kind === 'opportunity' ? 'description' : 'notes')} ph="type.." onSave={x => saveField(kind === 'opportunity' ? 'description' : 'notes', x)} />
                      </Field>
                    </Fields>
                  </Card>

                  <Card title="Location & Business" className="self-start">
                    <Fields>
                      <Field label="01-State" span={2} focus={focusFields.includes('state') && !v('state')}><Inp value={v('state')} ph="e.g TX" onSave={x => saveField('state', x)} /></Field>
                      <Field label="11-Location" span={2}><Inp value={v('formatted_address')} ph="address.." onSave={x => saveField('formatted_address', x)} /></Field>
                      <Field label="Brand" span={2}><Inp value={v('brand')} ph="brand.." onSave={x => saveField('brand', x)} /></Field>
                      <Field label="Industry" span={2}>
                        {(() => {
                          const industry = normalizeIndustry(v('industry_raw') as string);
                          const bg = industry ? INDUSTRY_COLOR[industry] : null;
                          return (
                            <div className="flex w-full items-center gap-1.5">
                              {bg && (
                                <span style={{ fontWeight: 500, fontSize: 12, lineHeight: '16px', padding: '3px 8px', borderRadius: 4, background: bg, color: readableOn(bg), flexShrink: 0 }}>
                                  {industry}
                                </span>
                              )}
                              <Inp value={v('industry_raw')} ph="industry.." onSave={x => saveField('industry_raw', x)} />
                            </div>
                          );
                        })()}
                      </Field>
                      <Field label="Project Type" span={2}><Inp value={v('project_type_raw')} ph="project type.." onSave={x => saveField('project_type_raw', x)} /></Field>
                      <Field label="Business Type" span={2}>
                        <Inp value={businessTypes.join(', ')} ph="comma separated.." onSave={x => saveField('business_types', x.split(',').map(s => s.trim()).filter(Boolean))} />
                      </Field>
                      <Field label="Region" span={2} focus={focusFields.includes('region') && !v('region')}>
                        <Sel value={String(v('region'))} onChange={x => saveField('region', x || null)}
                          opts={[['', '—'], ...REGIONS.map(r => [r.code, r.label] as [string, string])]}
                          emphasize={!v('region')} />
                        {!v('region') && <div className="text-[12px] text-[var(--status-warning-fg)]">Set a region so your team can see this</div>}
                      </Field>
                    </Fields>
                  </Card>

                  <Card title="Clickup Reference" muted className="self-start">
                    <Fields>
                      <Field label="Direct Contact" span={3} focus={focusFields.includes('contact') && !v('primary_contact_id') && !v('direct_contact_raw')}><Inp muted value={v('direct_contact_raw')} ph="Name, phone, email.." onSave={x => saveField('direct_contact_raw', x)} /></Field>
                      <Field label="Status OP" span={3}><Inp muted value={v('external_stage_label')} ph="status OP.." onSave={x => saveField('external_stage_label', x)} /></Field>
                      <Field label="Requests" span={3}><Inp muted value={v('request_raw')} ph="Requests.." onSave={x => saveField('request_raw', x)} /></Field>
                      <Field label="To do" span={3}><Inp muted value={v('to_do_raw')} ph="To do.." onSave={x => saveField('to_do_raw', x)} /></Field>
                    </Fields>
                  </Card>
                </div>

                {docNotes.length > 0 && (
                  <Card title="Documents"><DocumentsList docs={docNotes} /></Card>
                )}
                {!!v('source_description_raw') && (
                  <Card title="Description">
                    <div className="whitespace-pre-wrap text-[13px] leading-[1.6] text-ui-body">{String(v('source_description_raw'))}</div>
                  </Card>
                )}

                {/* ── Files ── */}
                <Card title="Files">
                  <div className="flex flex-col gap-7 lg:flex-row">
                    <div className="flex shrink-0 flex-col self-stretch rounded-[10px] border border-ui-divider bg-ui-page-bg p-6 lg:w-[280px]">
                      <div
                        onDragOver={e => { if (!canEdit) return; e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={e => { if (!canEdit) return; e.preventDefault(); setDragOver(false); uploadMany(e.dataTransfer.files); }}
                        className={cn(
                          'flex min-h-[220px] flex-1 flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed p-6 text-center transition-colors',
                          dragOver ? 'border-[var(--color-secondary-700)] bg-ui-selected-bg' : 'border-[var(--ui-input-border)] bg-ui-input-bg',
                        )}
                      >
                        <CloudUpload size={32} strokeWidth={1.5} className="text-ui-body" aria-hidden />
                        <p className="m-0 text-[14px] font-semibold leading-[1.45] text-ui-body">
                          {canEdit ? 'Drag files here to upload' : 'Read-only'}
                        </p>
                        {canEdit && (
                          <>
                            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => uploadMany(e.target.files)} />
                            <button
                              type="button" onClick={() => fileInputRef.current?.click()}
                              className="rounded-[6px] border border-ui-divider bg-ui-input-bg px-3.5 py-2.5 text-[13px] font-medium text-ui-body transition-colors hover:bg-ui-hover-bg"
                            >
                              Browse files
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex h-[356px] min-w-0 flex-1 flex-col gap-5 overflow-hidden rounded-[10px] border border-ui-divider bg-ui-page-bg p-6">
                      <div className="flex items-start justify-between gap-3 leading-[1.45]">
                        <p className="m-0 text-[13px] font-semibold text-ui-body">Uploads · {fileRows} file{fileRows === 1 ? '' : 's'}</p>
                        {inProgress > 0 && <p className="m-0 text-[12px] text-ui-text-secondary">{inProgress} in progress</p>}
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                        {fileRows === 0 && (
                          <EmptyState size="sm" icon={<FileText />} title="No files here yet." />
                        )}
                        {uploads.map(u => (
                          <FileRowShell key={u.key}>
                            {u.error ? (
                              <div className="flex items-center gap-3">
                                <CircleX size={22} strokeWidth={1.5} className="shrink-0 text-error-normal" aria-hidden />
                                <div className="flex min-w-0 flex-1 flex-col gap-1 leading-[1.45]">
                                  <span className="truncate text-[13px] font-medium text-ui-body">{u.name}</span>
                                  <span className="text-[12px] text-error-normal">{formatBytes(u.size)} · {u.error}</span>
                                </div>
                                <button
                                  type="button" onClick={() => setUploads(prev => prev.filter(x => x.key !== u.key))}
                                  className="shrink-0 rounded-[6px] border border-error-normal bg-transparent px-2.5 py-[7px] text-[13px] font-medium text-error-normal transition-colors hover:bg-error-light dark:hover:bg-error-dark/30"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2.5">
                                <div className="flex items-start gap-3">
                                  <FileIcon name={u.name} />
                                  <div className="flex min-w-0 flex-1 flex-col gap-[3px] leading-[1.45]">
                                    <span className="truncate text-[13px] font-medium text-ui-body">{u.name}</span>
                                    <span className="text-[12px] text-ui-text-secondary">{formatBytes(u.size)}</span>
                                  </div>
                                </div>
                                <div className="relative h-1.5 w-full overflow-hidden rounded-[3px] bg-ui-hover-bg">
                                  <div className="qv-indeterminate absolute top-0 h-1.5 w-[40%] rounded-[3px] bg-[var(--color-secondary-700)] dark:bg-ui-heading" />
                                </div>
                                <span className="text-[12px] leading-[1.45] text-ui-text-secondary">Uploading…</span>
                              </div>
                            )}
                          </FileRowShell>
                        ))}
                        {files.map(f => (
                          <FileRowShell key={f.id}>
                            <div className="flex items-center gap-3">
                              <FileIcon name={f.file_name} />
                              <div className="flex min-w-0 flex-1 flex-col gap-1 leading-[1.45]">
                                <button type="button" onClick={() => viewFile(f)} title="Open file"
                                  className="truncate border-0 bg-transparent p-0 text-left text-[13px] font-medium text-ui-body hover:underline">
                                  {f.file_name}
                                </button>
                                <span className="text-[12px] text-ui-text-secondary">
                                  {[f.uploaded_by_name, f.created_at ? new Date(f.created_at).toLocaleDateString('en-US') : null].filter(Boolean).join(' · ')}
                                </span>
                              </div>
                              <Chip tone="t9" icon={CircleCheck}>Complete</Chip>
                              {canEdit && (
                                <button type="button" onClick={() => deleteFile(f)} aria-label={`Remove ${f.file_name}`} title="Remove"
                                  className="flex shrink-0 border-0 bg-transparent p-0 text-ui-text-secondary hover:text-error-normal">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </FileRowShell>
                        ))}
                      </div>
                    </div>
                  </div>
                  {project?.dropbox_root_path && (
                    <div className="mt-4">
                      <DropboxFileList rootPath={project.dropbox_root_path} rootLabel={project.code} />
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>

          {/* ── Activity ─────────────────────────────────────────── */}
          <div className="flex w-[383px] shrink-0 flex-col overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
            <div className="flex h-16 shrink-0 items-center gap-2 border-b border-ui-divider px-4">
              <span aria-hidden className="size-1.5 rounded-full bg-[var(--color-secondary-700)] dark:bg-ui-heading" />
              <p className={cn('m-0 flex-1 text-[16px] font-semibold leading-[1.45]', HEADING)}>Activity</p>
              {activityNotes.length > 0 && <span className="text-[12px] font-semibold text-ui-text-secondary">{activityNotes.length}</span>}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto border-b border-ui-divider bg-ui-surface p-2">
              {activityNotes.length === 0 && loaded && (
                <EmptyState size="sm" className="mt-6 justify-center" icon={<Activity />} title="No activity yet." />
              )}
              {activityNotes.map(n => (
                <div key={n.id} className="rounded-[8px] border border-ui-divider bg-ui-page-bg px-3 py-2.5">
                  <div className="mb-1.5 flex justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-ui-surface text-[10px] font-semibold text-ui-body">
                        {(n.author_name || '?').charAt(0).toUpperCase()}
                      </span>
                      <span className={cn('truncate text-[13px] font-semibold', HEADING)}>{n.author_name || 'Unknown'}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-[11.5px] text-ui-text-secondary">
                        {n.source_created_at ? new Date(n.source_created_at).toLocaleDateString('en-US') : ''}
                      </span>
                      {canEdit && (
                        <button type="button" onClick={() => deleteNote(n)} title="Delete" aria-label="Delete comment"
                          className="flex border-0 bg-transparent p-0 text-ui-text-secondary hover:text-error-normal">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  {n.body && n.body !== n.link_url && <div className="whitespace-pre-wrap pl-[30px] text-[13px] leading-[1.5] text-ui-body">{n.body}</div>}
                  {n.link_url && (
                    <a href={n.link_url} target="_blank" rel="noopener noreferrer"
                      className="mt-1.5 flex items-center gap-2 rounded-[6px] border border-ui-divider bg-ui-surface px-2.5 py-2 no-underline">
                      {n.link_thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={n.link_thumbnail_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <span className="grid size-10 shrink-0 place-items-center rounded-[6px] bg-ui-page-bg text-ui-text-secondary"><Link2 size={16} /></span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-semibold text-ui-body">{n.link_title || n.link_url}</span>
                        <span className="block truncate text-[11.5px] text-ui-text-secondary">{n.link_url}</span>
                      </span>
                    </a>
                  )}
                  {n.image_path && (
                    imageLinks[n.image_path] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageLinks[n.image_path]}
                        alt=""
                        onClick={() => setLightbox(imageLinks[n.image_path!])}
                        style={{ marginTop: 6, maxWidth: 140, maxHeight: 140, borderRadius: 6, cursor: 'zoom-in', display: 'block', border: '1px solid var(--ui-divider)' }}
                      />
                    ) : (
                      <div className="mt-1.5 grid h-[90px] w-[140px] place-items-center rounded-[6px] bg-ui-surface text-ui-text-secondary">
                        <ImageIcon size={16} />
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>

            {canEdit && (
              <div className="shrink-0 py-3 pl-4 pr-2">
                {draftImage && (
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] text-ui-body">
                    <ImageIcon size={12} /> <span className="truncate">{draftImage.name}</span>
                    <button type="button" aria-label="Remove image" onClick={() => { setDraftImage(null); originalImageRef.current = null; if (noteFileInputRef.current) noteFileInputRef.current.value = ''; }}
                      className="flex border-0 bg-transparent p-0 text-ui-text-secondary">
                      <X size={12} />
                    </button>
                  </div>
                )}
                <div className="flex items-stretch gap-2">
                  <textarea
                    aria-label="Write a comment"
                    placeholder="Type here.."
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void postComment(); } }}
                    className="qv-input h-20 min-w-0 flex-1 resize-none rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg p-3 text-[14px] leading-[1.4] text-ui-body outline-none"
                  />
                  <div className="flex w-[89px] shrink-0 flex-col justify-center gap-2">
                    <input ref={noteFileInputRef} type="file" accept="image/*" className="hidden"
                      onChange={async e => {
                        const picked = e.target.files?.[0];
                        originalImageRef.current = picked ?? null; // full-quality original for the direct Dropbox upload
                        setDraftImage(picked ? await compressImage(picked) : null); // small copy = fallback upload
                      }} />
                    <button type="button" onClick={() => noteFileInputRef.current?.click()} title="Attach image" aria-label="Attach image"
                      className={cn('flex items-center justify-center rounded-[6px] border border-[var(--color-secondary-700)] bg-transparent py-2.5 transition-colors hover:bg-ui-hover-bg dark:border-ui-heading', HEADING)}>
                      <Paperclip size={16} />
                    </button>
                    <button type="button" onClick={postComment} disabled={posting || (!draft.trim() && !draftImage)} title="Post" aria-label="Post comment"
                      className="flex items-center justify-center rounded-[6px] border-0 bg-[var(--color-secondary-700)] py-2.5 text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-primary-50 dark:text-primary-950">
                      {posting ? <Loader2 size={16} className="qv-spin" /> : <SendHorizontal size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
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

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';

// Figma form card: 8px radius, 14px padding, 16px semibold title.
function Card({ title, muted, className, children }: { title: string; muted?: boolean; className?: string; children: React.ReactNode }) {
  return (
    // 🔴 no overflow:hidden here — Sel/ContactSearchSelect open a position:absolute panel
    // that needs to escape this card's rounded corners, not get clipped by them.
    <section className={cn('flex flex-col gap-2 rounded-[8px] border border-ui-divider p-3.5', muted ? 'bg-ui-surface' : 'bg-ui-page-bg', className)}>
      <h3 className={cn('m-0 text-[16px] font-semibold leading-[1.45]', HEADING)}>{title}</h3>
      {children}
    </section>
  );
}

// Six-track grid: span 2 = three across, 3 = two across, 6 = full width.
function Fields({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-6 gap-2">{children}</div>;
}

const SPAN: Record<number, string> = { 2: 'col-span-6 sm:col-span-2', 3: 'col-span-6 sm:col-span-3', 4: 'col-span-6 sm:col-span-4', 6: 'col-span-6' };

/** `focus`: this is the field to fill in (opened from a "needs …" notification) — highlighted until it has a value. */
function Field({ label, span = 2, focus = false, children }: { label: string; span?: 2 | 3 | 4 | 6; focus?: boolean; children: React.ReactNode }) {
  return (
    <div
      data-focus-field={focus || undefined}
      className={cn('flex min-w-0 flex-col gap-[7px]', SPAN[span],
        focus && 'rounded-[8px] bg-[var(--status-t7-bg)] p-2 outline-2 outline-solid outline-[var(--status-t7-fg)] transition-colors')}
    >
      <span className={cn('text-[12px] font-medium leading-4', focus ? 'font-semibold text-[var(--status-t7-fg)]' : 'text-ui-body')}>
        {label}{focus && ' — fill this in'}
      </span>
      {children}
    </div>
  );
}

// Figma "Input": 42px min height, input border, 11px semibold value.
const fieldBox: React.CSSProperties = {
  width: '100%', minHeight: 42, padding: '0 12px', border: '1px solid var(--ui-input-border)', borderRadius: 6,
  background: 'var(--ui-input-bg)', color: 'var(--qv-value)', fontSize: 11, fontWeight: 600, lineHeight: 1.5,
  letterSpacing: '-0.242px', textAlign: 'left',
};

function ReadOnly({ children }: { children: React.ReactNode }) {
  return <div style={{ ...fieldBox, display: 'flex', alignItems: 'center', padding: '12px' }}>{children}</div>;
}

function Inp({ value, onSave, type = 'text', ph, muted }: { value: string | number; onSave: (v: string) => void; type?: string; ph?: string; muted?: boolean }) {
  const [val, setVal] = useState(String(value ?? ''));
  useEffect(() => { setVal(String(value ?? '')); }, [value]);
  return (
    <input
      type={type} value={val} placeholder={ph ?? '—'}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { if (val !== String(value ?? '')) onSave(val); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="qv-input"
      style={{ ...fieldBox, ...(muted && { background: 'var(--ui-surface)' }) }}
    />
  );
}

// Custom combobox, not a native <select> — the browser's own dropdown chrome (especially on
// Windows) looks dated next to the rest of this panel.
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
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(s => !s)}
        className="qv-input"
        style={{
          ...fieldBox, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer',
          ...(emphasize && { borderColor: 'var(--status-warning)', background: 'var(--status-warning-bg)' }),
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current}</span>
        <ChevronDown size={16} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .12s' }} />
      </button>

      {open && (
        <div role="listbox" style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: '100%', width: 'max-content', maxWidth: 260, zIndex: 100,
          background: 'var(--ui-surface-elevated)', border: '1px solid var(--ui-divider)', borderRadius: 6,
          boxShadow: 'var(--shadow-03)', maxHeight: 260, overflowY: 'auto', padding: 4,
        }}>
          {opts.map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="option"
              aria-selected={v === value}
              onClick={() => { onChange(v); setOpen(false); }}
              className={cn('block w-full rounded-[4px] border-0 px-2.5 py-2 text-left text-[13px] text-ui-body hover:bg-ui-hover-bg', v === value ? 'bg-ui-selected-bg font-semibold' : 'bg-transparent font-medium')}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Figma "Status Chip" (48:500): tone bg/fg, 14px icon, 12px medium label.
function Chip({ tone, icon: Icon, children }: { tone: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-[4px] py-[3px] pl-2 pr-2.5 text-[12px] font-medium leading-4 whitespace-nowrap"
      style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}
    >
      <Icon size={14} aria-hidden />
      {children}
    </span>
  );
}

function FileRowShell({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-ui-divider py-5 first:pt-0 last:border-b-0 last:pb-0">{children}</div>;
}

function FileIcon({ name }: { name: string }) {
  const Icon = /\.(xlsx?|csv|ods)$/i.test(name) ? FileSpreadsheet : FileText;
  return <Icon size={22} strokeWidth={1.5} className="shrink-0 text-ui-body" aria-hidden />;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
