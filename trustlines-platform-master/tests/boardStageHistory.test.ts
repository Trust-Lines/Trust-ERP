import { describe, expect, it } from 'vitest';
import { wasInStage } from '@/lib/board/stageSpell';
import { isInstalling } from '@/lib/board/stageHistory';

describe('wasInStage', () => {
  const spells = [
    { stage: 'in_production', from: '2026-10-03', to: '2026-10-20' },
    { stage: 'shipped', from: '2026-10-21', to: '2026-11-19' },
  ];
  it('matches a step that overlaps the range', () => {
    expect(wasInStage(spells, 'in_production', '2026-10-15', '2026-10-31')).toBe(true);
    expect(wasInStage(spells, 'in_production', '2026-10-20', '2026-10-20')).toBe(true);
  });
  it('misses a step outside the range or another step', () => {
    expect(wasInStage(spells, 'in_production', '2026-10-21', '2026-11-30')).toBe(false);
    expect(wasInStage(spells, 'technical', '', '')).toBe(false);
    expect(wasInStage(undefined, 'shipped', '', '')).toBe(false);
  });
  it('treats an empty end as open', () => {
    expect(wasInStage(spells, 'shipped', '2026-11-01', '')).toBe(true);
    expect(wasInStage(spells, 'in_production', '', '2026-10-02')).toBe(false);
  });
});

describe('isInstalling', () => {
  const today = '2026-11-20';
  it('follows the plan status, else the planned start', () => {
    expect(isInstalling({ status: 'Delayed', planned_start: null }, today)).toBe(true);
    expect(isInstalling({ status: 'Planned', planned_start: '2026-11-20' }, today)).toBe(true);
    expect(isInstalling({ status: 'Planned', planned_start: '2026-12-01' }, today)).toBe(false);
    expect(isInstalling({ status: 'Completed', planned_start: '2026-11-01' }, today)).toBe(false);
  });
});
