'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarDays, CircleAlert, CircleCheck, RefreshCw, Unplug } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/modal';

// Settings → Google account: the person connects THEIR OWN Google account so their Calendar
// meetings show in the ERP and they can schedule Google Meet meetings from it.

interface Connection { google_email: string; last_sync_at: string | null; last_error: string | null; recordings: boolean }

export function GoogleAccountCard() {
  const [state, setState] = useState<{ configured: boolean; connection: Connection | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [mounted, setMounted] = useState(false);

  async function load() {
    const res = await fetch('/api/me/google');
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { setError(b.error ?? 'Google connection unavailable'); return; }
    setState(b);
  }

  useEffect(() => {
    setMounted(true);
    load();
    // Result of the Google round trip (?google=connected / ?googleError=…), shown once.
    const q = new URLSearchParams(window.location.search);
    const err = q.get('googleError');
    if (q.get('google') === 'connected') toast.success(`Google connected — ${q.get('events') ?? 0} calendar events synced`);
    if (err) toast.error(err, { duration: 10_000 });
    if (err || q.get('google')) window.history.replaceState(null, '', '/settings');
  }, []);

  async function sync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/me/google/sync', { method: 'POST' });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) toast.error(b.error ?? 'Could not sync'); else toast.success(`Synced ${b.events} events`);
      await load();
    } finally { setSyncing(false); }
  }

  async function disconnect() {
    const res = await fetch('/api/me/google', { method: 'DELETE' });
    if (!res.ok) { toast.error('Could not disconnect'); throw new Error('disconnect failed'); }
    toast.success('Google disconnected');
    await load();
  }

  const c = state?.connection;
  return (
    <div className="card">
      <div className="card-body" style={{ padding: 20 }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 flex items-center gap-2 text-[16px] font-bold"><CalendarDays size={18} /> Google account</h2>
            <p className="m-0 mt-1 max-w-[720px] text-[13px] text-ui-text-secondary">
              Connect your own Google account: your Google Calendar meetings show in <Link href="/meetings" className="text-ui-link hover:underline">My meetings</Link> and
              on the Contacts and Customers they were with, and you can schedule Google Meet meetings from the ERP. Only you see your calendar.
            </p>
          </div>
          {c && <span className="inline-flex items-center gap-1.5 rounded-tag bg-success-light px-2.5 py-1 text-[12px] font-medium text-success-dark"><CircleCheck size={14} /> Connected</span>}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {error ? <p className="m-0 text-[13px] text-ui-text-secondary">{error}</p> : !state ? <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p> : c ? (
            <>
              <p className="m-0 text-[13px]">
                <strong>{c.google_email}</strong>
                {mounted && c.last_sync_at ? <span className="text-ui-text-secondary"> · last synced {new Date(c.last_sync_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span> : null}
              </p>
              {!c.recordings && <p className="m-0 text-[12px] text-ui-text-secondary">Meet recordings / transcripts weren’t allowed — reconnect and tick the Google Meet permission to get them.</p>}
              {c.last_error && (
                <div role="alert" className="flex items-start gap-2 rounded-[6px] bg-error-light px-3 py-2 text-[12px] text-error-dark"><CircleAlert className="mt-px size-4 shrink-0" /> {c.last_error}</div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" loading={syncing} onClick={sync}><RefreshCw /> Sync now</Button>
                <a href="/api/me/google/connect" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>Reconnect</a>
                <ConfirmModal
                  trigger={<Button variant="ghost" className="ml-auto text-error-normal"><Unplug /> Disconnect</Button>}
                  title="Disconnect Google?" description="The ERP stops reading your calendar and can no longer create meetings. Meetings already in Google Calendar stay there."
                  tone="destructive" confirmLabel="Disconnect" onConfirm={disconnect}
                />
              </div>
            </>
          ) : state.configured ? (
            <div>
              {/* A full page navigation: Google's consent screen can't open inside a fetch. */}
              <a href="/api/me/google/connect" className={buttonVariants({ size: 'sm' })}>Connect Google account</a>
              <p className="m-0 mt-2 text-[11px] text-ui-text-secondary">You’ll be asked to allow Google Calendar and Google Meet access for your account.</p>
            </div>
          ) : (
            <p className="m-0 text-[13px] text-ui-text-secondary">Google isn’t set up on the server yet — an admin needs to add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel.</p>
          )}
        </div>
      </div>
    </div>
  );
}
