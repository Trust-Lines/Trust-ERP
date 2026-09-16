// lib/marketing/teamGaps.ts — 2026-09-16
//
// buildMyDay() (lib/dashboard/myDay.ts) only ever shows work ASSIGNED TO the current user —
// correct for an individual contributor's personal queue, but wrong for a manager: a
// general_manager/marketing_manager doesn't personally own Potentials or Opportunities, so
// their "My Day" is always empty even when the team has real, unaddressed work sitting in
// the pipeline. Reported live: 109 Potentials existed while the manager's Marketing Home
// said "You're all caught up."
//
// This is the manager-facing counterpart: TEAM-WIDE gaps, not filtered by assignee —
// Potentials nobody has followed up on (unassigned, no next-contact date set, or overdue),
// and Opportunities/Potentials missing their region (the same "region unset" gap the
// campaign-submission incomplete-data notification already flags per-submission — this is
// the standing, always-current view of the same problem).

import type { MyDaySection } from '@/lib/dashboard/myDay';

/* eslint-disable @typescript-eslint/no-explicit-any */

const LIST_LIMIT = 8;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function buildPotentialsNeedingFollowUp(admin: any): Promise<MyDaySection> {
  const { data, error } = await admin.from('prospect_potentials')
    .select('id, prospect_id, title, target_contact_date, assigned_to')
    .is('deleted_at', null).not('status', 'in', '(converted,lost,cancelled)')
    .order('target_contact_date', { ascending: true, nullsFirst: true }).limit(500) as {
      data: { id: string; prospect_id: string; title: string | null; target_contact_date: string | null; assigned_to: string | null }[] | null;
      error: unknown;
    };
  if (error) return { key: 'team_potentials_gap', title: 'Potentials needing follow-up', items: [] };

  const today = todayIso();
  const gaps = (data ?? []).filter(p => !p.assigned_to || !p.target_contact_date || p.target_contact_date < today);

  return {
    key: 'team_potentials_gap',
    title: `Potentials needing follow-up (${gaps.length} of ${data?.length ?? 0})`,
    items: gaps.slice(0, LIST_LIMIT).map(p => {
      const reasons = [
        !p.assigned_to ? 'unassigned' : null,
        !p.target_contact_date ? 'no next-contact date' : (p.target_contact_date < today ? `overdue since ${p.target_contact_date}` : null),
      ].filter(Boolean).join(', ');
      return {
        label: p.title || 'Untitled potential',
        sublabel: reasons,
        href: `/marketing/prospects/${p.prospect_id}`,
        tone: (!p.assigned_to || (p.target_contact_date && p.target_contact_date < today)) ? 'danger' as const : 'warn' as const,
      };
    }),
  };
}

export async function buildMissingRegion(admin: any): Promise<MyDaySection> {
  const [oppRes, potRes] = await Promise.all([
    admin.from('opportunities')
      .select('id, prospect_id, title, stage')
      .is('deleted_at', null).is('region', null).not('stage', 'in', '(closed_won,closed_lost)')
      .order('updated_at', { ascending: false }).limit(200),
    admin.from('prospect_potentials')
      .select('id, prospect_id, title')
      .is('deleted_at', null).is('region', null).not('status', 'in', '(converted,lost,cancelled)')
      .order('updated_at', { ascending: false }).limit(200),
  ]);
  const opps = (oppRes.error ? [] : (oppRes.data ?? [])) as { id: string; prospect_id: string; title: string | null; stage: string }[];
  const pots = (potRes.error ? [] : (potRes.data ?? [])) as { id: string; prospect_id: string; title: string | null }[];
  const total = opps.length + pots.length;

  const items = [
    ...opps.map(o => ({
      label: o.title || 'Untitled opportunity', sublabel: `Opportunity — ${o.stage.replace(/_/g, ' ')}`,
      href: `/marketing/prospects/${o.prospect_id}`, tone: 'warn' as const,
    })),
    ...pots.map(p => ({
      label: p.title || 'Untitled potential', sublabel: 'Potential',
      href: `/marketing/prospects/${p.prospect_id}`, tone: 'warn' as const,
    })),
  ];

  return {
    key: 'team_missing_region',
    title: `Missing region (${total})`,
    items: items.slice(0, LIST_LIMIT),
  };
}

export async function buildTeamGaps(admin: any): Promise<MyDaySection[]> {
  const [followUp, missingRegion] = await Promise.all([
    buildPotentialsNeedingFollowUp(admin),
    buildMissingRegion(admin),
  ]);
  return [followUp, missingRegion].filter(s => s.items.length > 0);
}
