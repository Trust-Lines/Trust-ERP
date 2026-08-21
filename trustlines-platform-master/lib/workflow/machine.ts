import type { ProjectStage, ProjectPhase } from '@/types/database';

export const STAGE_ORDER: ProjectStage[] = [
  'closed_deal',
  'finalization',
  'client_approval',
  'production',
  'delivered',
];

export const STAGE_PHASE: Record<ProjectStage, ProjectPhase> = {
  closed_deal:    'finalization',
  finalization:   'finalization',
  client_approval:'construction_documents',
  production:     'production',
  delivered:      'delivery',
};

export const STAGE_LABELS: Record<ProjectStage, string> = {
  closed_deal:    'Finalization',
  finalization:   'Finalization',
  client_approval:'Construction Documents',
  production:     'Production',
  delivered:      'Delivery',
};

export function getStageIndex(stage: ProjectStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function getNextStage(stage: ProjectStage): ProjectStage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

export function isStageCompleted(stage: ProjectStage, currentStage: ProjectStage): boolean {
  return getStageIndex(stage) < getStageIndex(currentStage);
}

export function isStageCurrent(stage: ProjectStage, currentStage: ProjectStage): boolean {
  return stage === currentStage;
}

export interface GuardResult {
  allowed: boolean;
  reason?: string;
}

export function canAdvanceStage(
  currentStage: ProjectStage,
): GuardResult {
  const next = getNextStage(currentStage);
  if (!next) return { allowed: false, reason: 'Project is already at the final stage.' };
  return { allowed: true };
}
