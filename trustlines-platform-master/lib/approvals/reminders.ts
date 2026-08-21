
export const STALE_APPROVAL_DAYS = 3;

export interface PendingApproval {
  id: string;
  project_id: string;
  document_id: string;
  doc_type: string | null;
  assigned_to: string | null;
  status: string;
  created_at: string;
}

export interface StaleApproval {
  approval: PendingApproval;
  waitingDays: number;
}

export function daysWaiting(createdAt: string, now: Date): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.floor((now.getTime() - created) / 86_400_000);
}

export function staleApprovals(rows: PendingApproval[], now: Date): StaleApproval[] {
  const out: StaleApproval[] = [];
  for (const approval of rows) {
    if (approval.status !== 'pending') continue;
    if (!approval.assigned_to) continue;
    const waitingDays = daysWaiting(approval.created_at, now);
    if (waitingDays < STALE_APPROVAL_DAYS) continue;
    out.push({ approval, waitingDays });
  }
  return out;
}

export function reminderDedupeKey(approvalId: string, now: Date): string {
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `approval.reminder:${approvalId}:${day}`;
}
