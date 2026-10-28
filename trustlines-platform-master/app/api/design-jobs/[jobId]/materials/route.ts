import { NextRequest, NextResponse } from 'next/server';
import { logLeadActivity } from '@/lib/sales/activity';
import { requireUserWithRole, loadDesignJobWithAccess } from '@/lib/sales/design';
import { NOT_READY, tableMissing } from '@/lib/design/access';

type Params = { params: Promise<{ jobId: string }> };

// The materials a design job specifies (design job panel → Materials): what Supply will order.
// GET → lines with the catalogue details; POST { materialId, area, quantity, note }; DELETE ?lineId=…
export async function GET(_req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const { user, role, admin, deny } = await requireUserWithRole();
  if (deny) return deny;
  const { deny: accessDeny } = await loadDesignJobWithAccess(admin, jobId, user.id, role);
  if (accessDeny) return accessDeny;
  const { data, error } = await admin.from('design_job_materials')
    .select('id, area, quantity, note, created_at, material:design_materials(id, category, name, code, supplier_name, finish, color_hex, unit, price, currency)')
    .eq('job_id', jobId).order('created_at');
  if (error) return tableMissing(error) ? NextResponse.json({ notReady: NOT_READY, lines: [] }) : NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lines: data ?? [] });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const { user, role, admin, deny } = await requireUserWithRole();
  if (deny) return deny;
  const { job, deny: accessDeny } = await loadDesignJobWithAccess(admin, jobId, user.id, role);
  if (accessDeny) return accessDeny;
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { data: mat } = await admin.from('design_materials').select('id, name').eq('id', String(b.materialId ?? '')).is('deleted_at', null).maybeSingle();
  if (!mat) return NextResponse.json({ error: 'Pick a material from the catalogue' }, { status: 400 });
  const qty = b.quantity === '' || b.quantity == null ? null : Number(b.quantity);
  if (qty != null && (!Number.isFinite(qty) || qty < 0)) return NextResponse.json({ error: 'Quantity must be a positive number' }, { status: 400 });
  const area = String(b.area ?? '').trim().slice(0, 120) || null;
  const { data, error } = await admin.from('design_job_materials').insert({
    job_id: jobId, material_id: mat.id, area, quantity: qty, note: String(b.note ?? '').trim().slice(0, 500) || null, created_by: user.id,
  }).select('id').single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'That material is already on this job for the same area' }, { status: 409 });
    return NextResponse.json({ error: tableMissing(error) ? NOT_READY : error.message }, { status: tableMissing(error) ? 409 : 500 });
  }
  await logLeadActivity(admin, {
    leadIntakeId: job!.lead_intake_id ?? undefined, opportunityId: job!.opportunity_id ?? undefined,
    actorId: user.id, kind: 'change', body: `material added to the design: ${mat.name}${area ? ` (${area})` : ''}`,
  });
  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const { user, role, admin, deny } = await requireUserWithRole();
  if (deny) return deny;
  const { deny: accessDeny } = await loadDesignJobWithAccess(admin, jobId, user.id, role);
  if (accessDeny) return accessDeny;
  const lineId = req.nextUrl.searchParams.get('lineId');
  if (!lineId) return NextResponse.json({ error: 'lineId required' }, { status: 400 });
  const { error } = await admin.from('design_job_materials').delete().eq('id', lineId).eq('job_id', jobId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
