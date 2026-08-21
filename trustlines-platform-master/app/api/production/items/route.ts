import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { typesForCategories } from '@/lib/production/board';
import { requireProductionWrite } from '@/lib/production/guard';
import { logAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

const ITEM_COLS = 'id, project_id, source, type, vendor_id, pf_code, order_type, po_sign_status, pf_sign_status, status, std, etd, rtd, rtr, rdy, ftd, snd, pf_usd, pf_tl, invoice, invoice_tl, payment_rule, container_no, container_date, sort_index';

const BOARD_TYPES = ['Millwork', 'Shelving', 'Ceiling', 'Image', 'Furniture', 'Decoration'];
const SOURCES = ['project', 'direct_order', 'missing_extra'];

export async function GET(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  let { data: items } = await admin
    .from('production_items').select(ITEM_COLS)
    .eq('project_id', projectId).eq('source', 'project').is('deleted_at', null)
    .order('sort_index', { ascending: true }) as { data: Record<string, unknown>[] | null };

  if (!items?.length) {
    const { data: project } = await admin.from('projects').select('categories').eq('id', projectId).single() as {
      data: { categories: string[] | null } | null;
    };
    const types = typesForCategories(project?.categories);
    if (types.length) {
      const seed = types.map((type, i) => ({ project_id: projectId, source: 'project', type, sort_index: i }));
      const { data: seeded } = await admin.from('production_items').insert(seed).select(ITEM_COLS) as {
        data: Record<string, unknown>[] | null;
      };
      items = seeded ?? [];
    } else {
      items = [];
    }
  }

  const { data: vendors } = await admin
    .from('suppliers').select('id, code, name').eq('is_active', true).order('code', { ascending: true }) as {
      data: { id: string; code: string | null; name: string }[] | null;
    };

  return NextResponse.json({ items: items ?? [], vendors: vendors ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireProductionWrite();
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const projectId = String(body.projectId ?? body.project_id ?? '').trim();
  const type = String(body.type ?? '').trim();
  const source = String(body.source ?? 'direct_order').trim();
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  if (!SOURCES.includes(source)) return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  if (!BOARD_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  const { data: project } = await admin.from('projects').select('id').eq('id', projectId).maybeSingle();
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data: siblings } = await admin.from('production_items')
    .select('sort_index').eq('project_id', projectId).eq('source', source).is('deleted_at', null);
  const nextSort = (siblings ?? []).reduce((m: number, r: { sort_index: number | null }) => Math.max(m, (r.sort_index ?? 0) + 1), 0);

  const { data, error } = await admin.from('production_items')
    .insert({ project_id: projectId, source, type, sort_index: nextSort })
    .select(ITEM_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'production.item_created', projectId, resource: `${source}:${type}`, newValue: { source, type } });
  return NextResponse.json({ item: data });
}
