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
// Opportunities/Potentials missing their region (the same "region unset" gap the
// campaign-submission incomplete-data notification already flags per-submission — this is
// the standing, always-current view of the same problem), and trade fairs/events coming up
// soon. Every list shows EVERY matching row, not a top-N sample — per explicit request
// (2026-09-16): "10'luk değil, tüm eksikleri koysun" (not a top-10, put every gap there).
// The page is `force-dynamic` (see app/(platform)/marketing/page.tsx), so this is always a
// live, same-day-fresh count on every load — nothing here is a stored, dismissable list that
// could go stale; whatever isn't fixed by end of day is still exactly what shows tomorrow.

import type { MyDaySection } from '@/lib/dashboard/myDay';
import { enrichProspectRows, type ProspectListBase } from './prospectRows';

/* eslint-disable @typescript-eslint/no-explicit-any */

const QUERY_CAP = 5000; // a safety ceiling against a runaway query, not a display limit

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function buildPotentialsNeedingFollowUp(admin: any): Promise<MyDaySection> {
  const { data, error } = await admin.from('prospect_potentials')
    .select('id, prospect_id, title, target_contact_date, assigned_to')
    .is('deleted_at', null).not('status', 'in', '(converted,lost,cancelled)')
    .order('target_contact_date', { ascending: true, nullsFirst: true }).limit(QUERY_CAP) as {
      data: { id: string; prospect_id: string; title: string | null; target_contact_date: string | null; assigned_to: string | null }[] | null;
      error: unknown;
    };
  if (error) return { key: 'team_potentials_gap', title: 'Potentials needing follow-up', items: [] };

  const today = todayIso();
  const gaps = (data ?? []).filter(p => !p.assigned_to || !p.target_contact_date || p.target_contact_date < today);

  return {
    key: 'team_potentials_gap',
    title: `Potentials needing follow-up (${gaps.length})`,
    items: gaps.map(p => {
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
  const [oppRes, potRes, contactRes] = await Promise.all([
    admin.from('opportunities')
      .select('id, prospect_id, title, stage')
      .is('deleted_at', null).is('region', null).not('stage', 'in', '(closed_won,closed_lost)')
      .order('updated_at', { ascending: false }).limit(QUERY_CAP),
    admin.from('prospect_potentials')
      .select('id, prospect_id, title')
      .is('deleted_at', null).is('region', null).not('status', 'in', '(converted,lost,cancelled)')
      .order('updated_at', { ascending: false }).limit(QUERY_CAP),
    // Public survey submissions never collect an internal region code (nothing a stranger
    // filling out a public form could sensibly pick) — every submitted Contact lands with
    // `regions = '{}'` by design (111) and stays that way until marketing_pr assigns one.
    // Manual capture can no longer produce this gap (region is required there as of
    // 2026-09-17), so anything showing up here going forward is effectively "needs triage
    // from a survey submission."
    admin.from('prospects')
      .select('id, display_name, source_label')
      .is('deleted_at', null).eq('is_archived', false).eq('regions', '{}')
      .order('created_at', { ascending: false }).limit(QUERY_CAP),
  ]);
  const opps = (oppRes.error ? [] : (oppRes.data ?? [])) as { id: string; prospect_id: string; title: string | null; stage: string }[];
  const pots = (potRes.error ? [] : (potRes.data ?? [])) as { id: string; prospect_id: string; title: string | null }[];
  const contacts = (contactRes.error ? [] : (contactRes.data ?? [])) as { id: string; display_name: string | null; source_label: string | null }[];
  const total = opps.length + pots.length + contacts.length;

  const items = [
    ...contacts.map(c => ({
      label: c.display_name || 'Untitled contact', sublabel: `Contact — ${c.source_label ?? 'no source'}`,
      href: `/marketing/prospects/${c.id}`, tone: 'warn' as const,
    })),
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
    items,
  };
}

const EVENT_HORIZON_DAYS = 60;

export async function buildUpcomingEvents(admin: any): Promise<MyDaySection> {
  const today = todayIso();
  const horizon = addDaysIso(EVENT_HORIZON_DAYS);
  const { data, error } = await admin.from('marketing_campaigns')
    .select('id, name, campaign_type, city, state, start_date')
    .is('deleted_at', null).in('status', ['active', 'draft'])
    .gte('start_date', today).lte('start_date', horizon)
    .order('start_date', { ascending: true }).limit(QUERY_CAP) as {
      data: { id: string; name: string; campaign_type: string; city: string | null; state: string | null; start_date: string }[] | null;
      error: unknown;
    };
  if (error) return { key: 'team_upcoming_events', title: 'Upcoming trade fairs & events', items: [] };

  return {
    key: 'team_upcoming_events',
    title: `Upcoming trade fairs & events (${data?.length ?? 0})`,
    items: (data ?? []).map(c => {
      const daysUntil = Math.round((new Date(c.start_date).getTime() - new Date(today).getTime()) / 86400000);
      const place = [c.city, c.state].filter(Boolean).join(', ');
      return {
        label: c.name,
        sublabel: `${c.campaign_type === 'trade_fair' ? 'Trade fair' : 'Event'} · starts ${c.start_date}${place ? ` · ${place}` : ''}`,
        href: `/marketing/campaigns/${c.id}`,
        tone: daysUntil <= 7 ? 'danger' as const : daysUntil <= 21 ? 'warn' as const : 'default' as const,
      };
    }),
  };
}

const MISSING_INFO_COLS = 'id, display_name, owner_id, assigned_marketing_user_id, organization_name, person_name, '
  + 'main_email, main_phone, website, source_label, source_raw_label, source_detail, business_types, x_note, region';

// "The actual work" — direct instruction (2026-09-17): marketing_pr's task list should be
// GENERATED from real data gaps ("eksik kişi bilgileri doldurulmalı"), not just date-based
// reminders. Same completeness_percent computation as the Contacts page's own "missing info"
// filter (lib/marketing/prospectCompleteness.ts via enrichProspectRows) — team-wide, not
// scoped to who's "assigned" (that field turned out to be unreliable this session — see
// commits around the assignee-clearing fixes). Paginated with .range() rather than one big
// .limit() (PostgREST's 1000-row cap, this module's own recurring gotcha) and capped at a
// safety ceiling, not a top-N sample.
export async function buildContactsMissingInfo(admin: any): Promise<MyDaySection> {
  type Row = { id: string; display_name: string | null } & Record<string, unknown>;
  const rows: Row[] = [];
  let queryError: unknown = null;
  for (let offset = 0; offset < QUERY_CAP; offset += 1000) {
    const { data: page, error } = await admin.from('prospects').select(MISSING_INFO_COLS)
      .is('deleted_at', null).eq('is_archived', false)
      .or('external_ref.is.null,external_ref.not.like.opportunity-fallback:%')
      .order('created_at', { ascending: false })
      .range(offset, offset + 999) as { data: Row[] | null; error: unknown };
    if (error) { queryError = error; break; }
    rows.push(...(page ?? []));
    if (!page || page.length < 1000) break;
  }
  if (queryError) return { key: 'team_missing_info', title: 'Contacts with missing info', items: [] };

  const enriched = await enrichProspectRows(admin, rows as unknown as ProspectListBase[]);
  const missing = enriched
    .filter(p => p.completeness_percent < 100)
    .sort((a, b) => a.completeness_percent - b.completeness_percent);

  return {
    key: 'team_missing_info',
    title: `Contacts with missing info (${missing.length})`,
    items: missing.map(p => ({
      label: (p as unknown as Row).display_name || 'Untitled contact',
      sublabel: `${p.completeness_percent}% complete`,
      href: `/marketing/prospects/${p.id}`,
      tone: p.completeness_percent < 40 ? 'danger' as const : p.completeness_percent < 80 ? 'warn' as const : 'default' as const,
    })),
  };
}

// Work anniversaries — profiles.created_at is when the account was created (their real
// start date on the platform), not a $-value or anything marketing_pr shouldn't see. Flags
// anyone on the Marketing team whose join-date month/day is today, so someone actually sends
// them a note instead of it going unnoticed. Suggests the action — never sends anything
// itself, this is a task list, not an autosend.
export async function buildTeamAnniversaries(admin: any): Promise<MyDaySection> {
  const { data, error } = await admin.from('profiles')
    .select('id, full_name, created_at')
    .in('role', ['marketing_pr', 'marketing_manager'])
    .eq('is_active', true) as {
      data: { id: string; full_name: string | null; created_at: string }[] | null;
      error: unknown;
    };
  if (error) return { key: 'team_anniversaries', title: 'Team anniversaries', items: [] };

  const today = new Date();
  const items = (data ?? [])
    .map(p => {
      const joined = new Date(p.created_at);
      const years = today.getFullYear() - joined.getFullYear();
      return { p, joined, years };
    })
    .filter(({ joined, years }) => years > 0 && joined.getMonth() === today.getMonth() && joined.getDate() === today.getDate())
    .map(({ p, years }) => ({
      label: `${p.full_name ?? 'Someone'} — ${years} year${years === 1 ? '' : 's'} with the team today`,
      sublabel: 'Send them a note',
      href: '/team',
      tone: 'good' as const,
    }));

  return { key: 'team_anniversaries', title: `Team anniversaries (${items.length})`, items };
}

export async function buildTeamGaps(admin: any): Promise<MyDaySection[]> {
  const [followUp, missingRegion, missingInfo, events, anniversaries] = await Promise.all([
    buildPotentialsNeedingFollowUp(admin),
    buildMissingRegion(admin),
    buildContactsMissingInfo(admin),
    buildUpcomingEvents(admin),
    buildTeamAnniversaries(admin),
  ]);
  // Anniversaries/events first (the "nice to know" ones), then the real work: Potentials
  // nobody's followed up on, Contacts with missing info, Contacts missing a region.
  return [anniversaries, events, followUp, missingInfo, missingRegion].filter(s => s.items.length > 0);
}
