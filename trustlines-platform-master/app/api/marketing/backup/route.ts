import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_MANAGE_ROLES } from '@/lib/marketing/roles';
import { backupAllContacts } from '@/lib/marketing/contactBackup';

export const maxDuration = 300;

// "Back up all Contacts now" — the same backup the nightly cron makes, on demand. Managers only.
export async function POST() {
  const { user, admin, deny } = await requireRole(MARKETING_MANAGE_ROLES);
  if (deny) return deny;
  try {
    const result = await backupAllContacts(admin, 'manual');
    await logAudit({ actorId: user.id, action: 'contacts.backup_manual', resource: 'contacts', newValue: { ...result } });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[contacts backup]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Backup failed — nothing was written. Check the Dropbox connection and try again.' }, { status: 502 });
  }
}
