import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_READ_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';
import { backupOneContact } from '@/lib/marketing/contactBackup';

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

// "Back up this Contact": its whole card (people, locations, needs, potentials, opportunities,
// activity notes, file list) as Excel + JSON in Dropbox. Anyone who can open the Contact may do it.
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role, 'read');
  if (denied) return denied;

  const { data: prospect } = await admin.from('prospects').select('id, display_name').eq('id', id).maybeSingle();
  if (!prospect) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const result = await backupOneContact(admin, id, prospect.display_name);
    await logAudit({ actorId: user.id, action: 'contact.backup_single', resource: `prospect:${id}`, newValue: { xlsx: result.xlsxPath } });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[contact backup]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Backup failed — nothing was written.' }, { status: 502 });
  }
}
