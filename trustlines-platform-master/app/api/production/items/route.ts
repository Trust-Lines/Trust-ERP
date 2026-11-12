import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { typesForCategories } from '@/lib/production/board';
import { requireProductionWrite } from '@/lib/production/guard';
import { logAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

const ITEM_COLS = 'id, project_id, case_id, source, type, vendor_id, pf_code, order_type, po_sign_status, pf_sign_status, status, std, etd, rtd, rtr, rdy, ftd, snd, pf_usd, pf_tl, invoice, invoice_tl, payment_rule, container_no, container_date, sort_index';

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
      const { data: seeded, error: seedErr } = await admin.from('production_items').insert(seed).select(ITEM_COLS) as {
        data: Record<string, unknown>[] | null; error: { code?: string } | null;
      };
      items = seeded ?? [];
      // Another request seeded this project a moment ago (unique index, migration 148): read theirs.
      if (seedErr?.code === '23505') {
        ({ data: items } = await admin.from('production_items').select(ITEM_COLS)
          .eq('project_id', projectId).eq('source', 'project').is('deleted_at', null)
          .order('sort_index', { ascending: true }) as { data: Record<string, unknown>[] | null });
      }
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

/**
 * New row ("Add Item" in the tracker's Edit Item panel, or a row on a project).
 *   body: { projectId } or { caseId }, type, source?, customTypeCode?
 * A row added to a type group joins that group's PO (one PO per type, Trust System rule): it
 * takes SIGNED / WAITING TLINES TO SIGN / WAITING T TO SIGN when a sibling has one, else READY TO
 * SIGN, else NOT SIGNED. No vendor, no PF code, NOT ORDERED.
 */
export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireProductionWrite();
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const projectId = String(body.projectId ?? body.project_id ?? '').trim() || null;
  const caseId = String(body.caseId ?? body.case_id ?? '').trim() || null;
  const type = String(body.type ?? '').trim();
  const customTypeCode = String(body.customTypeCode ?? '').trim() || null;
  if (!projectId && !caseId) return NextResponse.json({ error: 'projectId or caseId is required' }, { status: 400 });
  if (!type || (!BOARD_TYPES.includes(type) && !customTypeCode)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  let source = String(body.source ?? (caseId ? '' : 'project')).trim();
  if (caseId) {
    const { data: c } = await admin.from('production_cases').select('id, kind').eq('id', caseId).is('deleted_at', null).maybeSingle();
    if (!c) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    source = c.kind;
  } else {
    const { data: project } = await admin.from('projects').select('id').eq('id', projectId).maybeSingle();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  if (!SOURCES.includes(source)) return NextResponse.json({ error: 'Invalid source' }, { status: 400 });

  let q = admin.from('production_items').select('sort_index, type, po_sign_status').is('deleted_at', null);
  q = caseId ? q.eq('case_id', caseId) : q.eq('project_id', projectId).eq('source', source);
  const { data: siblings } = await q as { data: { sort_index: number | null; type: string; po_sign_status: string | null }[] | null };
  const nextSort = (siblings ?? []).reduce((m, r) => Math.max(m, (r.sort_index ?? 0) + 1), 0);
  const groupPo = (siblings ?? []).filter(r => r.type === type).map(r => r.po_sign_status ?? 'NOT_SIGNED');
  const po = ['SIGNED', 'WAITING_TLINES_TO_SIGN', 'WAITING_T_TO_SIGN'].find(v => groupPo.includes(v))
    ?? (groupPo.includes('READY_TO_SIGN') ? 'READY_TO_SIGN' : 'NOT_SIGNED');

  const { data, error } = await admin.from('production_items')
    .insert({ project_id: projectId, case_id: caseId, source, type, custom_type_code: customTypeCode, sort_index: nextSort, po_sign_status: po })
    .select(ITEM_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'production.item_created', projectId: projectId ?? undefined, resource: `${source}:${type}`, newValue: { source, type, caseId } });
  return NextResponse.json({ item: data });
}
