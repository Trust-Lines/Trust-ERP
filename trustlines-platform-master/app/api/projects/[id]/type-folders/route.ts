import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { createTypeFolders } from '@/lib/dropbox/upload';
import { logAudit } from '@/lib/audit/log';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(['ops_manager', 'general_manager'], 'Not authorized');
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json() as { categories?: string[] };
  const categories = (body.categories ?? []).filter(Boolean);
  if (categories.length === 0) {
    return NextResponse.json({ success: true, createdTypes: [] });
  }

  const { data: project } = await admin
    .from('projects').select('dropbox_root_path').eq('id', id).single();
  const rootPath = (project as { dropbox_root_path?: string | null } | null)?.dropbox_root_path;
  if (!rootPath) {
    return NextResponse.json({ success: true, createdTypes: [], note: 'No Dropbox folder linked' });
  }

  try {
    const { createdTypes } = await createTypeFolders(rootPath, categories);
    await logAudit({
      actorId: user.id, action: 'project.type_folders_created', projectId: id,
      resource: 'project', newValue: { types: createdTypes },
    });
    return NextResponse.json({ success: true, createdTypes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Dropbox error';
    console.error('[projects/type-folders]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
