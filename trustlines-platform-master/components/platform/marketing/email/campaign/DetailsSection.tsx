'use client';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { PANEL } from '@/components/platform/marketing/pr/shared';
import type { CampaignForm } from './campaignData';

export function DetailsSection({ form, onChange }: { form: CampaignForm; onChange: (patch: Partial<CampaignForm>) => void }) {
  return (
    <section className={cn(PANEL, 'flex flex-col gap-4 p-6')}>
      <h2 className="m-0 text-[15px] font-semibold text-ui-heading">1 · Details</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Campaign name (only the team sees it)" htmlFor="c-name"><Input id="c-name" className="h-10 text-[14px]" value={form.name} onChange={e => onChange({ name: e.target.value })} /></Field>
        <Field label="Subject line" htmlFor="c-subject" hint="Merge fields work here too, e.g. “{{first_name}}, see you at NACS”.">
          <Input id="c-subject" className="h-10 text-[14px]" value={form.subject} onChange={e => onChange({ subject: e.target.value })} />
        </Field>
        <Field label="Preview text (optional)" htmlFor="c-pre" hint="The grey line inbox apps show after the subject." className="md:col-span-2">
          <Input id="c-pre" className="h-10 text-[14px]" value={form.preheader} onChange={e => onChange({ preheader: e.target.value })} />
        </Field>
      </div>
    </section>
  );
}
