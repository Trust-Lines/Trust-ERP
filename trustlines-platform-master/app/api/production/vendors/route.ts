import { NextRequest, NextResponse } from 'next/server';
import { requireVendorAccess } from '@/lib/production/vendorAccess';
import { suggestVendorCode } from '@/lib/production/vendorCode';
import { logAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

interface SupplierRow { id: string; code: string | null; name: string; fixed_millwork_codes?: boolean }

export async function GET() {
  const { admin, deny } = await requireVendorAccess('read');
  if (deny) return deny;
  // select('*'): fixed_millwork_codes comes with migration 151; before it the list still loads.
  const { data } = await admin.from('suppliers').select('*').eq('is_active', true).order('code', { ascending: true }) as { data: SupplierRow[] | null };
  return NextResponse.json({
    vendors: (data ?? []).map(v => ({ id: v.id, code: v.code, name: v.name, fixedMillworkCodes: !!v.fixed_millwork_codes })),
  });
}

/**
 * New vendor. The Production tracker sends `strict: true` (Trust System rules): the code is
 * required, 2–10 letters/digits, and a code or name already in use answers 409. Other callers
 * (Item List generator) keep the old behaviour: code optional, suggested and suffixed when taken.
 */
export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireVendorAccess('write');
  if (deny) return deny;

  const { name, code, strict, fixedMillworkCodes } = await req.json() as { name?: string; code?: string; strict?: boolean; fixedMillworkCodes?: boolean };
  const cleanName = (name ?? '').trim();
  if (!cleanName) return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });

  let base = (code ?? '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (strict && (base.length < 2 || base.length > 10)) {
    return NextResponse.json({ error: 'Vendor code must be 2–10 characters' }, { status: 400 });
  }
  if (!base) base = suggestVendorCode(cleanName);

  const { data: existing } = await admin.from('suppliers').select('code, name') as {
    data: { code: string | null; name: string | null }[] | null;
  };
  const taken = new Set((existing ?? []).map(s => (s.code ?? '').toUpperCase()));

  let finalCode = base;
  if (strict) {
    if (taken.has(base)) return NextResponse.json({ error: `A vendor with code '${base}' already exists` }, { status: 409 });
    if ((existing ?? []).some(s => (s.name ?? '').trim().toUpperCase() === cleanName.toUpperCase())) {
      return NextResponse.json({ error: `A vendor named '${cleanName}' already exists` }, { status: 409 });
    }
  } else if (taken.has(finalCode)) {
    let n = 2;
    while (taken.has(`${base}${n}`)) n++;
    finalCode = `${base}${n}`;
  }

  const row: Record<string, unknown> = { name: cleanName, code: finalCode, is_active: true };
  if (fixedMillworkCodes) row.fixed_millwork_codes = true;
  const { data: created, error } = await admin.from('suppliers').insert(row).select('*').single() as { data: SupplierRow | null; error: { message: string } | null };

  if (error || !created) {
    if (error) console.error('[vendors POST]', error.message);
    return NextResponse.json({ error: 'Could not create vendor' }, { status: 500 });
  }

  await logAudit({ actorId: user.id, action: 'vendor.created', resource: `${created.code} — ${created.name}` });

  return NextResponse.json({ vendor: { id: created.id, code: created.code, name: created.name, fixedMillworkCodes: !!created.fixed_millwork_codes } });
}
