import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';
import { assertLeadAccess } from '@/lib/sales/leadAccess';
import { scopeToCategories } from '@/lib/sales/scope';
import {
  REGION_CODES, SERVICE_LINE_VALUES,
  dropboxRegionFolder, dropboxSectionForServiceLine, composeProjectCode,
} from '@/lib/regions';
import { buildDropboxProjectPath } from '@/lib/dropbox/paths';
import { createProjectFolders } from '@/lib/dropbox/upload';


function composeAddress(city?: string | null, street?: string | null, state?: string | null): string {
  return [city, street, state].map(s => (s ?? '').trim()).filter(Boolean).join(' - ');
}





const MEANINGFUL_FIELDS = [
  'customer_name', 'brand', 'customer_email', 'contact_person', 'contact_phone',
  'industry', 'project_type', 'customer_address', 'city', 'street', 'state',
  'matterport_link', 'source', 'follow_up_date', 'next_action',
] as const;
function hasMeaningfulContent(body: Record<string, unknown>): boolean {
  if (MEANINGFUL_FIELDS.some(k => typeof body[k] === 'string' && body[k].trim() !== '')) return true;
  if (typeof body.deal_size === 'number') return true;
  if (body.scope_of_work && typeof body.scope_of_work === 'object'
    && Object.values(body.scope_of_work as Record<string, boolean>).some(Boolean)) return true;
  if (body.notes && typeof body.notes === 'object'
    && Object.values(body.notes as Record<string, string>).some(v => (v ?? '').trim() !== '')) return true;
  if (Array.isArray(body.tags) && body.tags.length > 0) return true;
  if (Array.isArray(body.checklist) && body.checklist.length > 0) return true;
  return false;
}


export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(SALES_INTAKE_ROLES);
  if (deny) return deny;
  const denied = await assertLeadAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data: intake } = await admin.from('lead_intake').select('*').eq('id', id).maybeSingle();
  if (!intake) return NextResponse.json({ intake: null, documents: [] });

  const { data: documents } = await admin.from('lead_intake_documents')
    .select('id, category, dropbox_path, file_name, created_at')
    .eq('lead_intake_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ intake, documents: documents ?? [] });
}



