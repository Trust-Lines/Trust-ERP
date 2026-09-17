import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';
import { REGION_CODES, SERVICE_LINE_VALUES, composeProjectCode } from '@/lib/regions';
import { PROJECT_TYPES, PROJECT_TYPE_LABEL } from '@/lib/marketing/classification';
import type { ProjectType } from '@/types/database';

type Params = { params: Promise<{ id: string }> };

// Marketing-only "we already did this project" record — never touched from Sales's own
// screens, never creates Dropbox folders (nothing live is being produced), never links a
// `clients` row (CLAUDE.md: don't touch that table without an audit — the Contact itself is
// already the reference here). Still reserves a REAL project number from the same shared
// sequence Sales uses, so the code stays globally unique and consistent — that reservation
// is NOT reversible (numbers are never reused), so this can't be undone by deleting the row.
const PROJECT_CATEGORY_BY_TYPE: Record<ProjectType, string> = {
  new_construction: 'M1', full_remodel: 'M2', small_remodel: 'M3', bid: 'M1',
};

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role, 'write');
  if (denied) return denied;

  const body = await req.json().catch(() => null) as {
    title?: string; region?: string; service_line?: string; project_type?: string;
    address?: string; completed_date?: string;
  } | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (!body.region || !REGION_CODES.includes(body.region)) return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
  if (!body.service_line || !SERVICE_LINE_VALUES.includes(body.service_line)) return NextResponse.json({ error: 'Invalid service line' }, { status: 400 });
  if (!body.project_type || !(PROJECT_TYPES as string[]).includes(body.project_type)) {
    return NextResponse.json({ error: 'Invalid project type' }, { status: 400 });
  }

  const { data: prospect } = await admin.from('prospects').select('display_name').eq('id', id).maybeSingle();
  if (!prospect) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  const { data: reserved, error: rErr } = await admin.rpc('reserve_global_number');
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
  const code = composeProjectCode(body.service_line, body.region, reserved as number);
  const name = `${code} - ${body.title.trim()}`;

  const { data: project, error: pErr } = await admin.from('projects').insert({
    code, name,
    prospect_id: id,
    region: body.region, service_line: body.service_line,
    site_location: body.address?.trim() || null,
    categories: [PROJECT_CATEGORY_BY_TYPE[body.project_type as ProjectType]],
    is_draft: false, current_stage: 'delivered', current_phase: 'delivery',
    actual_delivery_date: body.completed_date || null,
    dropbox_root_path: null,
    is_archived: false, hard_deadline: false,
    created_by: user.id,
  }).select('*').single();
  if (pErr || !project) return NextResponse.json({ error: pErr?.message ?? 'Failed to save' }, { status: 500 });

  await logAudit({
    actorId: user.id, action: 'project.logged_historical', projectId: project.id, resource: `prospect:${id}`,
    newValue: { code, region: body.region, service_line: body.service_line, project_type: PROJECT_TYPE_LABEL[body.project_type as ProjectType] },
  });

  return NextResponse.json({ project });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role, 'read');
  if (denied) return denied;

  const { data, error } = await admin.from('projects')
    .select('id, code, name, region, service_line, site_location, categories, actual_delivery_date, created_at')
    .eq('prospect_id', id).is('deleted_at', null).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data ?? [] });
}
