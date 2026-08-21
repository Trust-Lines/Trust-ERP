import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(['ops_manager', 'general_manager'], 'Not authorized');
  if (deny) return deny;

  const { id } = await params;

  const { data: project } = await admin
    .from('projects').select('id, deleted_at').eq('id', id).single();
  if (!project || !(project as { deleted_at: string | null }).deleted_at) {
    return NextResponse.json({ error: 'Project must be in trash first' }, { status: 400 });
  }

  const tables = [
    'audit_log',
    'document_approvals',
    'project_steps',
    'stage_transitions',
    'project_notes',
    'qc_checklists',
    'documents',
  ];

  for (const table of tables) {
    await admin.from(table).delete().eq('project_id', id);
  }

  const { error } = await admin.from('projects').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'project.permanently_deleted', projectId: null, resource: 'project',
    newValue: { deletedProjectId: id } });

  return NextResponse.json({ success: true });
}
