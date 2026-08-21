
import { deriveHandover, AUTO_HANDOVER_KEYS } from './checklist';
import type { HandoverChecklistItem } from '@/types/database';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface HandoverReadiness {
  autoGreen: boolean;
  manualDone: boolean;
  ready: boolean;
}

const PROJECT_COLS =
  'id, tlines_pm_id, trustlines_pm_id, pm_supervisor_id, dropbox_root_path, customer_id, closed_deal_date';

export async function handoverReadiness(
  admin: any,
  projectId: string,
  handover: { checklist?: HandoverChecklistItem[] | null; meeting_at?: string | null } | null,
): Promise<HandoverReadiness> {
  const none: HandoverReadiness = { autoGreen: false, manualDone: false, ready: false };

  const { data: project } = await admin.from('projects').select(PROJECT_COLS).eq('id', projectId).maybeSingle();
  if (!project) return none;

  const { count: documentCount } = await admin.from('documents')
    .select('id', { count: 'exact', head: true }).eq('project_id', projectId);

  let meetingAt: string | null = handover?.meeting_at ?? null;
  if (!meetingAt && project.customer_id) {
    const res = await admin.from('customer_meetings')
      .select('meeting_at').eq('customer_id', project.customer_id).eq('meeting_type', 'handover')
      .is('deleted_at', null).order('meeting_at', { ascending: false }).limit(1).maybeSingle();
    meetingAt = res.error ? null : ((res.data as { meeting_at?: string } | null)?.meeting_at ?? null);
  }

  const derived = deriveHandover({
    tlines_pm_id:      project.tlines_pm_id ?? null,
    trustlines_pm_id:  project.trustlines_pm_id ?? null,
    pm_supervisor_id:  project.pm_supervisor_id ?? null,
    dropbox_root_path: project.dropbox_root_path ?? null,
    customer_id:       project.customer_id ?? null,
    closed_deal_date:  project.closed_deal_date ?? null,
    documentCount:     documentCount ?? 0,
    meetingAt,
  });

  const autoGreen = Object.values(derived).every(Boolean);

  const list = (handover?.checklist ?? []) as HandoverChecklistItem[];
  const manualItems = list.filter(i => !AUTO_HANDOVER_KEYS.has(i.key));
  const manualDone = manualItems.length > 0 && manualItems.every(i => i.done);

  return { autoGreen, manualDone, ready: autoGreen && manualDone };
}
