import { NextRequest, NextResponse } from 'next/server';
import { requireApiPage } from '@/lib/permissions/requireApi';
import { canAccessProject } from '@/lib/permissions/projectAccess';

// Mobile product card (006) + history (072): one production item, its warehouse location and the
// last changes. No prices / invoices; the PF code is hidden from tlines_pm.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, role, admin, deny } = await requireApiPage('page.projects');
  if (deny) return deny;
  const { id } = await params;
  const { data: item } = await admin.from('production_items')
    .select('id, project_id, type, order_type, status, pf_code, std, etd, rtd, rtr, rdy, ftd, snd, container_no, container_date')
    .eq('id', id).is('deleted_at', null).maybeSingle();
  if (!item || !(await canAccessProject(item.project_id, user.id, role))) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const [project, loc, history] = await Promise.all([
    admin.from('projects').select('id, code, name').eq('id', item.project_id).maybeSingle(),
    admin.from('warehouse_locations').select('location, received_at, updated_at').eq('production_item_id', id).maybeSingle(),
    admin.from('audit_log').select('action, new_value, created_at, actor:profiles!actor_id(full_name)')
      .eq('project_id', item.project_id).like('action', 'production.item_%')
      .eq('resource', `${item.type} ${item.pf_code ?? ''}`.trim())
      .order('created_at', { ascending: false }).limit(20),
  ]);

  const { pf_code, ...safe } = item;
  return NextResponse.json({
    item: role === 'tlines_pm' ? safe : { ...safe, pf_code },
    project: project.data ?? null,
    location: loc.error ? null : loc.data ?? null,
    history: (history.data ?? []).map((h: { action: string; new_value: Record<string, unknown> | null; created_at: string; actor: { full_name: string } | null }) => ({
      action: h.action, status: (h.new_value?.status as string | undefined) ?? null, at: h.created_at, by: h.actor?.full_name ?? null,
    })),
  });
}
