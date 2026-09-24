'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Mail, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { MERGE_FIELDS, renderTemplate, type MergeContact } from '@/lib/marketing/mailTemplates';

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

  async function remove(t: MailTemplateRow) {
    if (!confirm(`Delete "${t.name}"? This can't be undone.`)) return;
    const res = await fetch(`/api/marketing/mail-templates/${t.id}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Could not delete'); return; }
    setTemplates(prev => prev.filter(x => x.id !== t.id));
    toast.success('Deleted');
  }

  if (loadError) {
    return (
      <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
        <AlertTriangle size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
        <div>Mail Templates isn&apos;t ready yet. Migration 117 needs to be applied.</div>
      </div></div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Mail Templates</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
            Used from Contacts to download or send a query&apos;s results as one merged mailing.
          </p>
        </div>
        {canEdit && !editing && (
          <button className="btn btn-primary" onClick={startNew}><Plus size={14} style={{ marginRight: 5 }} /> New Template</button>
        )}
      </div>

      {editing ? (
        <div className="card"><div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 24 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Template name</label>
            <input
              className="form-input" style={{ marginBottom: 14, width: '100%' }}
              value={editing.name} onChange={e => setEditing(x => (x ? { ...x, name: e.target.value } : x))}
              placeholder="e.g. Trade fair follow-up"
            />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Subject</label>
            <input
              ref={subjectRef} className="form-input" style={{ marginBottom: 14, width: '100%' }}
              value={editing.subject} onFocus={() => setLastFocused('subject')}
              onChange={e => setEditing(x => (x ? { ...x, subject: e.target.value } : x))}
              placeholder="e.g. Great meeting you at {{name}}"
            />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Body (HTML)</label>
            <textarea
              ref={bodyRef} className="form-input" style={{ width: '100%', minHeight: 320, fontFamily: 'monospace', fontSize: 12.5 }}
              value={editing.body} onFocus={() => setLastFocused('body')}
              onChange={e => setEditing(x => (x ? { ...x, body: e.target.value } : x))}
              placeholder={'<p>Hi {{first_name}},</p>\n<p>Thanks for stopping by our {{company}} booth...</p>'}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save template'}</button>
              <button className="btn btn-ghost" disabled={saving} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--fg-subtle)', marginBottom: 8 }}>
              Merge fields — click to insert
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {MERGE_FIELDS.map(f => (
                <button
                  key={f.token} type="button" onClick={() => insertToken(f.token)}
                  className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  title={f.label}
                >
                  <code style={{ fontSize: 11.5 }}>{'{{' + f.token + '}}'}</code>
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--fg-subtle)' }}>{f.label}</span>
                </button>
              ))}
            </div>

            {(editing.subject || editing.body) && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--fg-subtle)', marginBottom: 8 }}>
                  Preview (sample data)
                </div>
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, fontSize: 12.5 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{renderTemplate(editing.subject, SAMPLE_CONTACT)}</div>
                  {/* Preview only — same source the sender would see, rendered to plain text so
                      a template author never has to trust dangerouslySetInnerHTML on their own
                      still-being-edited markup. */}
                  <div style={{ whiteSpace: 'pre-wrap', color: 'var(--fg-subtle)' }}>
                    {renderTemplate(editing.body, SAMPLE_CONTACT).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div></div>
      ) : templates.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
          <Mail size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <div>No templates yet.{canEdit && ' Click "New Template" to create the first one.'}</div>
        </div></div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {templates.map(t => (
            <div key={t.id} className="card"><div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Mail size={18} style={{ color: 'var(--brand-teal-600, #0d9488)', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.subject}
                </div>
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(t)}><Pencil size={13} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(t)}><Trash2 size={13} style={{ color: '#dc2626' }} /></button>
                </div>
              )}
            </div></div>
          ))}
        </div>
      )}
    </>
  );
}
