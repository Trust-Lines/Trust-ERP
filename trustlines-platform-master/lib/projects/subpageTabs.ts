import type { ProjectSubpage } from '@/components/platform/projects/ProjectSubpageHeader';
import { PROJECT_FINANCE_READ_ROLES } from '@/lib/finance/projectTotals';
import { DELIVERY_READ_ROLES } from '@/lib/delivery/config';
import { FINALIZATION_READ_ROLES } from '@/lib/finalization/config';
import { HANDOVER_READ_ROLES } from '@/lib/handover/checklist';

/**
 * Project tabs this role can't open, so <ProjectSubpageHeader hidden> doesn't show dead links.
 * UI only — each subpage enforces the same role lists server-side.
 */
export function hiddenProjectTabs(role: string | null | undefined): ProjectSubpage[] {
  const r = role ?? '';
  const hidden: ProjectSubpage[] = [];
  if (!(PROJECT_FINANCE_READ_ROLES as readonly string[]).includes(r)) hidden.push('finance');
  if (!(DELIVERY_READ_ROLES as readonly string[]).includes(r)) hidden.push('delivery');
  if (!(FINALIZATION_READ_ROLES as readonly string[]).includes(r)) hidden.push('finalization');
  if (!(HANDOVER_READ_ROLES as readonly string[]).includes(r)) hidden.push('handover');
  return hidden;
}
