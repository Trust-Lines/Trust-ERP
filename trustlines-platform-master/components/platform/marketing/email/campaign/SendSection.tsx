'use client';

import { CalendarClock, FlaskConical, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { PANEL } from '@/components/platform/marketing/pr/shared';

export function SendSection({ busy, mailReady, ready, when, onWhenChange, onTest, onSchedule, onSendNow }: {
  busy: string | null;
  mailReady: boolean;
  ready: boolean;
  when: string;
  onWhenChange: (v: string) => void;
  onTest: () => void;
  onSchedule: () => void;
  onSendNow: () => void;
}) {
  return (
    <section className={cn(PANEL, 'flex flex-col gap-4 p-6')}>
      <h2 className="m-0 text-[15px] font-semibold text-ui-heading">4 · Test and send</h2>
      <div className="flex flex-wrap items-end gap-3">
        <Button variant="secondary" className="[&_svg]:size-5" loading={busy === 'test'} disabled={!!busy || !mailReady} onClick={onTest}><FlaskConical /> Send a test to me</Button>
        <span className="mx-2 hidden h-8 w-px bg-ui-divider sm:block" aria-hidden />
        <Field label="Send later" htmlFor="c-when">
          <Input id="c-when" type="datetime-local" className="h-10 w-[230px] text-[14px]" value={when} onChange={e => onWhenChange(e.target.value)} />
        </Field>
        <Button variant="secondary" className="[&_svg]:size-5" loading={busy === 'schedule'} disabled={!!busy || !ready} onClick={onSchedule}><CalendarClock /> Schedule</Button>
        <Button className="ml-auto [&_svg]:size-5" disabled={!!busy || !ready} onClick={onSendNow}><Send /> Send now</Button>
      </div>
      <p className="m-0 text-[11px] text-ui-text-secondary">
        Emails go out from your mailbox in batches of about 40 every 10 minutes, up to your daily limit (Settings → Email sending); a large audience continues the next day.
      </p>
    </section>
  );
}
