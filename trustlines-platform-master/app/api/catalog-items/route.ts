import { NextRequest, NextResponse } from 'next/server';
import { requireVendorAccess } from '@/lib/production/vendorAccess';

type CatalogItem = {
  id: string;
  item_code: string | null;
  description: string;
  description_note: string | null;
  category: string | null;
  unit_price: number | null;
  taking: string | null;
  vendor: string | null;
};

export async function GET(req: NextRequest) {
  // Catalog lines carry vendor unit prices — same audience as the Item List generator.
  const { admin, deny } = await requireVendorAccess('write');
  if (deny) return deny;

  const q        = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const code     = req.nextUrl.searchParams.get('code')?.trim() ?? '';
  const category = req.nextUrl.searchParams.get('category') ?? null;


  let query = admin
    .from('catalog_items')
    .select('id, item_code, description, description_note, category, unit_price, taking, vendor')
    .eq('is_active', true)
    .limit(20);

  if (code)     query = query.ilike('item_code', `%${code}%`);
  else if (q)   query = query.ilike('description', `%${q}%`);
  if (category) query = query.eq('category', category.toLowerCase());

  const { data, error } = await query.order('description') as { data: CatalogItem[] | null; error: unknown };

  if (error) return NextResponse.json({ items: [] });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireVendorAccess('write');
  if (deny) return deny;

  const body = await req.json() as {
    items: {
      item_code?: string | null;
      description: string;
      description_note?: string | null;
      category?: string;
      unit_price?: number | null;
      taking?: string | null;
      vendor?: string | null;
    }[];
  };

  if (!body.items?.length) return NextResponse.json({ ok: true });


  const rows = body.items.map(i => ({
    item_code:        i.item_code ?? null,
    description:      i.description,
    description_note: i.description_note ?? null,
    category:         i.category?.toLowerCase() ?? null,
    unit_price:       i.unit_price ?? null,
    taking:           i.taking ?? null,
    vendor:           i.vendor ?? null,
    created_by:       user.id,
    is_active:        true,
  }));

  await admin
    .from('catalog_items')
    .upsert(rows, { onConflict: 'description,category', ignoreDuplicates: false });

  return NextResponse.json({ ok: true });
}
