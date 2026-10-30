'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarDays, CircleAlert, ExternalLink, FileText, Plus, RefreshCw, Users, Video, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/feedback-states';
import { ConfirmModal } from '@/components/ui/modal';
import { PANEL, PageHeading } from '@/components/platform/marketing/pr/shared';
import { ScheduleMeetingDialog } from './ScheduleMeetingDialog';

// My meetings: the person's own Google Calendar (synced), who each meeting was with, Meet links,
// and after the call the recording / transcript when Google kept one.

interface Meeting {
  id: string; title: string; description: string | null; location: string | null; starts_at: string; ends_at: string | null;
  all_day: boolean; status: string; organizer_email: string | null; attendees: { email: string; name: string | null; response: string | null }[];
  meet_url: string | null; html_link: string | null; recording_url: string | null; transcript_url: string | null;
  prospect_id: string | null; customer_id: string | null; created_in_erp: boolean;
}
interface Data {
  meetings: Meeting[]; prospects: Record<string, string>; customers: Record<string, string>;
  connection: { google_email: string; last_sync_at: string | null; last_error: string | null; scopes: string[] } | null;
}

const DAY = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const localDay = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

export function MyMeetingsClient() {
  const [range, setRange] = useState<'upcoming' | 'past'>('upcoming');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [toCancel, setToCancel] = useState<Meeting | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/me/meetings?range=${range}`);
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { setError(b.error ?? 'Could not load your meetings'); setData(null); return; }
    setError(null); setData(b);
  }, [range]);
  useEffect(() => { load(); }, [load]);

  const sync = useCallback(async (quiet = false) => {
    setSyncing(true);
    try {
      const res = await fetch('/api/me/google/sync', { method: 'POST' });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { if (!quiet) toast.error(b.error ?? 'Could not sync'); return; }
      if (!quiet) toast.success(`Synced ${b.events} events from Google Calendar`);
      await load();
    } finally {
      setSyncing(false);
    }
  }, [load]);

  // Refresh from Google when the copy is older than 10 minutes.
  const lastSync = data?.connection?.last_sync_at;
  const connected = !!data?.connection;
  useEffect(() => {
    if (connected && (!lastSync || Date.now() - new Date(lastSync).getTime() > 10 * 60_000)) sync(true);
  }, [connected, lastSync, sync]);

  const groups = useMemo(() => {
    const out: { day: string; label: string; items: Meeting[] }[] = [];
    for (const m of data?.meetings ?? []) {
      const key = localDay(m.starts_at);
      const g = out.find(x => x.day === key);
      if (g) g.items.push(m); else out.push({ day: key, label: DAY.format(new Date(m.starts_at)), items: [m] });
    }
    return out;
  }, [data]);

  async function cancel() {
    if (!toCancel) return;
    const res = await fetch(`/api/me/meetings/${toCancel.id}`, { method: 'DELETE' });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(b.error ?? 'Could not cancel'); throw new Error('cancel failed'); }
    toast.success('Meeting cancelled — attendees were told');
    setToCancel(null);
    await load();
  }

  const heading = (
    <PageHeading
      trail="Dashboard / My meetings"
      title="My meetings"
      subtitle={data?.connection ? `From your Google Calendar (${data.connection.google_email}).` : 'Your Google Calendar meetings, with the Contacts and Customers they were with.'}
      actions={connected && (
        <>
          <Button variant="secondary" loading={syncing} onClick={() => sync()}><RefreshCw /> Sync now</Button>
          <Button onClick={() => setScheduling(true)}><Plus /> Schedule meeting</Button>
        </>
      )}
    />
  );

  if (error) return <div className="flex flex-col gap-[30px]">{heading}<div className={cn(PANEL, 'p-6')}><ErrorState title="Meetings aren’t available" description={error} /></div></div>;

  return (
    <div className="flex flex-col gap-[30px]">
      {heading}

      {data && !data.connection ? (
        <div className={cn(PANEL, 'p-6')}>
          <EmptyState icon={<CalendarDays />} title="Connect your Google account"
            description="Your Google Calendar meetings will show here, linked to the Contacts and Customers they were with — and you can schedule Google Meet meetings from the ERP."
            action={<Link href="/settings" className={buttonVariants({ size: 'sm' })}>Open Settings → Google account</Link>} />
        </div>
      ) : (
        <>
          {data?.connection?.last_error && (
            <div role="alert" className="flex items-start gap-2 rounded-[6px] bg-error-light px-3 py-2.5 text-[12px] text-error-dark">
              <CircleAlert className="mt-px size-4 shrink-0" /> {data.connection.last_error}
            </div>
          )}
          <nav aria-label="Meetings" className="flex h-12 items-stretch gap-8 border-b border-ui-divider">
            {([['upcoming', 'Upcoming'], ['past', 'Past']] as const).map(([key, l]) => (
              <button key={key} type="button" aria-current={range === key ? 'page' : undefined} onClick={() => setRange(key)}
                className={cn('flex items-center border-0 border-b-[3px] bg-transparent p-0 text-[13px]',
                  range === key ? 'border-[var(--color-secondary-700)] font-semibold text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading' : 'cursor-pointer border-transparent text-ui-text-secondary hover:text-ui-body')}>
                {l}
              </button>
            ))}
          </nav>

          {!data ? <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p> : groups.length === 0 ? (
            <div className={cn(PANEL, 'p-6')}>
              <EmptyState icon={<CalendarDays />} title={range === 'upcoming' ? 'Nothing scheduled' : 'No past meetings in the last 60 days'}
                action={range === 'upcoming' ? <Button onClick={() => setScheduling(true)}><Plus /> Schedule meeting</Button> : undefined} />
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map(g => (
                <section key={g.day} className={cn(PANEL, 'p-5')}>
                  <h2 className="m-0 mb-3 text-[13px] font-semibold text-ui-heading">{g.label}</h2>
                  <ul className="m-0 flex list-none flex-col divide-y divide-ui-divider p-0">
                    {g.items.map(m => {
                      const others = m.attendees.filter(a => a.email !== data.connection?.google_email);
                      const who = m.prospect_id ? { href: `/marketing/prospects/${m.prospect_id}?tab=activities`, name: data.prospects[m.prospect_id] }
                        : m.customer_id ? { href: `/customers/${m.customer_id}`, name: data.customers[m.customer_id] } : null;
                      const mine = !m.organizer_email || m.organizer_email === data.connection?.google_email;
                      return (
                        <li key={m.id} className="flex flex-wrap items-start gap-4 py-3">
                          <div className="w-[88px] shrink-0 text-[12px] tabular-nums text-ui-text-secondary">
                            {m.all_day ? 'All day' : <>{TIME.format(new Date(m.starts_at))}{m.ends_at ? <><br />{TIME.format(new Date(m.ends_at))}</> : null}</>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[14px] font-semibold text-ui-heading">{m.title}</span>
                              {who?.name && <Link href={who.href} className="rounded-tag bg-ui-hover-bg px-2 py-0.5 text-[11px] font-medium text-ui-link hover:underline">{who.name}</Link>}
                              {m.status === 'tentative' && <span className="rounded-tag bg-warning-light px-2 py-0.5 text-[11px] text-warning-dark">Tentative</span>}
                            </div>
                            {others.length > 0 && (
                              <div className="mt-1 flex items-center gap-1 text-[12px] text-ui-text-secondary">
                                <Users size={13} aria-hidden /> <span className="truncate">{others.slice(0, 4).map(a => a.name || a.email).join(', ')}{others.length > 4 ? ` +${others.length - 4}` : ''}</span>
                              </div>
                            )}
                            {(m.recording_url || m.transcript_url) && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {m.recording_url && <a href={m.recording_url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'secondary', size: 'xs' })}><Video className="size-3" /> Recording</a>}
                                {m.transcript_url && <a href={m.transcript_url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'secondary', size: 'xs' })}><FileText className="size-3" /> Transcript</a>}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {m.meet_url && range === 'upcoming' && <a href={m.meet_url} target="_blank" rel="noreferrer" className={buttonVariants({ size: 'sm' })}><Video /> Join</a>}
                            {m.html_link && <a href={m.html_link} target="_blank" rel="noreferrer" aria-label="Open in Google Calendar" className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}><ExternalLink /></a>}
                            {range === 'upcoming' && mine && <Button variant="ghost" size="icon-sm" aria-label={`Cancel ${m.title}`} onClick={() => setToCancel(m)}><X className="text-error-normal" /></Button>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <p className="m-0 text-[11px] text-ui-text-secondary">
            Showing the last 60 days and the next 120. Recordings and transcripts appear a little while after a Google Meet call, when your Google Workspace plan records meetings.
          </p>
        </>
      )}

      {scheduling && <ScheduleMeetingDialog onClose={() => setScheduling(false)} onCreated={() => { setScheduling(false); load(); }} />}
      <ConfirmModal open={!!toCancel} onOpenChange={o => { if (!o) setToCancel(null); }}
        title="Cancel this meeting?" description={toCancel?.title} tone="destructive" confirmLabel="Cancel meeting"
        warning="It’s removed from Google Calendar and every attendee gets a cancellation email." onConfirm={cancel} />
    </div>
  );
}
