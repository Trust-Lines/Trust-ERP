import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PdfSection } from '@/lib/pdf/PriceListPdf';
import { logAudit } from '@/lib/audit/log';

type Params = { params: Promise<{ id: string }> };
type ItemRef = { code: string; description: string };

function itemsOf(form: PdfSection[] | null): ItemRef[] {
  const out: ItemRef[] = [];
  for (const sec of form ?? [])
    for (const cat of sec.categories)
      for (const sub of cat.subCategories)
        for (const grp of sub.groups)
          for (const it of grp.items)
            if (it.description?.trim()) out.push({ code: it.itemCode ?? '', description: it.description });
  return out;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const { id: projectId } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: docs } = await admin.from('documents')
    .select('file_name, form_data, cat_group')
    .eq('project_id', projectId).eq('doc_type', 'pf')
    .order('file_name', { ascending: true }) as {
      data: { file_name: string; form_data: PdfSection[] | null; cat_group: string | null }[] | null;
    };

  const pfs = (docs ?? []).map(d => ({
    pfCode: d.file_name.split(' - PF')[0],
    catGroup: d.cat_group,
    items: itemsOf(d.form_data),
  }));

  let links: unknown[] = [];
  const linkRes = await admin.from('assembly_links')
    .select('id, type, source_pf_code, source_items, target_pf_code, target_items, note, created_at')
    .eq('project_id', projectId).order('created_at', { ascending: false }) as { data: unknown[] | null; error: { message?: string } | null };
  if (!linkRes.error) links = linkRes.data ?? [];

  return NextResponse.json({ pfs, links });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const { id: projectId } = await params;

  const body = await req.json() as {
    type?: string; sourcePfCode?: string; sourceItems?: ItemRef[];
    targetPfCode?: string; targetItems?: ItemRef[]; note?: string;
  };
  if (!body.sourceItems?.length || !body.targetItems?.length) {
    return NextResponse.json({ error: 'Select at least one item on each side' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin.from('assembly_links').insert({
    project_id: projectId, type: body.type ?? null,
    source_pf_code: body.sourcePfCode ?? null, source_items: body.sourceItems,
    target_pf_code: body.targetPfCode ?? null, target_items: body.targetItems,
    note: body.note ?? null, created_by: user.id,
  }).select('id').single() as { data: { id: string } | null; error: { message?: string } | null };
  if (error) return NextResponse.json({ error: error.message ?? 'Save failed' }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'assembly.linked', projectId, resource: `${body.sourcePfCode ?? ''} → ${body.targetPfCode ?? ''}` });
  return NextResponse.json({ ok: true, id: data?.id });
}
