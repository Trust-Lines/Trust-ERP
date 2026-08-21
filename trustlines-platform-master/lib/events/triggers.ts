
import { emitEvent } from './index';
import { allItemsSent } from '@/lib/production/board';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function maybeEmitItemsReady(
  admin: any, projectId: string, actorId: string | null,
): Promise<boolean> {
  try {
    const { data: items, error } = await admin.from('production_items')
      .select('status')
      .eq('project_id', projectId)
      .eq('source', 'project')
      .is('deleted_at', null) as { data: { status: string }[] | null; error: { message: string } | null };

    if (error) { console.error('[A5] item check failed:', error.message); return false; }
    if (!allItemsSent(items ?? [])) return false;

    await emitEvent(admin, {
      type: 'project.items_ready',
      entityTable: 'projects',
      entityId: projectId,
      projectId,
      actorId,
      payload: { itemCount: (items ?? []).length },
    });
    return true;
  } catch (e) {
    console.error('[A5] emit skipped:', e instanceof Error ? e.message : e);
    return false;
  }
}
