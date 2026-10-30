import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { NOT_READY, requireDesignPage, tableMissing } from '@/lib/design/access';
import { brandKitFolder, cleanColors, cleanFonts } from '@/lib/design/libraryPaths';

const COLS = 'id, name, prospect_id, colors, fonts, guidelines, dropbox_folder_path, created_by, created_at, updated_at';

// Brand Kits — one per customer brand. ?prospectId=… returns that customer's kits (the design job
// panel shows them); ?prospects=<text> searches customers to link a kit to.
export async function GET(req: NextRequest) {
  const { user, admin, isManager, deny } = await requireDesignPage('page.design_brands');
  if (deny) return deny;

  const search = req.nextUrl.searchParams.get('prospects');
  if (search != null) {
    const q = search.trim().replace(/[%_,()]/g, ' ');
    if (q.length < 2) return NextResponse.json({ prospects: [] });
    const { data } = await admin.from('prospects').select('id, display_name, brand_name')
      .or(`display_name.ilike.%${q}%,brand_name.ilike.%${q}%`).is('deleted_at', null).order('display_name').limit(20);
    return NextResponse.json({ prospects: data ?? [] });
  }

  let query = admin.from('design_brand_kits').select(COLS).is('deleted_at', null).order('name');
  const prospectId = req.nextUrl.searchParams.get('prospectId');
  if (prospectId) query = query.eq('prospect_id', prospectId);
  const { data, error } = await query.limit(1000);
  if (error) return tableMissing(error) ? NextResponse.json({ notReady: NOT_READY, kits: [] }) : NextResponse.json({ error: error.message }, { status: 500 });

  const kits = (data ?? []) as { prospect_id: string | null }[];
  const pIds = [...new Set(kits.map(k => k.prospect_id).filter(Boolean))];
  const { data: ps } = pIds.length ? await admin.from('prospects').select('id, display_name').in('id', pIds) : { data: [] };
  const pName = new Map(((ps ?? []) as { id: string; display_name: string }[]).map(p => [p.id, p.display_name]));
  return NextResponse.json({ me: user.id, isManager, kits: kits.map(k => ({ ...k, prospect_name: k.prospect_id ? pName.get(k.prospect_id) ?? null : null })) });
}

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireDesignPage('page.design_brands');
  if (deny) return deny;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const name = String(body.name ?? '').trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: 'Name the brand kit' }, { status: 400 });

  const { data, error } = await admin.from('design_brand_kits').insert({
    name, prospect_id: typeof body.prospect_id === 'string' && body.prospect_id ? body.prospect_id : null,
    colors: cleanColors(body.colors), fonts: cleanFonts(body.fonts),
    guidelines: String(body.guidelines ?? '').trim().slice(0, 5000) || null, created_by: user.id,
  }).select(COLS).single();
  if (error) return NextResponse.json({ error: tableMissing(error) ? NOT_READY : error.message }, { status: tableMissing(error) ? 409 : 500 });

  // Its Dropbox folder (created by the first upload).
  const folder = brandKitFolder(data.id, name);
  await admin.from('design_brand_kits').update({ dropbox_folder_path: folder }).eq('id', data.id);
  await logAudit({ actorId: user.id, action: 'design_brand_kit.created', resource: `design_brand_kit:${data.id}`, newValue: { name } });
  return NextResponse.json({ kit: { ...data, dropbox_folder_path: folder } }, { status: 201 });
}
