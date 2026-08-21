import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(['ops_manager', 'general_manager'], 'Not authorized');
  if (deny) return deny;

  const { id } = await params;

  const { data: trashed } = await admin
    .from('projects').select('code, name').eq('id', id).single();
  if (!trashed) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const code = (trashed as { code: string }).code;

  const { data: conflict } = await admin
    .from('projects')
    .select('id, name')
    .eq('code', code)
    .is('deleted_at', null)
    .neq('id', id)
    .maybeSingle();

  if (conflict) {
    return NextResponse.json({
      conflict: true,
      existingName: (conflict as { name: string }).name,
      code,
    }, { status: 409 });
  }

  const { error } = await admin
    .from('projects')
    .update({ deleted_at: null })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'project.restored', projectId: id, resource: 'project' });
  return NextResponse.json({ success: true });
}