export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(SALES_INTAKE_ROLES);
  if (deny) return deny;
  const denied = await assertLeadAccess(admin, id, user.id, role);
  if (denied) return denied;

  const body = await req.json() as Record<string, unknown>;

  if (body.region && !REGION_CODES.includes(body.region as string)) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
  }
  if (body.service_line && !SERVICE_LINE_VALUES.includes(body.service_line as string)) {
    return NextResponse.json({ error: 'Invalid service line' }, { status: 400 });
  }

  const { data: intake } = await admin.from('lead_intake').select('*').eq('id', id).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = intake as any;
  const isNewRow = !row;





  if (isNewRow && !hasMeaningfulContent(body)) {
    return NextResponse.json({ intake: null, projectNumber: null });
  }
  if (row?.is_delivered) return NextResponse.json({ error: 'Already delivered' }, { status: 409 });


  const SIMPLE = [
    'region', 'service_line', 'customer_name', 'brand', 'customer_email',
    'contact_person', 'contact_phone', 'industry', 'project_type', 'customer_address',
    'city', 'street', 'state', 'matterport_link',

    'priority', 'assignee_id', 'source', 'follow_up_date', 'next_action',
  ] as const;
  const patch: Record<string, unknown> = {};
  for (const k of SIMPLE) if (k in body) patch[k] = body[k];
  if (body.scope_of_work) patch.scope_of_work = body.scope_of_work;
  if (body.notes)         patch.notes = body.notes;
  if ('deal_size' in body) patch.deal_size = (body.deal_size === '' || body.deal_size == null) ? null : Number(body.deal_size);
  if (Array.isArray(body.tags)) patch.tags = body.tags;
  if (Array.isArray(body.checklist)) patch.checklist = body.checklist;


  for (const k of ['project_type', 'assignee_id', 'follow_up_date', 'source', 'customer_email'] as const) {
    if (k in patch && (patch[k] === '' || patch[k] == null)) patch[k] = null;
  }

  const next = { ...(row ?? {}), ...patch };
  patch.address = composeAddress(next.city, next.street, next.state);
  next.address = patch.address;


  let reservedNumber: number | null = row?.project_number ?? null;
  const block1Ready = next.region && next.service_line && next.customer_name && next.city && next.state;
  if (!row?.project_id && block1Ready) {


    const { data: reserved, error: rErr } = await admin.rpc('reserve_global_number');
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
    reservedNumber = reserved as number;

    const code = composeProjectCode(next.service_line, next.region, reservedNumber);
    const addr = composeAddress(next.city, next.street, next.state);

    const dropboxParams = {
      dropboxSection:    dropboxSectionForServiceLine(next.service_line),
      dropboxRegion:     dropboxRegionFolder(next.region),
      dropboxStatus:     'Under Working',
      dropboxClientType: 'Clients',
      dropboxClientName: (next.customer_name as string) || 'Customer',
      projectNo:         code,
      address:           addr,
    };
    const { projectFolderPath } = buildDropboxProjectPath(dropboxParams);

    const categories = scopeToCategories(next.scope_of_work);
    const { data: project, error: pErr } = await admin.from('projects').insert({
      code,
      name:              `${code} - ${addr}`,
      region:            next.region,
      service_line:      next.service_line,
      site_location:     addr,
      categories,
      is_draft:          true,
      current_stage:     'closed_deal',
      current_phase:     'finalization',
      dropbox_root_path: projectFolderPath,
      created_by:        user.id,
      is_archived:       false,
      hard_deadline:     false,
    }).select('id').single();
    if (pErr || !project) {
      return NextResponse.json({ error: pErr?.message ?? 'Failed to create draft project' }, { status: 500 });
    }
    patch.project_id = (project as { id: string }).id;
    patch.project_number = reservedNumber;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await createProjectFolders(dropboxParams as any, categories);
    } catch (e) {
      console.error('[intake] dropbox folders pending:', e instanceof Error ? e.message : e);
    }

    await logAudit({
      actorId: user.id, action: 'lead_intake.draft_created',
      projectId: (project as { id: string }).id,
      newValue: { code, region: next.region, service_line: next.service_line, intakeId: id },
    });
  } else if (row?.project_id) {

    const upd: Record<string, unknown> = {};
    if (body.scope_of_work) upd.categories = scopeToCategories(next.scope_of_work);
    if ('city' in body || 'street' in body || 'state' in body) {
      const addr = composeAddress(next.city, next.street, next.state);
      upd.site_location = addr;
      if (row.project_number != null) {
        const code = composeProjectCode(row.service_line, row.region, row.project_number);
        upd.name = `${code} - ${addr}`;
      }
    }
    if (Object.keys(upd).length) await admin.from('projects').update(upd).eq('id', row.project_id);
  }






  const attempt: Record<string, unknown> = { ...patch };
  let saved: unknown = null;
  let lastErr: { message?: string } | null = null;
  for (let i = 0; i < 8; i++) {
    const { data, error } = isNewRow
      ? await admin.from('lead_intake')
        .insert({ id, created_by: user.id, opportunity_status: 'new_opportunity', ...attempt })
        .select('*').single()
      : await admin.from('lead_intake').update(attempt).eq('id', id).select('*').single();
    if (!error) { saved = data; lastErr = null; break; }
    lastErr = error;
    const m = /Could not find the '([^']+)' column|column "?([a-z_]+)"? .*does not exist/i.exec(error.message ?? '');
    const col = m?.[1] ?? m?.[2];
    if (col && col in attempt) { delete attempt[col]; continue; }
    break;
  }
  if (!saved && lastErr) return NextResponse.json({ error: lastErr.message }, { status: 500 });

  if (isNewRow && saved) {
    await logAudit({ actorId: user.id, action: 'lead_intake.created', resource: `lead_intake:${id}` });
  }

  return NextResponse.json({ intake: saved, projectNumber: reservedNumber });
}
