import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { getDropboxClient } from '@/lib/dropbox/client';
import { QC_WRITE_ROLES } from '@/lib/qc/load';

// QC photo (008 / 022 / 036): one JPEG for an OPEN inspection into the project's Dropbox folder.
// Add-only (mode add + autorename) — never overwrites, never deletes (AGENTS.md §4). The returned
// path goes into qc_checklists.photos with the decision (PATCH /api/qc/inspections).
const MAX_BYTES = 3 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole(QC_WRITE_ROLES);
  if (deny) return deny;
  const b = await req.json().catch(() => null) as { inspectionId?: unknown; image?: unknown } | null;
  const inspectionId = typeof b?.inspectionId === 'string' ? b.inspectionId : '';
  const base64 = typeof b?.image === 'string' ? b.image.replace(/^data:image\/\w+;base64,/, '') : '';
  if (!inspectionId || !base64) return NextResponse.json({ error: 'inspectionId and image are required' }, { status: 400 });
  const buf = Buffer.from(base64, 'base64');
  if (!buf.length || buf.length > MAX_BYTES) return NextResponse.json({ error: 'Photo must be a JPEG up to 3 MB' }, { status: 400 });
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return NextResponse.json({ error: 'Only JPEG photos are accepted' }, { status: 400 });

  const { data: insp } = await admin.from('qc_checklists').select('id, project_id, overall_result, production_item_id, deleted_at').eq('id', inspectionId).maybeSingle();
  if (!insp || insp.deleted_at) return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
  if (insp.overall_result !== 'pending') return NextResponse.json({ error: 'Photos can only be added to an open inspection' }, { status: 409 });
  const [{ data: project }, { data: item }] = await Promise.all([
    admin.from('projects').select('dropbox_root_path').eq('id', insp.project_id).maybeSingle(),
    admin.from('production_items').select('type').eq('id', insp.production_item_id).maybeSingle(),
  ]);
  if (!project?.dropbox_root_path) return NextResponse.json({ error: 'This project has no Dropbox folder yet' }, { status: 409 });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `${project.dropbox_root_path}/QC Photos/${item?.type ?? 'item'}/${stamp}-${inspectionId.slice(0, 8)}-${user.id.slice(0, 4)}.jpg`;
  try {
    const res = await getDropboxClient().filesUpload({ path, contents: buf, mode: { '.tag': 'add' }, autorename: true });
    return NextResponse.json({ path: res.result.path_display ?? path });
  } catch (e) {
    console.error('[qc/photos] upload failed', e);
    return NextResponse.json({ error: 'Upload to Dropbox failed — try again' }, { status: 502 });
  }
}
