'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Mail, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { MERGE_FIELDS, renderTemplate, type MergeContact } from '@/lib/marketing/mailTemplates';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export interface MailTemplateRow {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// A fake row so the preview can show what a real contact's merged email would look like — the
// tokens are keyed by ProspectRow field names (what renderTemplate actually merges against),
// not by the {{token}} names shown in the reference list below.
const SAMPLE_CONTACT: MergeContact = {
  display_name: 'Acme Retail', organization_name: 'Acme Retail', person_name: 'Jordan Smith',
  brand_name: 'Acme', industry: 'Retail', region: 'TLINES_NE', state: 'GA',
  source_label: 'Trade Fair', main_email: 'contact@example.com',
};

// Figma "Mail Templates" editor (node 277:23745).
const HEADING_TEXT = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const LABEL = 'mb-[7px] block text-[12px] font-medium leading-4 text-ui-body';
const FIELD = { minHeight: 42, fontSize: 14, borderRadius: 6, borderColor: 'var(--ui-input-border)', background: 'var(--ui-input-bg)', color: 'var(--ui-body)' } as const;
const NAVY_BTN = 'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[6px] border-0 bg-[var(--color-secondary-700)] px-8 text-[13px] font-medium text-white no-underline hover:brightness-110 disabled:cursor-default disabled:opacity-50 dark:bg-[var(--ui-tab-badge)] [&_svg]:size-4';
const OUTLINE_BTN = 'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-[6px] border border-ui-divider bg-ui-input-bg px-8 text-[13px] font-medium text-ui-body hover:bg-ui-hover-bg disabled:opacity-50';
const ICON_BTN = 'grid size-8 cursor-pointer place-items-center rounded-[6px] border border-ui-input-border bg-ui-input-bg text-ui-body hover:brightness-95';
const PREVIEW_BOX = 'rounded-[6px] border border-ui-input-border bg-transparent px-3 py-2.5 text-[14px] leading-[1.4] text-ui-body';

interface Props {
  initialTemplates: MailTemplateRow[];
  loadError?: boolean;
  canEdit: boolean;
}

type EditingState = { id: string | null; name: string; subject: string; body: string } | null;

