import { NextRequest, NextResponse } from 'next/server';
import { createClient, requireUser } from '@/lib/supabase/server';

const ALLOWED_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected', 'signed', 'revised'] as const;
type DocStatus = typeof ALLOWED_STATUSES[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const supabase = await createClient();

  const { id } = await params;
  const { status } = await request.json() as { status: string };

  if (!ALLOWED_STATUSES.includes(status as DocStatus)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { error } = await sb
    .from('documents')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id, status });
}
