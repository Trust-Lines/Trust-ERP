// GET /api/qc/queue — trustlines-platform-master/lib/qc/load.ts (same data as the web /qc page).
export type QcResult = 'pending' | 'pass' | 'fail';
export interface QcRow {
  itemId: string; projectId: string; type: string | null;
  inspectionId: string | null;        // the OPEN (pending) inspection, if any
  latestInspectionId: string | null;
  result: QcResult | null; conductedBy: string | null; conductedAt: string | null; isRework: boolean;
}
export type QcSection = 'readyForQc' | 'myInspections' | 'failed' | 'rework' | 'completed';
export interface QcQueueData {
  queue: Record<QcSection, QcRow[]>;
  names: Record<string, string>;
  projects: Record<string, { code: string; name: string }>;
  migrationReady: boolean;
  canInspect: boolean;
}

export const TYPE_TR: Record<string, string> = {
  millwork: 'Millwork', shelving: 'Shelving', ceiling: 'Ceiling', image: 'Image', furniture: 'Furniture', decoration: 'Decoration',
};
export const typeLabel = (t: string | null) => (t ? TYPE_TR[t] ?? t : 'Kalem');

/** Where an item stands for me: the section that decides which action the detail screen offers. */
export function findItem(d: QcQueueData, itemId: string): { row: QcRow; section: QcSection } | null {
  for (const section of ['myInspections', 'rework', 'failed', 'readyForQc', 'completed'] as QcSection[]) {
    const row = d.queue[section].find(r => r.itemId === itemId);
    if (row) return { row, section };
  }
  return null;
}
