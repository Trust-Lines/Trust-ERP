'use client';

import { useState } from 'react';
import {
  PHASE1_STEPS, PHASE2_STEPS, CATEGORY_STEPS, DELIVERY_STEPS,
  CAT_GROUP_LABELS, CAT_GROUP_COLORS, getActiveCategoryGroups,
  findStep,
} from '@/lib/workflow/steps';
import type { StepRecord, StepDef, CategoryGroup } from '@/lib/workflow/steps';

interface ProjectSnap {
  categories: string[];
  has_millwork_shelving: boolean;
  has_ceiling_image: boolean;
}

interface Props {
  project: ProjectSnap;
  steps: StepRecord[];
  userRole: string;
}

type DotState = 'done' | 'current' | 'upcoming';

interface StepDisplay {
  def: StepDef;
  phase: string;
  catGroup: string | null;
  record: StepRecord | undefined;
  state: DotState;
}

function buildStepList(steps: StepRecord[], activeCatGroups: CategoryGroup[]): StepDisplay[] {
  const all: Omit<StepDisplay, 'state' | 'record'>[] = [
    ...PHASE1_STEPS.map(def => ({ def, phase: 'phase1', catGroup: null })),
    ...PHASE2_STEPS.map(def => ({ def, phase: 'phase2', catGroup: null })),
    ...activeCatGroups.flatMap(cat =>
      CATEGORY_STEPS.map(def => ({ def, phase: 'phase3', catGroup: cat })),
    ),
    ...DELIVERY_STEPS.map(def => ({ def, phase: 'delivery', catGroup: null })),
  ];

  let foundCurrent = false;
  return all.map(item => {
    const record = findStep(steps, item.phase, item.def.key, item.catGroup);
    const isDone  = record?.status === 'done' || record?.status === 'approved';

    let state: DotState;
    if (isDone) {
      state = 'done';
    } else if (!foundCurrent) {
      foundCurrent = true;
      state = 'current';
    } else {
      state = 'upcoming';
    }
    return { ...item, record, state };
  });
}

function Dot({ state }: { state: DotState }) {
  if (state === 'done') {
    return (
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: '#16A34A', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700,
      }}>✓</div>
    );
  }
  if (state === 'current') {
    return <div className="stage-dot stage-dot-current" style={{ flexShrink: 0 }} />;
  }
  return (
    <div style={{
      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
      background: 'var(--bg-sunken)', border: '1.5px solid var(--border-default)',
    }} />
  );
}

function Connector({ done }: { done: boolean }) {
  return (
    <div style={{
      width: 1, height: 10, marginLeft: 19,
      background: done ? '#16A34A' : 'var(--border-subtle)',
    }} />
  );
}

function StepRow({ step }: { step: StepDisplay }) {
  const { def, record, state } = step;
  const isDone    = state === 'done';
  const isCurrent = state === 'current';

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '5px 0 5px 8px' }}>
      <Dot state={state} />
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 13, fontWeight: isCurrent ? 600 : 500,
          color: isDone ? 'var(--fg-subtle)' : 'var(--fg-default)',
          lineHeight: 1.35,
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          {def.label}
          {def.isOptional && (
            <span style={{ fontSize: 10, color: 'var(--fg-faint)' }}>(optional)</span>
          )}
          {def.requiresVersionSelect && record?.version_approved != null && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: '#E2EBFC', color: '#1740B0',
              padding: '1px 5px', borderRadius: 3,
            }}>v{record.version_approved}</span>
          )}
        </div>
        {isDone && record?.completed_at && (
          <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 1 }}>
            {new Date(record.completed_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        )}
        {isCurrent && (
          <div style={{ fontSize: 11, color: 'var(--brand-teal)', marginTop: 1 }}>In progress</div>
        )}
      </div>
    </div>
  );
}

function PhaseHeader({
  label, number, color, bg, collapsed, onToggle,
}: {
  label: string; number: number; color: string; bg: string;
  collapsed: boolean; onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', userSelect: 'none' }}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 999,
        fontSize: 11, fontWeight: 700, background: bg, color,
      }}>
        <span style={{
          width: 14, height: 14, borderRadius: '50%',
          background: color, color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, fontWeight: 700,
        }}>{number}</span>
        {label}
      </span>
      <span style={{
        fontSize: 10, color: 'var(--fg-subtle)', display: 'inline-block',
        transition: 'transform 160ms',
        transform: collapsed ? 'rotate(-90deg)' : 'none',
      }}>▾</span>
    </div>
  );
}

