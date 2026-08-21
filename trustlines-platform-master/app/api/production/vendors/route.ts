import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { suggestVendorCode } from '@/lib/production/vendorCode';
import { logAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin.from('suppliers')
    .select('id, code, name').eq('is_active', true).order('code', { ascending: true });
  return NextResponse.json({ vendors: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const { name, code } = await req.json() as { name?: string; code?: string };
  const cleanName = (name ?? '').trim();
  if (!cleanName) return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  let base = (code ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!base) base = suggestVendorCode(cleanName);

  const { data: existing } = await admin.from('suppliers').select('code') as {
    data: { code: string | null }[] | null;
  };
  const taken = new Set((existing ?? []).map(s => (s.code ?? '').toUpperCase()));

  let finalCode = base;
  if (taken.has(finalCode)) {
    let n = 2;
    while (taken.has(`${base}${n}`)) n++;
    finalCode = `${base}${n}`;
  }

  const { data: created, error } = await admin.from('suppliers')
    .insert({ name: cleanName, code: finalCode, is_active: true })
    .select('id, code, name').single() as { data: { id: string; code: string; name: string } | null; error: { message: string } | null };

  if (error || !created) return NextResponse.json({ error: error?.message ?? 'Create failed' }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'vendor.created', resource: `${created.code} — ${created.name}` });

  return NextResponse.json({ vendor: created });
}
