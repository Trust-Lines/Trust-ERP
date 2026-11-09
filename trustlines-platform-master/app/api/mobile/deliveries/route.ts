import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { DELIVERY_READ_ROLES } from '@/lib/delivery/config';

// Mobile calendars (087 sevkiyat takvimi / 088 takvimim / 089): delivery plans and installations
// falling in [from, to]. A tlines_pm sees only their projects.
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const { user, role, admin, deny } = await requireRole(DELIVERY_READ_ROLES);
  if (deny) return deny;
  const from = req.nextUrl.searchParams.get('from') ?? '', to = req.nextUrl.searchParams.get('to') ?? '';
  if (!DAY.test(from) || !DAY.test(to) || to < from || Date.parse(to) - Date.parse(from) > 93 * 864e5)
    return NextResponse.json({ error: 'from / to must be YYYY-MM-DD, at most 93 days apart' }, { status: 400 });

  const [plans, installs] = await Promise.all([
    admin.from('delivery_plans').select('project_id, delivery_method, installation_date, build_by, status, site_confirmed')
      .or(`and(installation_date.gte.${from},installation_date.lte.${to}),and(build_by.gte.${from},build_by.lte.${to})`).limit(500),
    admin.from('installations').select('id, project_no, project_name, city_state, planned_start, planned_finish, team, status')
      .lte('planned_start', to).gte('planned_finish', from).limit(500),
  ]);
  const ids = [...new Set(((plans.data ?? []) as { project_id: string }[]).map(p => p.project_id))];
  let pq = ids.length ? admin.from('projects').select('id, code, name, tlines_pm_id').in('id', ids).is('deleted_at', null) : null;
  if (pq && role === 'tlines_pm') pq = pq.eq('tlines_pm_id', user.id);
  const { data: projs } = pq ? await pq : { data: [] };
  const proj = Object.fromEntries(((projs ?? []) as { id: string; code: string; name: string }[]).map(p => [p.id, p]));

  return NextResponse.json({
    deliveries: ((plans.data ?? []) as { project_id: string }[]).filter(p => proj[p.project_id])
      .map(p => ({ ...p, project_code: proj[p.project_id].code, project_name: proj[p.project_id].name })),
    installations: role === 'tlines_pm' ? [] : installs.data ?? [],
  });
}
