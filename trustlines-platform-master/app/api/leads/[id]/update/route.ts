import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';
import { logLeadActivity } from '@/lib/sales/activity';
import { notifyUser } from '@/lib/sales/notify';
import { assertLeadAccess } from '@/lib/sales/leadAccess';
import { ensureDesignJobForLead, DESIGN_TRIGGER_STATUS } from '@/lib/sales/design';

const ALLOWED = new Set([
  'priority', 'assignee_id', 'opportunity_status', 'next_action',
  'follow_up_date', 'deal_size', 'source', 'project_type', 'tags', 'industry',
]);
const NULLABLE = new Set(['assignee_id', 'follow_up_date', 'project_type', 'source', 'deal_size']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(SALES_INTAKE_ROLES);
  if (deny) return deny;
  const denied = await assertLeadAccess(admin, id, user.id, role);
  if (denied) return denied;

  const body = await req.json() as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED.has(k)) continue;
    if (k === 'deal_size') { patch[k] = (v === '' || v == null) ? null : Number(v); continue; }
    if (k === 'tags')      { patch[k] = Array.isArray(v) ? v : []; continue; }
    patch[k] = (NULLABLE.has(k) && (v === '' || v == null)) ? null : v;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No editable fields' }, { status: 400 });
  }

  const { error } = await admin.from('lead_intake').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const parts: string[] = [];
  if ('priority' in patch) parts.push(`priority → ${patch.priority}`);
  if ('opportunity_status' in patch) parts.push(`status → ${String(patch.opportunity_status).replace(/_/g, ' ')}`);
  if ('assignee_id' in patch) {
    let name = 'Unassigned';
    if (patch.assignee_id) {
      const { data } = await admin.from('profiles').select('full_name').eq('id', patch.assignee_id).single();
      name = (data as { full_name?: string } | null)?.full_name ?? 'someone';
      if (patch.assignee_id !== user.id) {
        await notifyUser(admin, { userId: patch.assignee_id as string, title: 'You were assigned a lead', body: 'A lead was assigned to you.', leadId: id });
      }
      await admin.from('lead_watchers').upsert({ lead_intake_id: id, user_id: patch.assignee_id }, { onConflict: 'lead_intake_id,user_id' });
    }
    parts.push(`assigned to ${name}`);
  }
  if ('next_action' in patch)    parts.push(`next action updated`);
  if ('deal_size' in patch)      parts.push(`deal size updated`);
  if ('follow_up_date' in patch) parts.push(`follow-up date updated`);
  if ('source' in patch)         parts.push(`source updated`);
  if ('project_type' in patch)   parts.push(`project type updated`);
  if (parts.length) await logLeadActivity(admin, { leadIntakeId: id, actorId: user.id, kind: 'change', body: parts.join(', ') });

  if (patch.opportunity_status === DESIGN_TRIGGER_STATUS) {
    await ensureDesignJobForLead(admin, id, user.id);
  }

  return NextResponse.json({ ok: true });
}
