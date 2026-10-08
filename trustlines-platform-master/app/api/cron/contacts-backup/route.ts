import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { notifyUsers, usersWithRoles } from '@/lib/events/notify';
import { backupAllContacts } from '@/lib/marketing/contactBackup';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const maxDuration = 300;

// Nightly backup of all Contacts (+ people, locations, needs, potentials, opportunities, notes, file list)
// to Dropbox as Excel + JSON. Scheduled in vercel.json; Vercel calls it with GET and
// `Authorization: Bearer $CRON_SECRET`. Add-only: each night writes its own files.
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admin = createAdminClient() as any;
  try {
    const result = await backupAllContacts(admin, 'nightly');
    await logAudit({ actorId: null, action: 'contacts.backup_nightly', resource: 'contacts', newValue: { ...result } });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Backup failed';
    console.error('[contacts-backup]', message);
    // A silent failure would mean nobody notices there is no backup: tell the General Managers.
    try {
      await notifyUsers(admin, {
        userIds: await usersWithRoles(admin, ['general_manager']), projectId: null,
        type: 'backup.failed', title: 'Nightly Contacts backup failed',
        body: `The nightly Contacts backup to Dropbox did not complete: ${message}`, link: '/settings',
      });
    } catch { /* notification is best effort */ }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
