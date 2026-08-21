import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';

const MANAGE_ROLES = ['sales_marketing_manager', 'ops_manager', 'general_manager'];

export async function GET() {
  const { admin, deny } = await requireRole(MANAGE_ROLES);
  if (deny) return deny;

  const { data, error } = await admin.rpc('peek_global_number');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ nextNumber: (data as number) ?? 1 });
}

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole(MANAGE_ROLES);
  if (deny) return deny;

  const body = await req.json() as { next_number?: number | string };
  const next = Number(body.next_number);
  if (!Number.isFinite(next) || next < 1) {
    return NextResponse.json({ error: 'Enter a valid number (1 or more)' }, { status: 400 });
  }

  const { data, error } = await admin.rpc('set_global_next_number', { p_next: Math.trunc(next) });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('audit_log').insert({
    actor_id: user.id,
    action: 'sales.counter_set',
    new_value: { next_number: Math.trunc(next) },
  });

  return NextResponse.json({ ok: true, nextNumber: (data as number) });
}
