import { NextRequest, NextResponse } from 'next/server';
import { requireApiPage } from '@/lib/permissions/requireApi';
import { canAccessProject } from '@/lib/permissions/projectAccess';
import { createClient } from '@/lib/supabase/server';

// Mobile project detail (027) + items (071) in one read. Items carry status and milestone dates
// only — never PF code, prices or invoices — so the screen is safe for every role, tlines_pm too.
// Read-only: unlike GET /api/production/items it never seeds rows.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, role, admin, deny } = await requireApiPage('page.projects');
  if (deny) return deny;
  const { id } = await params;
  if (!(await canAccessProject(id, user.id, role))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const supabase = await createClient();
  const [projectRes, itemsRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('projects')
      .select('id, code, name, current_stage, categories, site_location, region, est_delivery_date, closed_deal_date, created_at')
      .eq('id', id).is('deleted_at', null).maybeSingle(),
    admin.from('production_items')
      .select('id, type, order_type, status, std, etd, rdy, snd, container_no, sort_index')
      .eq('project_id', id).is('deleted_at', null).order('sort_index', { ascending: true }).limit(500),
  ]);
  if (projectRes.error || !projectRes.data) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  return NextResponse.json({ project: projectRes.data, items: itemsRes.error ? [] : itemsRes.data ?? [] });
}
