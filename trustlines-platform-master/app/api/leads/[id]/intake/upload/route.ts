import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';
import { getDropboxClient } from '@/lib/dropbox/client';
import { assertLeadAccess } from '@/lib/sales/leadAccess';

const CATEGORIES = new Set([
  'shelving_note', 'millwork_note', 'image_note', 'ceiling_note',
  'areas_note', 'client_special_request_note', 'plan_layout', 'photos',
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(SALES_INTAKE_ROLES);
  if (deny) return deny;
  const denied = await assertLeadAccess(admin, id, user.id, role);
  if (denied) return denied;

  const form = await req.formData();
  const file     = form.get('file') as File | null;
  const category = String(form.get('category') ?? '');
  if (!file)                       return NextResponse.json({ error: 'No file' }, { status: 400 });
  if (!CATEGORIES.has(category))   return NextResponse.json({ error: 'Invalid category' }, { status: 400 });

  const { data: intake } = await admin.from('lead_intake')
    .select('id, project_id')
    .eq('id', id).maybeSingle();
  if (!intake) return NextResponse.json({ error: 'Intake not found' }, { status: 404 });

  const intakeRow = intake as { id: string; project_id: string | null };
  if (!intakeRow.project_id) {
    return NextResponse.json(
      { error: 'BLOCK1_INCOMPLETE', message: 'Complete Region + Client + Service + Address first so a folder exists.' },
      { status: 409 },
    );
  }

  const { data: project } = await admin.from('projects')
    .select('dropbox_root_path').eq('id', intakeRow.project_id).single();
  const rootPath = (project as { dropbox_root_path?: string } | null)?.dropbox_root_path;
  if (!rootPath) return NextResponse.json({ error: 'Project folder not ready' }, { status: 409 });

  const safeName = (file.name || 'upload')
    .replace(/[/\\]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .trim() || 'upload';
  const path = `${rootPath}/00-Intake/${category}/${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let dropboxPath: string;
  try {
    const res = await getDropboxClient().filesUpload({
      path,
      contents:   buffer,
      mode:       { '.tag': 'add' },
      autorename: true,
    });
    dropboxPath = res.result.path_lower ?? path;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Dropbox upload failed';
    console.error('[intake/upload]', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const { data: doc, error } = await admin.from('lead_intake_documents').insert({
    lead_intake_id: intakeRow.id,
    category,
    dropbox_path:   dropboxPath,
    file_name:      safeName,
    uploaded_by:    user.id,
  }).select('id, category, dropbox_path, file_name, created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: user.id, action: 'lead_intake.file_uploaded',
    projectId: intakeRow.project_id, resource: `lead_intake_documents:${(doc as { id: string }).id}`,
    newValue: { category, file_name: safeName },
  });

  return NextResponse.json({ document: doc });
}
