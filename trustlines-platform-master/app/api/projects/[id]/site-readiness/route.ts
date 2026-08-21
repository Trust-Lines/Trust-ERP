import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { emitEvent } from '@/lib/events';
import { FINALIZATION_READ_ROLES, FINALIZATION_WRITE_ROLES, defaultSiteChecklist, deriveOverallStatus } from '@/lib/finalization/config';
import type { SiteReadinessItem } from '@/types/database';

type Params = { params: Promise<{ id: string }> };
const COLS = 'id, project_id, checklist, overall_status, target_ready_date, notes, created_at, updated_at';

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { admin, deny } = await requireRole(FINALIZATION_READ_ROLES);
  if (deny) return deny;

  const res = await admin.from('site_readiness').select(COLS).eq('project_id', id).maybeSingle();
  if (res.error) return NextResponse.json({ siteReadiness: null, template: defaultSiteChecklist() });
  return NextResponse.json({ siteReadiness: res.data ?? null, template: defaultSiteChecklist() });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(FINALIZATION_WRITE_ROLES);
  if (deny) return deny;

  const { data: proj } = await admin.from('projects').select('id').eq('id', id).maybeSingle();
  if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { toggle?: string; target_ready_date?: string | null; notes?: string };

  let { data: row } = await admin.from('site_readiness').select(COLS).eq('project_id', id).maybeSingle();
  if (!row) {
    const seed = defaultSiteChecklist();
    const { data: created, error: insErr } = await admin.from('site_readiness')
      .insert({ project_id: id, checklist: seed, overall_status: deriveOverallStatus(seed), created_by: user.id }).select(COLS).single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    row = created;
  }

  const patch: Record<string, unknown> = {};
  if (body.toggle) {
    const list = (row.checklist ?? []) as SiteReadinessItem[];
    if (!list.some(it => it.key === body.toggle)) return NextResponse.json({ error: 'Unknown item' }, { status: 400 });
    const now = new Date().toISOString();
    const next = list.map(it => it.key === body.toggle
      ? { ...it, done: !it.done, done_at: !it.done ? now : null, done_by: !it.done ? user.id : null }
      : it);
    patch.checklist = next;
    patch.overall_status = deriveOverallStatus(next);
  }
  if ('target_ready_date' in body) patch.target_ready_date = body.target_ready_date || null;
  if ('notes' in body) patch.notes = (body.notes ?? '').trim() || null;

  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('site_readiness').update(patch).eq('project_id', id).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'site_readiness.updated', projectId: id, resource: `site_readiness:${data.id}`, newValue: Object.keys(patch) });

  if (row.overall_status !== 'ready' && data.overall_status === 'ready') {
    await emitEvent(admin, {
      type: 'site.ready',
      entityTable: 'site_readiness',
      entityId: data.id,
      projectId: id,
      actorId: user.id,
    });
  }

  return NextResponse.json({ siteReadiness: data });
}
