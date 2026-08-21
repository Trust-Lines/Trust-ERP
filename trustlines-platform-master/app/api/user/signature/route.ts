import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin.from('profiles').select('signature_base64').eq('id', user.id).single();
  return NextResponse.json({ base64: (data as { signature_base64?: string } | null)?.signature_base64 ?? null });
}

export async function PUT(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const { base64 } = await req.json() as { base64?: string };
  if (!base64) return NextResponse.json({ error: 'base64 required' }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { error } = await admin.from('profiles').update({ signature_base64: base64 }).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
