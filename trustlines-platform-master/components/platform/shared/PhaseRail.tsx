import type { ProjectPhase } from '@/types/database';

interface PhaseInfo {
  phase: ProjectPhase;
  label: string;
  number: 1 | 2 | 3 | 4;
  color: string;
  bg: string;
}

export const PHASES: PhaseInfo[] = [
  { phase: 'finalization',           label: 'Finalization',           number: 1, color: 'var(--phase-1)', bg: 'var(--phase-1-bg)' },
  { phase: 'construction_documents', label: 'Construction Documents', number: 2, color: 'var(--phase-2)', bg: 'var(--phase-2-bg)' },
  { phase: 'production',             label: 'Production',             number: 3, color: 'var(--phase-5)', bg: 'var(--phase-5-bg)' },
  { phase: 'delivery',               label: 'Delivery',               number: 4, color: 'var(--phase-6)', bg: 'var(--phase-6-bg)' },
];

const PHASE_ORDER: Record<ProjectPhase, number> = {
  finalization:           1,
  construction_documents: 2,
  production:             3,
  delivery:               4,
};

interface PhaseRailProps {
  currentPhase: ProjectPhase;
}

export function PhaseRail({ currentPhase }: PhaseRailProps) {
  const currentOrder = PHASE_ORDER[currentPhase] ?? 1;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
      {PHASES.map((p, i) => {
        const isPast    = p.number < currentOrder;
        const isCurrent = p.phase === currentPhase;

        const style: React.CSSProperties = {
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '3px 10px', borderRadius: 'var(--radius-pill)',
          fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
          transition: 'opacity 120ms',
        };

        if (isPast) {
          style.background = 'var(--phase-done-bg)';
          style.color      = 'var(--phase-done)';
        } else if (isCurrent) {
          style.background = p.bg;
          style.color      = p.color;
          style.boxShadow  = `0 0 0 1.5px ${p.color}`;
        } else {
          style.background = 'var(--bg-sunken)';
          style.color      = 'var(--fg-faint)';
          style.opacity    = 0.7;
        }

        return (
          <span key={p.phase} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={style}>
              {isPast && <span>✓</span>}
              {!isPast && (
                <span style={{
                  width: '14px', height: '14px', borderRadius: '50%',
                  background: isCurrent ? p.color : 'var(--border-default)',
                  color: isCurrent ? 'white' : 'var(--fg-faint)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '8px', fontWeight: 700,
                }}>
                  {p.number}
                </span>
              )}
              {p.label}
            </span>
            {i < PHASES.length - 1 && (
              <span style={{ color: 'var(--border-default)', fontSize: '10px' }}>›</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
