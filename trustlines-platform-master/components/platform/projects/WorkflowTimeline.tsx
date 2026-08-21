import { STAGES_FULL } from '@/components/platform/shared/StageBadge';
import { PHASES } from '@/components/platform/shared/PhaseRail';
import { getStageIndex } from '@/lib/workflow/machine';
import type { ProjectStage, ProjectPhase } from '@/types/database';

const PHASE_COLORS: Record<ProjectPhase, { color: string; bg: string }> = {
  finalization:           { color: 'var(--phase-1)', bg: 'var(--phase-1-bg)' },
  construction_documents: { color: 'var(--phase-2)', bg: 'var(--phase-2-bg)' },
  production:             { color: 'var(--phase-5)', bg: 'var(--phase-5-bg)' },
  delivery:               { color: 'var(--phase-6)', bg: 'var(--phase-6-bg)' },
};

interface WorkflowTimelineProps {
  currentStage: ProjectStage;
}

export function WorkflowTimeline({ currentStage }: WorkflowTimelineProps) {
  const currentIdx = getStageIndex(currentStage);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-faint)', margin: '0 0 2px' }}>
            Workflow
          </p>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-default)', margin: 0 }}>
            Stage {currentIdx + 1} of {STAGES_FULL.length}
          </p>
        </div>
      </div>
      <div className="card-body" style={{ padding: '14px 16px' }}>
        {PHASES.map(phase => {
          const phaseStages = STAGES_FULL.filter(s => s.phase === phase.phase);
          const { color, bg } = PHASE_COLORS[phase.phase];

          return (
            <div key={phase.phase} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                    fontSize: 11, fontWeight: 700,
                    background: bg, color,
                  }}
                >
                  Phase {phase.number} · {phase.label}
                </span>
              </div>

              <div
                style={{
                  borderLeft: `2px solid ${color}`,
                  marginLeft: 8,
                  paddingLeft: 14,
                  opacity: phaseStages.every(s => getStageIndex(s.stage) < currentIdx) ? 0.7 : 1,
                }}
              >
                {phaseStages.map(stageInfo => {
                  const stageIdx = getStageIndex(stageInfo.stage);
                  const isDone    = stageIdx < currentIdx;
                  const isCurrent = stageIdx === currentIdx;
                  const isFuture  = stageIdx > currentIdx;

                  return (
                    <div
                      key={stageInfo.stage}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '5px 0',
                      }}
                    >
                      <div
                        style={{
                          width: 18, height: 18, borderRadius: '50%',
                          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 700,
                          background: isDone
                            ? 'var(--phase-done)'
                            : isCurrent
                            ? bg
                            : 'var(--bg-sunken)',
                          color: isDone
                            ? 'white'
                            : isCurrent
                            ? color
                            : 'var(--fg-faint)',
                          border: isCurrent ? `2px solid ${color}` : isDone ? 'none' : '1.5px solid var(--border-default)',
                          boxShadow: isCurrent ? `0 0 0 3px ${bg}` : 'none',
                        }}
                      >
                        {isDone ? '✓' : stageInfo.number}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: isCurrent ? 600 : 400,
                            color: isDone
                              ? 'var(--fg-subtle)'
                              : isCurrent
                              ? 'var(--fg-default)'
                              : 'var(--fg-faint)',
                          }}
                        >
                          {stageInfo.label}
                        </span>
                      </div>

                      {isCurrent && (
                        <span
                          style={{
                            fontSize: 10, fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 'var(--radius-pill)',
                            background: bg, color,
                            flexShrink: 0,
                          }}
                        >
                          Current
                        </span>
                      )}
                      {isDone && (
                        <span style={{ fontSize: 11, color: 'var(--fg-faint)', flexShrink: 0 }}>
                          ✓
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
