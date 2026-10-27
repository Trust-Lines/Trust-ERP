import { NextRequest, NextResponse } from 'next/server';
import { requireVendorAccess } from '@/lib/production/vendorAccess';
import { logAudit } from '@/lib/audit/log';

type Params = { params: Promise<{ id: string }> };

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
