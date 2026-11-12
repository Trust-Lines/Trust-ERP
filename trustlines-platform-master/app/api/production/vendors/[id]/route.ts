import { NextRequest, NextResponse } from 'next/server';
import { requireVendorAccess } from '@/lib/production/vendorAccess';
import { logAudit } from '@/lib/audit/log';

type Params = { params: Promise<{ id: string }> };

/** Correct a vendor's code and / or name (the ✎ in the Production tracker's vendor list). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireVendorAccess('write');
  if (deny) return deny;
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { code?: string; name?: string };
  const patch: Record<string, string> = {};
  if (body.code !== undefined) {
    const code = String(body.code).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (code.length < 2 || code.length > 10) return NextResponse.json({ error: 'Vendor code must be 2–10 characters' }, { status: 400 });
    const { data: clash } = await admin.from('suppliers').select('id').ilike('code', code).neq('id', id).limit(1);
    if (clash?.length) return NextResponse.json({ error: `A vendor with code '${code}' already exists` }, { status: 409 });
    patch.code = code;
  }
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });
    patch.name = name;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('suppliers').update(patch).eq('id', id).select('id, code, name').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not update the vendor' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  await logAudit({ actorId: user.id, action: 'vendor.updated', resource: `${data.code} — ${data.name}`, newValue: patch });
  return NextResponse.json({ vendor: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireVendorAccess('write');
  if (deny) return deny;
  const { id } = await params;

  const { data: vendor } = await admin.from('suppliers').select('code, name').eq('id', id).maybeSingle() as {
    data: { code: string | null; name: string } | null;
  };
  if (!vendor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { error } = await admin.from('suppliers').update({ is_active: false }).eq('id', id);
  if (error) {
    console.error('[vendors DELETE]', error.message);
    return NextResponse.json({ error: 'Could not remove vendor' }, { status: 500 });
  }

  await logAudit({ actorId: user.id, action: 'vendor.deleted', resource: `${vendor?.code ?? ''} — ${vendor?.name ?? ''}`.trim() });
  return NextResponse.json({ ok: true });
}
