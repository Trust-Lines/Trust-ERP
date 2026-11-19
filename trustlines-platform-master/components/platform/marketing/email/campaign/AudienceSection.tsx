'use client';

import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { PANEL, fmtNumber } from '@/components/platform/marketing/pr/shared';
import type { Audience } from '@/lib/email/sender';
import { AUDIENCE_SELECT, PROJECT_OPTIONS, STATUS_OPTIONS, type AudienceCount, type Option } from './campaignData';

const FLAGS = [['surveyOnly', 'Came from a survey'], ['followUpOverdue', 'Follow-up overdue'], ['includePeople', 'Also email the people saved inside each Contact']] as const;

export function AudienceSection({ audience, onChange, count, countError, readOnly, marketingCampaigns, regions, sources }: {
  audience: Audience;
  onChange: (patch: Partial<Audience>) => void;
  count: AudienceCount | null;
  countError: string | null;
  readOnly: boolean;
  marketingCampaigns: Option[];
  regions: Option[];
  sources: string[];
}) {
  return (
    <section className={cn(PANEL, 'flex flex-col gap-4 p-6')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[15px] font-semibold text-ui-heading">2 · Audience</h2>
          <p className="m-0 text-[12px] text-ui-text-secondary">The Contacts that match every filter below. Unsubscribed and bounced addresses are always left out.</p>
        </div>
        <div className="flex items-center gap-2 rounded-[8px] bg-ui-hover-bg px-3 py-2" aria-live="polite">
          <Users className="size-5 text-ui-text-secondary" />
          {count ? (
            <span className="text-[13px]"><strong className="tabular-nums text-ui-heading">{fmtNumber(count.recipients)}</strong> recipients
              <span className="text-[11px] text-ui-text-secondary"> · {fmtNumber(count.matched)} Contacts matched{count.noEmail ? `, ${fmtNumber(count.noEmail)} without email` : ''}{count.suppressed ? `, ${fmtNumber(count.suppressed)} unsubscribed` : ''}</span>
            </span>
          ) : <span className="text-[12px] text-ui-text-secondary">{countError ?? 'Counting…'}</span>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Campaign / event">
          <Select aria-label="Campaign or event" className={AUDIENCE_SELECT} value={audience.campaignId ?? ''} options={[{ value: '', label: 'Any' }, ...marketingCampaigns]} onValueChange={v => onChange({ campaignId: v || undefined })} disabled={readOnly} />
        </Field>
        <Field label="Region">
          <Select aria-label="Region" className={AUDIENCE_SELECT} value={audience.region ?? ''} options={[{ value: '', label: 'Any region' }, ...regions]} onValueChange={v => onChange({ region: v || undefined })} disabled={readOnly} />
        </Field>
        <Field label="Source">
          <Select aria-label="Source" className={AUDIENCE_SELECT} value={audience.sources?.[0] ?? ''} options={[{ value: '', label: 'Any source' }, ...sources.map(s => ({ value: s, label: s }))]} onValueChange={v => onChange({ sources: v ? [v] : undefined })} disabled={readOnly} />
        </Field>
        <Field label="Classification">
          <Select aria-label="Classification" className={AUDIENCE_SELECT} value={audience.status ?? ''} options={STATUS_OPTIONS} onValueChange={v => onChange({ status: v || undefined })} disabled={readOnly} />
        </Field>
        <Field label="Projects">
          <Select aria-label="Projects" className={AUDIENCE_SELECT} value={audience.projectStatus ?? ''} options={PROJECT_OPTIONS} onValueChange={v => onChange({ projectStatus: v || undefined })} disabled={readOnly} />
        </Field>
        <Field label="Name contains" htmlFor="c-q"><Input id="c-q" className="h-10 text-[14px]" value={audience.q ?? ''} onChange={e => onChange({ q: e.target.value || undefined })} /></Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-ui-body">
        {FLAGS.map(([k, l]) => (
          <label key={k} className="flex items-center gap-2">
            <Checkbox checked={!!audience[k]} onCheckedChange={v => onChange({ [k]: v || undefined })} /> {l}
          </label>
        ))}
      </div>
      {count?.sample.length ? <p className="m-0 text-[11px] text-ui-text-secondary">For example: {count.sample.join(', ')}{count.recipients > count.sample.length ? '…' : ''}</p> : null}
    </section>
  );
}
