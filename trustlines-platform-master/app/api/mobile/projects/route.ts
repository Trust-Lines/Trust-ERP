import { NextRequest, NextResponse } from 'next/server';
import { requireApiPage } from '@/lib/permissions/requireApi';
import { createClient } from '@/lib/supabase/server';

// Mobile "Projeler" (043): the same rows the web /projects list reads — through the user's own RLS
// session — in light columns only (no deal value / margin). A tlines_pm sees only their projects
// (canAccessProject rule).
export async function GET(req: NextRequest) {
  const { user, role, deny } = await requireApiPage('page.projects');
  if (deny) return deny;
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().replace(/[%,()]/g, ' ').slice(0, 60);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any).from('projects')
    .select('id, code, name, current_stage, categories, est_delivery_date, site_location, region, tlines_pm_id')
    .neq('is_archived', true).is('deleted_at', null);
  if (role === 'tlines_pm') query = query.eq('tlines_pm_id', user.id);
  if (q) query = query.or(`code.ilike.%${q}%,name.ilike.%${q}%`);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(300);
  if (error) return NextResponse.json({ error: 'Could not load projects' }, { status: 500 });

  return NextResponse.json({
    projects: (data ?? []).map(({ tlines_pm_id: _pm, ...p }: { tlines_pm_id: string | null }) => p),
  });
}