function CatSubGroup({
  cat, catSteps, collapsed, onToggle,
}: {
  cat: CategoryGroup;
  catSteps: StepDisplay[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const colors = CAT_GROUP_COLORS[cat];
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 0 3px 8px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.07em', color: colors.color,
          borderLeft: `3px solid ${colors.border}`, paddingLeft: 6,
        }}>
          {CAT_GROUP_LABELS[cat]}
        </span>
        <span style={{
          fontSize: 10, color: 'var(--fg-faint)', display: 'inline-block',
          transition: 'transform 160ms',
          transform: collapsed ? 'rotate(-90deg)' : 'none',
        }}>▾</span>
      </div>

      {!collapsed && (
        <div style={{
          borderLeft: `2px solid ${colors.border}`,
          marginLeft: 20, paddingLeft: 12, marginTop: 4,
        }}>
          {catSteps.map((step, idx) => (
            <div key={step.def.key}>
              {idx > 0 && <Connector done={catSteps[idx - 1].state === 'done'} />}
              <StepRow step={step} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectTimeline({ project, steps }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setCollapsed(c => ({ ...c, [key]: !c[key] }));

  const activeCatGroups = getActiveCategoryGroups(project.categories as never);
  const allSteps        = buildStepList(steps, activeCatGroups);

  const phase1Steps   = allSteps.filter(s => s.phase === 'phase1');
  const phase2Steps   = allSteps.filter(s => s.phase === 'phase2');
  const deliverySteps = allSteps.filter(s => s.phase === 'delivery');

  const renderRows = (list: StepDisplay[]) =>
    list.map((step, idx) => (
      <div key={`${step.phase}-${step.def.key}-${step.catGroup ?? ''}`}>
        {idx > 0 && <Connector done={list[idx - 1].state === 'done'} />}
        <StepRow step={step} />
      </div>
    ));

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="text-eyebrow">3 phases</div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Workflow</h3>
        </div>
      </div>
      <div className="card-body">

        <div style={{ marginBottom: 18 }}>
          <PhaseHeader label="Finalization" number={1}
            color="#475569" bg="#E5E9EE"
            collapsed={!!collapsed.p1} onToggle={() => toggle('p1')}
          />
          {!collapsed.p1 && <div style={{ paddingLeft: 4 }}>{renderRows(phase1Steps)}</div>}
        </div>

        <div style={{ marginBottom: 18 }}>
          <PhaseHeader label="Construction Documents" number={2}
            color="#2563EB" bg="#E2EBFC"
            collapsed={!!collapsed.p2} onToggle={() => toggle('p2')}
          />
          {!collapsed.p2 && <div style={{ paddingLeft: 4 }}>{renderRows(phase2Steps)}</div>}
        </div>

        <div>
          <PhaseHeader label="Production & Delivery" number={3}
            color="#7C3AED" bg="#ECE2FC"
            collapsed={!!collapsed.p3} onToggle={() => toggle('p3')}
          />

          {!collapsed.p3 && (
            <div style={{ paddingLeft: 4 }}>
              {activeCatGroups.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--fg-faint)', padding: '8px 8px' }}>
                  No production categories assigned
                </div>
              ) : (
                activeCatGroups.map(cat => (
                  <CatSubGroup
                    key={cat}
                    cat={cat}
                    catSteps={allSteps.filter(s => s.phase === 'phase3' && s.catGroup === cat)}
                    collapsed={!!collapsed[`cat-${cat}`]}
                    onToggle={() => toggle(`cat-${cat}`)}
                  />
                ))
              )}

              <div style={{ marginTop: 8 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.07em', color: '#C7572B',
                  borderLeft: '3px solid #f0b9a0', paddingLeft: 6,
                  marginLeft: 8, marginBottom: 6,
                }}>
                  Delivery
                </div>
                <div style={{ borderLeft: '2px solid #f0b9a0', marginLeft: 20, paddingLeft: 12 }}>
                  {renderRows(deliverySteps)}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
