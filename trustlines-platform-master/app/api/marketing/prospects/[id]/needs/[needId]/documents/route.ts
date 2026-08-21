import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_READ_ROLES, MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';
import { addNeedDocument, NeedDocumentError } from '@/lib/marketing/needDocuments';

type Params = { params: Promise<{ id: string; needId: string }> };

const CATEGORIES = new Set(['layout', 'photo', 'matterport', 'link']);

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, needId } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data, error } = await admin.from('prospect_need_documents')
    .select('id, category, dropbox_path, file_name, url, created_at')
    .eq('need_id', needId).order('created_at', { ascending: true });

  let projectCode: string | null = null;
  const { data: need } = await admin.from('prospect_needs').select('project_id').eq('id', needId).maybeSingle();
  if (need?.project_id) {
    const { data: project } = await admin.from('projects').select('code').eq('id', need.project_id).maybeSingle();
    projectCode = project?.code ?? null;
  }

  if (error) return NextResponse.json({ documents: [], projectCode });
  return NextResponse.json({ documents: data ?? [], projectCode });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id, needId } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });

  const category = String(form.get('category') ?? '');
  if (!CATEGORIES.has(category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 });

  try {
    let result;
    if (category === 'layout' || category === 'photo') {
      const file = form.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
      const buffer = Buffer.from(await file.arrayBuffer());
      result = await addNeedDocument(admin, needId, user.id, {
        category, file: { name: file.name, buffer },
      });
    } else {
      const url = String(form.get('url') ?? '').trim();
      if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 });
      result = await addNeedDocument(admin, needId, user.id, { category: category as 'matterport' | 'link', url });
    }

    await logAudit({
      actorId: user.id, action: 'need.document_added', resource: `prospect_need_documents:${result.document.id}`,
      newValue: { prospect_id: id, need_id: needId, category },
    });
    if (result.sync.opportunityAction !== 'none') {
      await logAudit({
        actorId: user.id, action: `opportunity.auto_${result.sync.opportunityAction}`,
        resource: `opportunity:${result.sync.opportunity?.id}`,
        newValue: { prospect_id: id, need_id: needId, reasons: result.sync.classification.reasons, project_created: !!result.project },
      });
    }
    if (result.sync.potentialAction !== 'none') {
      await logAudit({
        actorId: user.id, action: `potential.auto_${result.sync.potentialAction}`,
        resource: `potential:${result.sync.potential?.id}`,
        newValue: { prospect_id: id, need_id: needId, reasons: result.sync.classification.reasons },
      });
    }

    return NextResponse.json({
      document: result.document, classification: result.sync.classification,
      opportunity: result.sync.opportunity, potential: result.sync.potential, project: result.project,
    }, { status: 201 });
  } catch (e) {
    if (e instanceof NeedDocumentError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
