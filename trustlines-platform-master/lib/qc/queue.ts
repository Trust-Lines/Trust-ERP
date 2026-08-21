
import { STATUS_CHAIN } from '@/lib/production/board';

export type QcResult = 'pending' | 'pass' | 'fail';

export interface QcItem {
  id: string;
  project_id: string;
  type: string | null;
  status: string | null;
}

export interface QcInspection {
  id: string;
  project_id: string;
  production_item_id: string | null;
  overall_result: QcResult;
  conducted_by: string | null;
  conducted_at: string | null;
  rework_of_id: string | null;
}

export interface QcRow {
  itemId: string;
  projectId: string;
  type: string | null;
  inspectionId: string | null;
  latestInspectionId: string | null;
  result: QcResult | null;
  conductedBy: string | null;
  conductedAt: string | null;
  isRework: boolean;
}

export interface QcQueue {
  readyForQc: QcRow[];
  myInspections: QcRow[];
  failed: QcRow[];
  rework: QcRow[];
  completed: QcRow[];
}

const RECEIVED_INDEX = STATUS_CHAIN.indexOf('RECEIVED');

export function isInspectable(status: string | null | undefined): boolean {
  if (!status) return false;
  const i = (STATUS_CHAIN as readonly string[]).indexOf(status);
  return i >= 0 && i >= RECEIVED_INDEX;
}

export function buildQcQueue(
  items: QcItem[],
  inspections: QcInspection[],
  userId: string | null,
): QcQueue {
  const byItem = new Map<string, QcInspection[]>();
  for (const insp of inspections) {
    if (!insp.production_item_id) continue;
    const list = byItem.get(insp.production_item_id) ?? [];
    list.push(insp);
    byItem.set(insp.production_item_id, list);
  }
  for (const list of byItem.values()) {
    list.sort((a, b) => (b.conducted_at ?? '').localeCompare(a.conducted_at ?? ''));
  }

  const row = (item: QcItem, insp: QcInspection | null): QcRow => ({
    itemId: item.id,
    projectId: item.project_id,
    type: item.type,
    inspectionId: insp?.overall_result === 'pending' ? insp.id : null,
    latestInspectionId: insp?.id ?? null,
    result: insp ? insp.overall_result : null,
    conductedBy: insp?.conducted_by ?? null,
    conductedAt: insp?.conducted_at ?? null,
    isRework: !!insp?.rework_of_id,
  });

  const queue: QcQueue = { readyForQc: [], myInspections: [], failed: [], rework: [], completed: [] };

  for (const item of items) {
    const list = byItem.get(item.id) ?? [];
    const open = list.find(i => i.overall_result === 'pending') ?? null;
    const decided = list.filter(i => i.overall_result !== 'pending');
    const latest = decided[0] ?? null;

    if (isInspectable(item.status) && !open && latest?.overall_result !== 'pass') {
      if (!latest || latest.overall_result !== 'fail') queue.readyForQc.push(row(item, null));
    }

    if (open && userId && open.conducted_by === userId) queue.myInspections.push(row(item, open));

    if (latest?.overall_result === 'fail') {
      queue.failed.push(row(item, latest));
      if (!open) queue.rework.push(row(item, latest));
    }

    if (latest?.overall_result === 'pass') queue.completed.push(row(item, latest));
  }

  const sort = (a: QcRow, b: QcRow) =>
    (a.type ?? '').localeCompare(b.type ?? '') || a.itemId.localeCompare(b.itemId);
  for (const k of Object.keys(queue) as (keyof QcQueue)[]) queue[k].sort(sort);

  return queue;
}

export function qcCounts(q: QcQueue) {
  return {
    readyForQc: q.readyForQc.length,
    myInspections: q.myInspections.length,
    failed: q.failed.length,
    rework: q.rework.length,
    completed: q.completed.length,
  };
}
