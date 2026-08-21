import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitEvent } from '@/lib/events';
import { STALE_APPROVAL_DAYS, staleApprovals, reminderDedupeKey } from '@/lib/approvals/reminders';

export async function POST() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: pending, error } = await admin
    .from('document_approvals')
    .select('id, project_id, document_id, doc_type, assigned_to, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(200) as {
      data: {
        id: string; project_id: string; document_id: string; doc_type: string | null;
        assigned_to: string | null; status: string; created_at: string;
      }[] | null;
      error: { message: string } | null;
    };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const stale = staleApprovals(pending ?? [], new Date());
  if (!stale.length) return NextResponse.json({ reminded: 0 });

  const docIds = [...new Set(stale.map(s => s.approval.document_id))];
  const { data: docs } = await admin.from('documents')
    .select('id, file_name, doc_type').in('id', docIds) as {
      data: { id: string; file_name: string; doc_type: string }[] | null;
    };
  const docById = new Map((docs ?? []).map(d => [d.id, d]));

  let reminded = 0;
  for (const { approval, waitingDays } of stale) {
    const doc = docById.get(approval.document_id);
    const event = await emitEvent(admin, {
      type: 'approval.reminder',
      entityTable: 'document_approvals',
      entityId: approval.id,
      projectId: approval.project_id,
      actorId: null,
      dedupeKey: reminderDedupeKey(approval.id, new Date()),
      payload: {
        assigneeId: approval.assigned_to,
        docLabel:   doc?.file_name ?? approval.doc_type ?? 'A document',
        waitingDays,
      },
    });
    if (event) reminded++;
  }

  return NextResponse.json({ reminded, checked: (pending ?? []).length, thresholdDays: STALE_APPROVAL_DAYS });
}
