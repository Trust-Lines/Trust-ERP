import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: vendor } = await admin.from('suppliers').select('code, name').eq('id', id).single() as {
    data: { code: string | null; name: string } | null;
  };
  const { error } = await admin.from('suppliers').update({ is_active: false }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'vendor.deleted', resource: `${vendor?.code ?? ''} — ${vendor?.name ?? ''}`.trim() });
  return NextResponse.json({ ok: true });
}
