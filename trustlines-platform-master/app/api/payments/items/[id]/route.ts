import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from '@/lib/permissions/server';
import { pageAllowed } from '@/lib/permissions/catalog';
import { NO_PF_ROLES } from '@/lib/production/access';
import { cleanPaymentPatch } from '@/lib/production/paymentFields';
import { logAudit } from '@/lib/audit/log';

type Params = { params: Promise<{ id: string }> };

// Finance → Payments: one field of a production row's accounting sheet (paid amounts and dates,
// transaction / invoice numbers, QuickBook). Needs the Payments page AND "Edit payments" (GM and
// accounting until set on the Roles page); tlines_pm never. Every change is audited with its old
// and new values.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = (prof as { role?: string } | null)?.role ?? null;
  if (!role || NO_PF_ROLES.has(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const perms = await getRolePermissions(admin, role);
  if (!pageAllowed(role, perms, 'page.payments') || !pageAllowed(role, perms, 'edit.payments')) {
    return NextResponse.json({ error: 'You cannot change payments' }, { status: 403 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const cleaned = cleanPaymentPatch(body);
  if ('error' in cleaned) return NextResponse.json({ error: cleaned.error }, { status: 400 });
  const fields = Object.keys(cleaned.update);

  const { data: before } = await admin.from('production_items')
    .select(['id', 'project_id', 'type', 'pf_code', ...fields].join(', '))
    .eq('id', id).is('deleted_at', null).maybeSingle() as { data: Record<string, unknown> | null };
  if (!before) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const { data: after, error } = await admin.from('production_items')
    .update({ ...cleaned.update, updated_at: new Date().toISOString() })
    .eq('id', id).is('deleted_at', null)
    .select(fields.join(', ')).single() as { data: Record<string, unknown> | null; error: { message: string } | null };
  if (error) return NextResponse.json({ error: 'Could not save' }, { status: 500 });

  await logAudit({
    actorId: user.id, action: 'payments.item_updated', projectId: (before.project_id as string | null) ?? null,
    resource: `${before.type ?? ''} ${before.pf_code ?? ''}`.trim(),
    oldValue: Object.fromEntries(fields.map(f => [f, before[f] ?? null])),
    newValue: after,
  });
  return NextResponse.json({ item: { id, ...after } });
}
