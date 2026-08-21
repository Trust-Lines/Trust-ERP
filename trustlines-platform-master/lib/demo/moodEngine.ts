
import type { DashboardKpi } from './mockDashboardData';

export type Mood = 'idle' | 'working' | 'celebrating' | 'worried' | 'thinking' | 'champion';

export interface MoodInput {
  kpi: DashboardKpi;
  justSignedDeal?: boolean;
}

export function computeMood({ kpi, justSignedDeal }: MoodInput): Mood {
  if (justSignedDeal) return 'celebrating';

  if (kpi.conversion_rate >= 0.25 && kpi.signed_won_count >= 5) return 'champion';

  if (kpi.total_opportunity_value > 0 &&
      kpi.closed_value < 0.30 * kpi.total_opportunity_value &&
      kpi.signed_won_count <= 3) return 'worried';

  if (kpi.stagnant_count >= 5 || kpi.inactive_60d_count >= 3) return 'thinking';

  if (kpi.new_this_week === 0 && kpi.awaiting_followup <= 2) return 'idle';

  if (kpi.new_this_week > 0) return 'working';

  return 'idle';
}

export const MOOD_LABEL: Record<Mood, string> = {
  idle:        'Idle',
  working:     'Working',
  celebrating: 'Celebrating',
  worried:     'Worried',
  thinking:    'Thinking',
  champion:    'Champion',
};

export const MOOD_CAPTION: Record<Mood, string> = {
  idle:        'All quiet — waiting for the next move.',
  working:     'New opportunities coming in!',
  celebrating: 'Deal signed — nice work! 🎉',
  worried:     'Revenue is behind target.',
  thinking:    'Too many opportunities are stalling.',
  champion:    'Targets smashed — champion mode!',
};