export function MailTemplatesClient({ initialTemplates, loadError, canEdit }: Props) {
  const [templates, setTemplates] = useState<MailTemplateRow[]>(initialTemplates);
  const [editing, setEditing] = useState<EditingState>(null);
  const [saving, setSaving] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [lastFocused, setLastFocused] = useState<'subject' | 'body'>('body');

  function startNew() {
    setEditing({ id: null, name: '', subject: '', body: '' });
  }
  function startEdit(t: MailTemplateRow) {
    setEditing({ id: t.id, name: t.name, subject: t.subject, body: t.body_html });
  }

  function insertToken(token: string) {
    const text = `{{${token}}}`;
    if (lastFocused === 'subject' && subjectRef.current) {
      const el = subjectRef.current;
      const pos = el.selectionStart ?? el.value.length;
      const next = el.value.slice(0, pos) + text + el.value.slice(pos);
      setEditing(e => (e ? { ...e, subject: next } : e));
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos + text.length, pos + text.length); });
    } else if (bodyRef.current) {
      const el = bodyRef.current;
      const pos = el.selectionStart ?? el.value.length;
      const next = el.value.slice(0, pos) + text + el.value.slice(pos);
      setEditing(e => (e ? { ...e, body: next } : e));
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos + text.length, pos + text.length); });
    }
  }

  async function save() {
    if (!editing) return;
    const name = editing.name.trim();
    const subject = editing.subject.trim();
    const body = editing.body.trim();
    if (!name || !subject || !body) { toast.error('Name, subject and body are all required.'); return; }

    setSaving(true);
    try {
      const isNew = editing.id === null;
      const res = await fetch(isNew ? '/api/marketing/mail-templates' : `/api/marketing/mail-templates/${editing.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, subject, body_html: body }),
      });
      const responseBody = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(responseBody.error ?? 'Could not save template'); return; }
      const saved = responseBody.template as MailTemplateRow;
      setTemplates(prev => (isNew ? [...prev, saved] : prev.map(t => (t.id === saved.id ? saved : t))).sort((a, b) => a.name.localeCompare(b.name)));
      setEditing(null);
      toast.success(isNew ? 'Template created' : 'Template saved');
    } finally {
      setSaving(false);
    }
  }

  // Returns true once the template is gone, so the editor can close itself after deleting.
  async function remove(t: MailTemplateRow): Promise<boolean> {
    if (!confirm(`Delete "${t.name}"? This can't be undone.`)) return false;
    const res = await fetch(`/api/marketing/mail-templates/${t.id}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Could not delete'); return false; }
    setTemplates(prev => prev.filter(x => x.id !== t.id));
    toast.success('Deleted');
    return true;
  }

  if (loadError) {
    return (
      <div className="rounded-[8px] border border-ui-divider bg-ui-surface-elevated p-12 text-center text-[13px] text-ui-text-secondary">
        <AlertTriangle size={28} className="mx-auto mb-2" style={{ color: 'var(--status-t7-fg)' }} />
        <div>Mail Templates isn&apos;t ready yet. Migration 117 needs to be applied.</div>
      </div>
    );
  }

  const previewSubject = editing ? renderTemplate(editing.subject, SAMPLE_CONTACT) : '';
  // Preview only — rendered to plain text so a template author never has to trust
  // dangerouslySetInnerHTML on their own still-being-edited markup.
  const previewBody = editing
    ? renderTemplate(editing.body, SAMPLE_CONTACT).replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n /g, '\n').trim()
    : '';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-[5px] leading-[1.35]">
          <p className="m-0 text-[11px] font-semibold text-ui-nav-active">
            Marketing / Mail Templates{editing ? (editing.id ? ' / Edit' : ' / New') : ''}
          </p>
          <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING_TEXT)}>
            {editing ? (editing.id ? 'Edit Template' : 'New Template') : 'Mail Templates'}
          </h1>
          <p className="m-0 text-[13px] text-ui-body">
            Used from Contacts to download or send a query&apos;s results as one merged mailing.
          </p>
        </div>
        {canEdit && !editing && (
          <button type="button" className={NAVY_BTN} onClick={startNew}><Plus aria-hidden /> New Template</button>
        )}
        {canEdit && editing?.id && (
          <button
            type="button"
            disabled={saving}
            className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[6px] border-0 pl-[14px] pr-6 text-[13px] font-medium hover:brightness-95 disabled:opacity-50"
            style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}
            onClick={async () => {
              const t = templates.find(x => x.id === editing.id);
              if (t && await remove(t)) setEditing(null);
            }}
          >
            <Trash2 size={16} aria-hidden /> Delete
          </button>
        )}
      </div>

      {editing ? (
        // Figma 277:23745: form on the left, live Mail Preview (sample data) on the right.
        <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_528px]">
          <div className="flex flex-col gap-8 rounded-[8px] border border-ui-divider bg-ui-page-bg p-5">
            <div className="flex flex-col gap-8">
              <label className="flex flex-col">
                <span className={LABEL}>Template Name</span>
                <input
                  className="form-input" style={FIELD}
                  value={editing.name} onChange={e => setEditing(x => (x ? { ...x, name: e.target.value } : x))}
                  placeholder="e.g. Trade fair follow-up"
                />
              </label>
              <label className="flex flex-col">
                <span className={LABEL}>Subject</span>
                <input
                  ref={subjectRef} className="form-input" style={FIELD}
                  value={editing.subject} onFocus={() => setLastFocused('subject')}
                  onChange={e => setEditing(x => (x ? { ...x, subject: e.target.value } : x))}
                  placeholder="e.g. Great meeting you at {{name}}"
                />
              </label>
              <div className="flex flex-col">
                <label htmlFor="mail-template-body" className={LABEL}>Body (HTML)</label>
                <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label={`Merge fields — click to insert into the ${lastFocused === 'subject' ? 'subject' : 'body'}`}>
                  {MERGE_FIELDS.map(f => (
                    <button
                      key={f.token} type="button" onClick={() => insertToken(f.token)}
                      title={`${f.label} — inserts into the ${lastFocused === 'subject' ? 'subject' : 'body'}`}
                      className="inline-flex h-7 cursor-pointer items-center rounded-[4px] border border-ui-input-border bg-ui-input-bg px-2.5 text-[11px] font-semibold tracking-[-0.02em] text-[var(--color-secondary-700)] hover:bg-ui-hover-bg dark:text-ui-heading"
                    >
                      {'{{' + f.token + '}}'}
                    </button>
                  ))}
                </div>
                <textarea
                  id="mail-template-body" ref={bodyRef} className="form-input"
                  style={{ ...FIELD, minHeight: 220, fontFamily: 'var(--font-mono, monospace)', fontSize: 13, resize: 'vertical' }}
                  value={editing.body} onFocus={() => setLastFocused('body')}
                  onChange={e => setEditing(x => (x ? { ...x, body: e.target.value } : x))}
                  placeholder={'<p>Hi {{first_name}},</p>\n<p>Thanks for stopping by our {{company}} booth...</p>'}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <button type="button" className={OUTLINE_BTN} disabled={saving} onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className={NAVY_BTN} disabled={saving} onClick={save}>
                {saving ? 'Saving…' : editing.id ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>

          <aside className="flex flex-col gap-6 rounded-[8px] border border-ui-divider bg-ui-surface p-5" aria-label="Mail preview with sample data">
            <div>
              <h2 className={cn('m-0 text-[20px] font-semibold leading-[1.45]', HEADING_TEXT)}>Mail Preview</h2>
              <p className="m-0 text-[11px] text-ui-text-secondary">Merge fields filled in with a sample Contact ({SAMPLE_CONTACT.person_name}, {SAMPLE_CONTACT.organization_name}).</p>
            </div>
            <div className={cn(PREVIEW_BOX, 'min-h-[42px] font-medium', !previewSubject && 'text-ui-text-secondary')}>
              {previewSubject || 'Subject'}
            </div>
            <div className={cn(PREVIEW_BOX, 'min-h-[300px] flex-1 whitespace-pre-wrap', !previewBody && 'text-ui-text-secondary')}>
              {previewBody || 'The email body appears here as you type.'}
            </div>
          </aside>
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-[8px] border border-ui-divider bg-ui-page-bg">
          <EmptyState
            icon={<Mail />}
            title="No templates yet"
            description="Save emails you send often so the team can reuse them."
            action={canEdit && <Button onClick={startNew}><Plus /> Create first template</Button>}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
          {templates.map(t => (
            <div key={t.id} className="flex items-center gap-4 border-b border-ui-divider px-5 py-4 last:border-b-0">
              <span className="grid size-9 shrink-0 place-items-center rounded-[6px] bg-ui-surface text-ui-body"><Mail size={16} aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <div className={cn('text-[13px] font-semibold', HEADING_TEXT)}>{t.name}</div>
                <div className="truncate text-[12px] text-ui-text-secondary">{t.subject}</div>
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-2">
                  <button type="button" className={ICON_BTN} onClick={() => startEdit(t)} aria-label={`Edit ${t.name}`} title="Edit"><Pencil size={14} aria-hidden /></button>
                  <button
                    type="button" className={ICON_BTN} onClick={() => remove(t)} aria-label={`Delete ${t.name}`} title="Delete"
                    style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)', borderColor: 'transparent' }}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
