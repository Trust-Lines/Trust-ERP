'use client';

import { useMemo, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { PANEL } from '@/components/platform/marketing/pr/shared';
import { MERGE_FIELDS } from '@/lib/marketing/mailTemplates';
import { AUDIENCE_SELECT, previewHtml, type CampaignForm, type Template } from './campaignData';

/** HTML body editor, merge-field chips, template picker, and the sandboxed live preview. */
export function ContentSection({ form, onChange, templates, readOnly, bodyRef, onInsertToken }: {
  form: CampaignForm;
  onChange: (patch: Partial<CampaignForm>) => void;
  templates: Template[];
  readOnly: boolean;
  bodyRef: RefObject<HTMLTextAreaElement | null>;
  onInsertToken: (token: string) => void;
}) {
  const preview = useMemo(() => previewHtml(form.body_html || '<p style="color:#9ca3af">The email content shows here.</p>', form.preheader || null), [form.body_html, form.preheader]);
  return (
    <section className={cn(PANEL, 'flex flex-col gap-4 p-6')}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="m-0 text-[15px] font-semibold text-ui-heading">3 · Content</h2>
          <p className="m-0 text-[12px] text-ui-text-secondary">HTML or plain text. The unsubscribe link and the company address are added at the bottom automatically.</p>
        </div>
        <Select className={cn(AUDIENCE_SELECT, 'w-[240px]')} aria-label="Start from a template" value="" placeholder={templates.length ? 'Start from a template…' : 'No templates yet'}
          options={templates.map(t => ({ value: t.id, label: t.name }))} disabled={readOnly || !templates.length}
          onValueChange={v => { const t = templates.find(x => x.id === v); if (t) onChange({ body_html: t.body_html, subject: form.subject || t.subject }); }} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Textarea ref={bodyRef} rows={22} className="font-mono text-[12px]" value={form.body_html} onChange={e => onChange({ body_html: e.target.value })}
            placeholder={'<h1>Hi {{first_name}},</h1>\n<p>Thanks for visiting our booth…</p>\n<p><a href="https://tlines.us">See our latest stores</a></p>'} aria-label="Email content" />
          <div className="flex flex-wrap gap-1.5">
            {MERGE_FIELDS.map(f => (
              <button key={f.token} type="button" onClick={() => onInsertToken(f.token)} title={f.label} disabled={readOnly}
                className="cursor-pointer rounded-tag border border-ui-divider bg-transparent px-2 py-0.5 font-mono text-[11px] text-ui-body hover:bg-ui-hover-bg disabled:cursor-default">
                {`{{${f.token}}}`}
              </button>
            ))}
          </div>
        </div>
        {/* Sandboxed preview: the HTML is shown, never run. */}
        <iframe title="Email preview" sandbox="allow-popups" srcDoc={preview} className="h-[520px] w-full rounded-[8px] border border-ui-divider bg-white" />
      </div>
    </section>
  );
}
