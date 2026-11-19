'use client';

import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { ImageField } from '@/components/platform/website/ImageField';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { InlineNotice } from '@/components/ui/inline-notice';
import { POST_METRICS } from '@/lib/marketing/prWorkspace';
import type { SocialAccountRow, SocialPostRow } from '@/lib/marketing/prWorkspaceServer';
import { MEDIA_OPTIONS, METRIC_LABEL, STATUS_OPTIONS, SUB_BOX, publishHint, type Option, type PostForm } from './socialForms';

function SubSection({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className={SUB_BOX}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold text-ui-heading">{title}</div>
          <div className="text-[13px] text-ui-text-secondary">{subtitle}</div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/**
 * The post editor's fields. Media and the auto-publish time are hidden once the post is live
 * (it has an external id); Results show once it's published or any metric was entered.
 */
export function PostFields({ form, row, account, disabled, accountOptions, campaignOptions, today, onChange }: {
  form: PostForm; row: SocialPostRow | null; account: SocialAccountRow | undefined; disabled: boolean;
  accountOptions: Option[]; campaignOptions: Option[];
  today: string | null;
  onChange: (patch: Partial<PostForm>) => void;
}) {
  const showResults = form.status === 'published' || POST_METRICS.some(m => form[m] !== '');
  const live = !!row?.external_id;
  const hint = live ? null : publishHint(account, form);
  const autoPublish = form.status === 'scheduled' && !!hint?.ok;
  return (
    <fieldset disabled={disabled} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0 [&_label]:text-[14px] [&_input]:text-[14px] [&_textarea]:text-[14px] [&_button]:text-[14px] [&_span.text-\[11px\]]:text-[13px]">
      {row?.status === 'publishing' && (
        <InlineNotice tone="info" role="status">This post is being published right now.</InlineNotice>
      )}
      {row?.status === 'failed' && row.publish_error && (
        <InlineNotice tone="error" role="alert" icon={<CircleAlert className="mt-px size-4 shrink-0" aria-hidden />}>
          <span>Publishing failed: {row.publish_error}. Fix it and save to retry at the chosen time, or use “Publish now”.</span>
        </InlineNotice>
      )}
      {live && (
        <InlineNotice tone="success" role="note">
          This post is live on the platform{row?.source === 'synced' ? ' (imported from it)' : ''}. Its results update automatically every night.
        </InlineNotice>
      )}
      <Field label="Title" htmlFor="post-title">
        <Input id="post-title" placeholder="e.g. NACS booth recap" value={form.title} onChange={e => onChange({ title: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Account">
          <Select aria-label="Account" value={form.account_id} options={accountOptions} onValueChange={v => onChange({ account_id: v ?? '' })} disabled={disabled} />
        </Field>
        <Field label="Status">
          <Select aria-label="Status" value={form.status} options={STATUS_OPTIONS} onValueChange={v => onChange({ status: v ?? 'idea' })} disabled={disabled} />
        </Field>
        <Field label="Planned date" htmlFor="post-planned">
          <Input id="post-planned" type="date" value={form.planned_on} onChange={e => onChange({ planned_on: e.target.value })} />
        </Field>
        <Field label="Published date" htmlFor="post-published" hint={form.status === 'published' && !form.published_on ? 'Left empty, the planned date (or today) is used.' : undefined}>
          <Input id="post-published" type="date" value={form.published_on} onChange={e => onChange({ published_on: e.target.value })} />
        </Field>
      </div>
      <Field label="Caption" htmlFor="post-caption" hint={account?.platform === 'instagram' ? 'Hashtags and @mentions go in the caption.' : undefined}>
        <Textarea id="post-caption" rows={4} value={form.caption} onChange={e => onChange({ caption: e.target.value })} />
      </Field>

      {!live && (
        <SubSection title="Media" subtitle="What gets posted with the caption."
          action={<Select className="w-[140px]" aria-label="Media type" value={form.media_type} options={MEDIA_OPTIONS} onValueChange={v => onChange({ media_type: v ?? 'image' })} disabled={disabled} />}>
          {form.media_type === 'image' && (
            <ImageField value={form.media_url} onChange={u => onChange({ media_url: u })} folder="/social/posts" disabled={disabled} height={200} label="Post image" />
          )}
          {form.media_type === 'video' && (
            <Field label="Video link" htmlFor="post-video" hint="A public MP4 link (e.g. from ImageKit or Dropbox “direct download”). Instagram publishes it as a Reel.">
              <Input id="post-video" type="url" placeholder="https://…/video.mp4" value={form.media_url} onChange={e => onChange({ media_url: e.target.value })} />
            </Field>
          )}
        </SubSection>
      )}

      {!live && form.status === 'scheduled' && (
        <div className={cn(SUB_BOX, 'gap-2')}>
          <Field label="Publish automatically at" htmlFor="post-when"
            hint={autoPublish ? 'Your local time. The post goes out within 15 minutes of this time.' : undefined}>
            <Input id="post-when" type="datetime-local" className="max-w-[260px]" value={form.scheduled_at}
              min={today ? `${today}T00:00` : undefined} disabled={disabled || !hint?.ok}
              onChange={e => onChange({ scheduled_at: e.target.value, planned_on: e.target.value.slice(0, 10) })} />
          </Field>
          {hint && <p className={cn('m-0 text-[13px]', hint.ok ? 'text-success-dark' : 'text-ui-text-secondary')}>{hint.text}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Campaign">
          <Select aria-label="Campaign" value={form.campaign_id} options={campaignOptions} onValueChange={v => onChange({ campaign_id: v ?? '' })} disabled={disabled} />
        </Field>
        <Field label="Post link" htmlFor="post-url">
          <Input id="post-url" type="url" placeholder="https://…" value={form.post_url} onChange={e => onChange({ post_url: e.target.value })} />
        </Field>
      </div>
      {showResults && (
        <SubSection title="Results" subtitle="Copy these from the platform’s insights. Leave a box empty if the number isn’t available.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {POST_METRICS.map(m => (
              <Field key={m} label={METRIC_LABEL[m]} htmlFor={`post-${m}`}>
                <Input id={`post-${m}`} type="number" min={0} step={1} inputMode="numeric" value={form[m]} onChange={e => onChange({ [m]: e.target.value })} />
              </Field>
            ))}
          </div>
        </SubSection>
      )}
      <Field label="Notes" htmlFor="post-notes">
        <Textarea id="post-notes" rows={3} value={form.notes} onChange={e => onChange({ notes: e.target.value })} />
      </Field>
    </fieldset>
  );
}
