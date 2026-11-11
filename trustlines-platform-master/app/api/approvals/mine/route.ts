import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadMyApprovals, MyApprovalsError } from '@/lib/approvals/mine';

// Document approvals waiting on the signed-in person (lib/approvals/mine.ts).
export async function GET() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const approvals = await loadMyApprovals(createAdminClient() as any, user.id);
    return NextResponse.json({ approvals });
  } catch (e) {
    // Fail loudly: an empty list here would tell approvers "nothing to do" when the
    // query actually failed (AGENTS.md §3 fail closed).
    console.error('[approvals/mine]', e instanceof MyApprovalsError ? e.where : '', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Could not load your approvals. Please try again or contact support.' }, { status: 500 });
  }
}
