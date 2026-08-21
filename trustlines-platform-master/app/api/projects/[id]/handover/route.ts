import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { defaultChecklist, AUTO_HANDOVER_KEYS, HANDOVER_READ_ROLES, HANDOVER_WRITE_ROLES } from '@/lib/handover/checklist';
import { handoverReadiness } from '@/lib/handover/readiness';
import { emitEvent } from '@/lib/events';
import type { HandoverChecklistItem } from '@/types/database';

type Params = { params: Promise<{ id: string }> };
const COLS = 'id, project_id, checklist, status, meeting_at, notes, handed_over_by, handover_at, created_at, updated_at';

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { admin, deny } = await requireRole(HANDOVER_READ_ROLES);
  if (deny) return deny;

  const res = await admin.from('project_handovers').select(COLS).eq('project_id', id).maybeSingle();
  if (res.error) return NextResponse.json({ handover: null, template: defaultChecklist() });
  return NextResponse.json({ handover: res.data ?? null, template: defaultChecklist() });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(HANDOVER_WRITE_ROLES);
  if (deny) return deny;

  const { data: proj } = await admin.from('projects').select('id').eq('id', id).maybeSingle();
  if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as {
    toggle?: string; meeting_at?: string | null; notes?: string; complete?: boolean; reopen?: boolean;
  };

  let { data: row } = await admin.from('project_handovers').select(COLS).eq('project_id', id).maybeSingle();
  if (!row) {
    const { data: created, error: insErr } = await admin.from('project_handovers')
      .insert({ project_id: id, checklist: defaultChecklist(), created_by: user.id }).select(COLS).single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    row = created;
  }

  const patch: Record<string, unknown> = {};

  if (body.toggle) {
    if (AUTO_HANDOVER_KEYS.has(body.toggle)) {
      return NextResponse.json({ error: 'This item is set automatically and cannot be toggled' }, { status: 400 });
    }
    const list = (row.checklist ?? []) as HandoverChecklistItem[];
    const now = new Date().toISOString();
    const next = list.map(it => it.key === body.toggle
      ? { ...it, done: !it.done, done_at: !it.done ? now : null, done_by: !it.done ? user.id : null }
      : it);
    if (!next.some(it => it.key === body.toggle)) {
      return NextResponse.json({ error: 'Unknown checklist item' }, { status: 400 });
    }
    patch.checklist = next;
  }
  if ('meeting_at' in body) patch.meeting_at = body.meeting_at || null;
  if ('notes' in body) patch.notes = (body.notes ?? '').trim() || null;
  if (body.complete) { patch.status = 'complete'; patch.handover_at = new Date().toISOString(); patch.handed_over_by = user.id; }
  if (body.reopen)  { patch.status = 'in_progress'; patch.handover_at = null; patch.handed_over_by = null; }

  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('project_handovers').update(patch).eq('project_id', id).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const action = body.complete ? 'project.handover_completed' : body.reopen ? 'project.handover_reopened' : 'project.handover_updated';
  await logAudit({ actorId: user.id, action, projectId: id, resource: `project_handover:${data.id}`, newValue: Object.keys(patch) });

  if (!body.reopen) {
    try {
      const readiness = await handoverReadiness(admin, id, data);
      if (readiness.ready) {
        await emitEvent(admin, {
          type: 'handover.ready',
          entityTable: 'project_handovers',
          entityId: data.id,
          projectId: id,
          actorId: user.id,
        });
      }
    } catch (e) {
      console.error('[handover] A2 emit skipped:', e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ handover: data });
}
