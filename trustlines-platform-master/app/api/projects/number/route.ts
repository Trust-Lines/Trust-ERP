import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { peekFreeProjectNumber, reserveFreeProjectNumber } from '@/lib/projects/number';

export const dynamic = 'force-dynamic';

// New Project form → its project number (lib/projects/number): GET = the number it will get,
// POST = reserve it. Used numbers (Trust, ClickUp, ours) are skipped. Signed-in users only — the
// same people the counter RPCs were open to before.
export async function GET() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  try { return NextResponse.json({ number: await peekFreeProjectNumber(createAdminClient()) }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not read the next number' }, { status: 503 }); }
}

export async function POST() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  try { return NextResponse.json({ number: await reserveFreeProjectNumber(createAdminClient()) }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not reserve a project number' }, { status: 503 }); }
}
