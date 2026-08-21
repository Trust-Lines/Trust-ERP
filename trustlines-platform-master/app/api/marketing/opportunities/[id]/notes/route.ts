import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { assertOpportunityAccess } from '@/lib/marketing/opportunityAccess';
import { getDropboxClient } from '@/lib/dropbox/client';
import { buildNeedFilesPath } from '@/lib/marketing/needFiles';
import { sanitizeFileName } from '@/lib/marketing/prospectFiles';

const ALLOWED_ROLES = [...SALES_HANDOFF_ROLES, ...MARKETING_ROLES];

type Params = { params: Promise<{ id: string }> };

const NOTE_COLS = 'id, need_id, author_name, author_id, body, image_path, link_url, link_title, link_thumbnail_url, source_created_at, created_at';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveNeed(admin: any, opportunityId: string) {
  const { data } = await admin.from('opportunities').select('need_id, title, region').eq('id', opportunityId).maybeSingle();
  return data as { need_id: string | null; title: string; region: string | null } | null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;
  const denied = await assertOpportunityAccess(admin, id, user.id, role);
  if (denied) return denied;

  const opp = await resolveNeed(admin, id);
  if (!opp?.need_id) return NextResponse.json({ notes: [] });

  const { data, error } = await admin.from('need_notes')
    .select(NOTE_COLS).eq('need_id', opp.need_id)
    .order('source_created_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;
  const denied = await assertOpportunityAccess(admin, id, user.id, role);
  if (denied) return denied;

  const opp = await resolveNeed(admin, id);
  if (!opp?.need_id) return NextResponse.json({ error: 'Opportunity has no linked Need' }, { status: 409 });

  const contentType = req.headers.get('content-type') ?? '';
  let body: string;
  let image: File | null = null;
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    body = String(form.get('body') ?? '').trim();
    image = form.get('image') as File | null;
  } else {
    const json = await req.json().catch(() => ({}));
    body = String(json.body ?? '').trim();
  }
  if (!body && !image) return NextResponse.json({ error: 'Write something or attach an image' }, { status: 400 });

  let imagePath: string | null = null;
  if (image && image.size > 0) {
    const safeName = sanitizeFileName(image.name);
    const path = `${buildNeedFilesPath(opp.region, opp.title, opp.need_id)}/${safeName}`;
    const buffer = Buffer.from(await image.arrayBuffer());
    try {
      const res = await getDropboxClient().filesUpload({ path, contents: buffer, mode: { '.tag': 'add' }, autorename: true });
      imagePath = res.result.path_lower ?? path;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Dropbox upload failed';
      console.error('[opportunities/notes POST image]', msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  const { data: authorProfile } = await admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const now = new Date().toISOString();

  const { data: note, error } = await admin.from('need_notes').insert({
    need_id: opp.need_id,
    author_id: user.id,
    author_name: authorProfile?.full_name ?? null,
    body: body || (image ? `[image: ${image.name}]` : ''),
    image_path: imagePath,
    source_created_at: now,
  }).select(NOTE_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'opportunity.note_posted', resource: `need_notes:${note.id}`, newValue: { opportunity_id: id } });
  return NextResponse.json({ note }, { status: 201 });
}
