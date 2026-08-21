import type { ProjectStage, ProjectPhase } from '@/types/database';

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

const PHASE_COLORS: Record<number, { color: string; bg: string }> = {
  1: { color: 'var(--phase-1)', bg: 'var(--phase-1-bg)' },
  2: { color: 'var(--phase-2)', bg: 'var(--phase-2-bg)' },
  3: { color: 'var(--phase-5)', bg: 'var(--phase-5-bg)' },
  4: { color: 'var(--phase-6)', bg: 'var(--phase-6-bg)' },
};

interface StageBadgeProps {
  stage: ProjectStage;
}

export function StageBadge({ stage }: StageBadgeProps) {
  const info = STAGES_FULL.find(s => s.stage === stage);
  if (!info) return null;

  const { color, bg } = PHASE_COLORS[info.phaseNumber];

  return (
    <span className="stage" style={{ background: bg, color }}>
      <span className="n" style={{ background: color }}>
        {info.number}
      </span>
      {info.label}
    </span>
  );
}
