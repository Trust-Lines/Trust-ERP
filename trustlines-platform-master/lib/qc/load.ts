import { buildQcQueue, type QcItem, type QcInspection, type QcQueue } from '@/lib/qc/queue';

export const QC_WRITE_ROLES = ['qc_responsible', 'production_manager', 'ops_manager', 'general_manager', 'project_manager'];

export interface QcQueueData {
  queue: QcQueue;
  names: Record<string, string>;
  projects: Record<string, { code: string; name: string }>;
  migrationReady: boolean;
}

/** The QC workspace data — shared by the /qc page and GET /api/qc/queue (mobile). Caller authorizes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadQcQueue(admin: any, userId: string): Promise<QcQueueData> {
  const [itemsRes, inspRes] = await Promise.all([
    admin.from('production_items')
      .select('id, project_id, type, status')
      .is('deleted_at', null)
      .in('status', ['RECEIVED', 'READY', 'SENT_TO_TLINES', 'PARTIAL_SENT', 'SENT'])
      .limit(500),
    admin.from('qc_checklists')
      .select('id, project_id, production_item_id, overall_result, conducted_by, conducted_at, rework_of_id')
      .is('deleted_at', null)
      .limit(1000),
  ]);

  const migrationReady = !inspRes.error;
  const items = (itemsRes.error ? [] : (itemsRes.data ?? [])) as QcItem[];
  const inspections = (migrationReady ? (inspRes.data ?? []) : []) as QcInspection[];

  const queue = buildQcQueue(items, inspections, userId);

  const ids = [...new Set([
    ...queue.myInspections, ...queue.failed, ...queue.rework, ...queue.completed,
  ].map(r => r.conductedBy).filter((v): v is string => !!v))];
  const projectIds = [...new Set(
    Object.values(queue).flat().map(r => (r as { projectId: string }).projectId),
  )];

  const [peopleRes, projectsRes] = await Promise.all([
    ids.length ? admin.from('profiles').select('id, full_name').in('id', ids) : Promise.resolve({ data: [] }),
    projectIds.length
      ? admin.from('projects').select('id, code, name').in('id', projectIds)
      : Promise.resolve({ data: [] }),
  ]);

  const names: Record<string, string> = {};
  for (const p of (peopleRes.data ?? []) as { id: string; full_name: string }[]) names[p.id] = p.full_name;
  const projects: Record<string, { code: string; name: string }> = {};
  for (const p of (projectsRes.data ?? []) as { id: string; code: string; name: string }[]) {
    projects[p.id] = { code: p.code, name: p.name };
  }

  return { queue, names, projects, migrationReady };
}
