import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveRequestUser, isOpsRole } from '@/lib/permissions/requestUser';
import { logAudit } from '@/lib/audit/log';
import { isCompanySide, isOffice, isDepartment, normalizeSkills } from '@/lib/profile/metadata';
import { REGION_CODES } from '@/lib/regions';
import type { UserRole } from '@/types/database';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminDb = () => createAdminClient() as any;

async function requireOps(req: NextRequest): Promise<{ callerId: string } | NextResponse> {
  const caller = await resolveRequestUser(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isOpsRole(caller.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return { callerId: caller.userId };
}

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireOps(req);
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const body = await req.json() as {
    full_name?: string; role?: UserRole; is_active?: boolean;
    pm_client_id?: string | null; is_pm_supervisor?: boolean; office?: string | null;
    company_side?: string | null; department?: string | null; skills?: unknown;
    manager_id?: string | null; region_ids?: unknown; service_line_ids?: unknown;
    assigned_regions?: unknown;
  };

  const admin = adminDb();
  const patch: Record<string, unknown> = {};
  if (body.full_name !== undefined) patch.full_name = body.full_name.trim();
  if (body.role      !== undefined) patch.role      = body.role;
  if (body.is_active !== undefined) patch.is_active = body.is_active;

  const asId = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

  if (body.company_side !== undefined) {
    if (body.company_side !== null && !isCompanySide(body.company_side))
      return NextResponse.json({ error: 'Invalid company_side — expected trust_lines | t_lines' }, { status: 400 });
    patch.company_side = body.company_side;
  }
  if (body.office !== undefined) {
    if (body.office !== null && !isOffice(body.office))
      return NextResponse.json({ error: 'Invalid office — expected turkey | syria | usa | other' }, { status: 400 });
    patch.office = body.office;
  }
  if (body.department !== undefined) {
    if (body.department !== null && !isDepartment(body.department))
      return NextResponse.json({ error: 'Invalid department' }, { status: 400 });
    patch.department = body.department;
  }
  if (body.skills !== undefined) {
    patch.skills = normalizeSkills(body.skills);
  }
  if (body.manager_id !== undefined) {
    const mgr = asId(body.manager_id);
    if (mgr === id) return NextResponse.json({ error: 'A member cannot be their own manager' }, { status: 400 });
    patch.manager_id = mgr;
  }
  if (body.region_ids !== undefined)
    patch.region_ids = Array.isArray(body.region_ids) ? body.region_ids.filter((v): v is string => typeof v === 'string') : [];
  if (body.assigned_regions !== undefined) {
    const regions = Array.isArray(body.assigned_regions) ? body.assigned_regions.filter((v): v is string => typeof v === 'string') : [];
    const invalid = regions.filter(r => !REGION_CODES.includes(r));
    if (invalid.length) return NextResponse.json({ error: `Invalid region(s): ${invalid.join(', ')}` }, { status: 400 });
    patch.assigned_regions = regions;
  }
  if (body.service_line_ids !== undefined)
    patch.service_line_ids = Array.isArray(body.service_line_ids) ? body.service_line_ids.filter((v): v is string => typeof v === 'string') : [];

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data: before } = await admin.from('profiles')
    .select('full_name, role, is_active, company_side, office, department, skills, manager_id')
    .eq('id', id).maybeSingle();

  const { error } = await admin.from('profiles').update(patch).eq('id', id);
  if (error) {
    const status = error.code === '23514' ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  await logAudit({
    actorId: guard.callerId, action: 'team.updated', resource: `profile:${id}`,
    oldValue: before ?? null, newValue: patch,
  });

  if (body.pm_client_id !== undefined || body.is_pm_supervisor !== undefined) {
    const pmPatch: Record<string, unknown> = {};
    if (body.pm_client_id     !== undefined) pmPatch.pm_client_id     = body.pm_client_id;
    if (body.is_pm_supervisor !== undefined) pmPatch.is_pm_supervisor = body.is_pm_supervisor;
    const { error: pmErr } = await admin.from('profiles').update(pmPatch).eq('id', id);
    if (pmErr && !/column|schema cache/i.test(pmErr.message ?? '')) console.error('[team.patch] pm scope:', pmErr.message);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const guard = await requireOps(req);
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const admin = adminDb();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const nullCols: Array<{ table: string; cols: string[] }> = [
    { table: 'projects',           cols: ['trustlines_pm_id', 'tlines_pm_id', 'prod_pm_ms_id', 'prod_pm_ci_id', 'qc_inspector_id', 'pm_supervisor_id'] },
    { table: 'document_approvals', cols: ['requested_by', 'approved_by', 'assigned_to'] },
    { table: 'documents',          cols: ['uploaded_by'] },
  ];

  for (const { table, cols } of nullCols) {
    for (const col of cols) {
      await db.from(table).update({ [col]: null }).eq(col, id);
    }
  }

  const { error: profileErr } = await admin.from('profiles').delete().eq('id', id);
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

  const { error: authErr } = await admin.auth.admin.deleteUser(id);
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
