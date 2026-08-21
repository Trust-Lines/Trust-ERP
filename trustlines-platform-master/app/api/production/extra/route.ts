import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const source = req.nextUrl.searchParams.get('source') ?? 'direct_order';
  if (!['direct_order', 'missing_extra'].includes(source)) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: projects } = await admin.from('projects')
    .select('id, code, name')
    .is('deleted_at', null)
    .or('is_archived.is.null,is_archived.eq.false')
    .or('is_draft.is.null,is_draft.eq.false,delivered_to_trust_at.not.is.null')
    .order('code', { ascending: true }) as {
      data: { id: string; code: string; name: string }[] | null;
    };
  const projList = projects ?? [];
  const projById = new Map(projList.map(p => [p.id, p]));

  const { data: rows } = await admin.from('production_items')
    .select('id, project_id, source, type, vendor_id, pf_code, order_type, status, pf_usd, pf_tl, invoice, invoice_tl, created_at')
    .eq('source', source).is('deleted_at', null)
    .order('created_at', { ascending: false }) as {
      data: { id: string; project_id: string; type: string; vendor_id: string | null; pf_code: string | null; status: string }[] | null;
    };

  const withLabels = (rows ?? []).map(r => {
    const p = projById.get(r.project_id);
    return { ...r, project_code: p?.code ?? '—', project_name: p?.name ?? '' };
  });

  const { data: vendors } = await admin.from('suppliers')
    .select('id, code, name').eq('is_active', true).order('code', { ascending: true }) as {
      data: { id: string; code: string | null; name: string }[] | null;
    };

  return NextResponse.json({ rows: withLabels, projects: projList, vendors: vendors ?? [] });
}
