import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { requireDesignPage } from '@/lib/design/access';

// Customer Reviews — every design proposal link sent to a customer (approval_links targeting a
// design version): opened?, decided?, what they said, how long it's been waiting.
export async function GET() {
  const { admin, isManager, deny } = await requireDesignPage('page.design_reviews');
  if (deny) return deny;

  const { data: links, error } = await admin.from('approval_links')
    .select('id, title, status, decision, view_count, first_opened_at, completed_at, expires_at, revoked_at, created_at, created_by, sales_design_version_id')
    .not('sales_design_version_id', 'is', null).order('created_at', { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (links ?? []) as { id: string; created_by: string | null; sales_design_version_id: string }[];
  if (!rows.length) return NextResponse.json({ reviews: [], isManager });

  const versionIds = [...new Set(rows.map(r => r.sales_design_version_id))];
  const { data: versions } = await admin.from('sales_design_versions').select('id, job_id, version_no, customer_feedback').in('id', versionIds);
  const vById = new Map(((versions ?? []) as { id: string; job_id: string; version_no: number; customer_feedback: string | null }[]).map(v => [v.id, v]));
  const jobIds = [...new Set([...vById.values()].map(v => v.job_id))];
  const { data: jobs } = jobIds.length ? await admin.from('sales_design_jobs').select('id, title, assigned_designer_id').in('id', jobIds) : { data: [] };
  const jById = new Map(((jobs ?? []) as { id: string; title: string; assigned_designer_id: string | null }[]).map(j => [j.id, j]));

  const people = [...new Set([...rows.map(r => r.created_by), ...[...jById.values()].map(j => j.assigned_designer_id)].filter(Boolean))] as string[];
  const { data: ps } = people.length ? await admin.from('profiles').select('id, full_name').in('id', people) : { data: [] };
  const name = new Map(((ps ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));

  // The customer's latest comment per link.
  const { data: events } = await admin.from('approval_link_events').select('approval_link_id, comment, actor_name, created_at')
    .in('approval_link_id', rows.map(r => r.id)).not('comment', 'is', null).order('created_at', { ascending: false });
  const lastComment = new Map<string, { comment: string; actor_name: string | null; created_at: string }>();
  for (const e of (events ?? []) as { approval_link_id: string; comment: string; actor_name: string | null; created_at: string }[]) {
    if (!lastComment.has(e.approval_link_id)) lastComment.set(e.approval_link_id, e);
  }

  const reviews = rows.map(r => {
    const v = vById.get(r.sales_design_version_id);
    const j = v ? jById.get(v.job_id) : undefined;
    return {
      ...r,
      job_id: j?.id ?? null,
      job_title: (j?.title ?? 'Design').replace(/^Sales Design\s+[—-]\s+/i, ''),
      version_no: v?.version_no ?? null,
      designer: j?.assigned_designer_id ? name.get(j.assigned_designer_id) ?? null : null,
      sent_by: r.created_by ? name.get(r.created_by) ?? null : null,
      feedback: lastComment.get(r.id)?.comment ?? v?.customer_feedback ?? null,
      feedback_by: lastComment.get(r.id)?.actor_name ?? null,
    };
  });
  return NextResponse.json({ reviews, isManager });
}

// { action: 'revoke', linkId } — the customer link stops working (Sales / managers).
export async function POST(req: NextRequest) {
  const { user, admin, isManager, deny } = await requireDesignPage('page.design_reviews');
  if (deny) return deny;
  if (!isManager) return NextResponse.json({ error: 'Only Sales or a manager can revoke a customer link' }, { status: 403 });
  const body = await req.json().catch(() => ({})) as { action?: string; linkId?: string };
  if (body.action !== 'revoke' || !body.linkId) return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  const { data, error } = await admin.from('approval_links')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', body.linkId).eq('status', 'active').not('sales_design_version_id', 'is', null)
    .select('id, project_id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Only an active link can be revoked' }, { status: 409 });
  await admin.from('approval_link_events').insert({ approval_link_id: data.id, event_type: 'revoked' });
  await logAudit({ actorId: user.id, action: 'approval_link.revoked', projectId: data.project_id, resource: `approval_link:${data.id}` });
  return NextResponse.json({ ok: true });
}
