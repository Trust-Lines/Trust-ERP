import type { ProjectStage, ProjectPhase } from '@/types/database';
import { StatusBadge } from '@/components/ui/status-badge';
import { PROJECT_STAGE_TAG } from '@/lib/status/tags';

interface StageInfo {
  stage: ProjectStage;
  label: string;
  number: number;
  phase: ProjectPhase;
  phaseNumber: 1 | 2 | 3 | 4;
}

export const STAGES_FULL: StageInfo[] = [
  { stage: 'closed_deal',    label: 'Finalization',           number: 1, phase: 'finalization',           phaseNumber: 1 },
  { stage: 'finalization',   label: 'Finalization',           number: 1, phase: 'finalization',           phaseNumber: 1 },
  { stage: 'client_approval',label: 'Construction Documents', number: 2, phase: 'construction_documents', phaseNumber: 2 },
  { stage: 'production',     label: 'Production',             number: 3, phase: 'production',             phaseNumber: 3 },
  { stage: 'delivered',      label: 'Delivery',               number: 4, phase: 'delivery',               phaseNumber: 4 },
];

interface StageBadgeProps {
  stage: ProjectStage;
}

/** Project stage as a status tag (approved mapping in lib/status/tags.ts → PROJECT_STAGE_TAG). */
export function StageBadge({ stage }: StageBadgeProps) {
  const tag = PROJECT_STAGE_TAG[stage];
  if (!tag) return null;
  return <StatusBadge group="project_stage" status={tag} />;
}
