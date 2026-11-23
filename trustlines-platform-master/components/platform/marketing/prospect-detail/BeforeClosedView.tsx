'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, ListTodo, Target } from 'lucide-react';
import { BoardTaskPanel } from '@/components/platform/dashboard/BoardTaskPanel';
import { POTENTIAL_STATUS_LABEL } from '@/components/platform/marketing/opportunity-quick-view/DealFieldCards';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { OPPORTUNITY_STAGE_LABEL } from '@/lib/marketing/classification';
import { OPPORTUNITY_STAGE_TAG, statusLabel } from '@/lib/status/tags';
import { isoDateToUS } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { DONE_POTENTIAL_STATUSES, NEED_CLASSIFICATION_LABEL, type Need, type OpportunityRow, type Potential } from './types';

// Contact pop-up → "Before Closed" step (Figma "Prospect detail", 1025:9318). Top: the selected
// need's T Lines / Trust Lines Tasks (the dashboard's task lists, anchored on its Opportunity or
// Potential — the same list its dashboard card shows). Below: the contact's needs on the left
// (title, source, stage chip) and the picked one's summary on the right.

interface Row { need: Need; opp: OpportunityRow | null; pot: Potential | null }

const newest = <T extends { created_at: string }>(a: T, b: T) => b.created_at.localeCompare(a.created_at);

/** Task-list anchor (lib/board/trustTasks): the Opportunity, else the open Potential. */
const anchorOf = (r: Row) => r.opp ? `opportunity-${r.opp.id}` : r.pot ? `potential-${r.pot.id}` : null;

function RowChip({ row }: { row: Row }) {
  if (row.opp) {
    return <StatusBadge size="lg" group="lead_stage" status={OPPORTUNITY_STAGE_TAG[row.opp.stage] ?? row.opp.stage} label={OPPORTUNITY_STAGE_LABEL[row.opp.stage] ?? statusLabel(row.opp.stage)} />;
  }
  if (row.pot) return <StatusBadge size="lg" group="lead_stage" status="new_lead" label={POTENTIAL_STATUS_LABEL[row.pot.status] ?? statusLabel(row.pot.status)} />;
  return <StatusBadge size="lg" group="lead_stage" status="new_lead" label={NEED_CLASSIFICATION_LABEL[row.need.classification] ?? 'Need'} />;
}

function budget(n: Need): string | null {
  if (n.budget_min == null && n.budget_max == null) return null;
  const fmt = (v: number) => v.toLocaleString('en-US');
  const range = n.budget_min != null && n.budget_max != null && n.budget_min !== n.budget_max
    ? `${fmt(n.budget_min)} – ${fmt(n.budget_max)}`
    : fmt((n.budget_min ?? n.budget_max)!);
  return n.currency ? `${range} ${n.currency}` : range;
}

export function BeforeClosedView({ needs, opportunities, potentials, assignees, canEdit, meId = null, onOpenNeed }: {
  needs: Need[];
  opportunities: OpportunityRow[];
  potentials: Potential[];
  assignees: { id: string; full_name: string }[];
  canEdit: boolean;
  meId?: string | null;
  /** Show this need in Client Info's Needs tab (full editing lives there). */
  onOpenNeed: (needId: string) => void;
}) {
  // One query's worth of data, grouped in memory: each need with its newest Opportunity / open Potential.
  const rows = useMemo<Row[]>(() => {
    const oppByNeed = new Map<string, OpportunityRow>();
    [...opportunities].sort(newest).forEach(o => { if (!oppByNeed.has(o.need_id)) oppByNeed.set(o.need_id, o); });
    const potByNeed = new Map<string, Potential>();
    [...potentials].filter(p => !DONE_POTENTIAL_STATUSES.has(p.status)).sort(newest)
      .forEach(p => { if (!potByNeed.has(p.need_id)) potByNeed.set(p.need_id, p); });
    return [...needs].sort(newest).map(need => ({ need, opp: oppByNeed.get(need.id) ?? null, pot: potByNeed.get(need.id) ?? null }));
  }, [needs, opportunities, potentials]);

  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = rows.find(r => r.need.id === pickedId) ?? rows.find(r => anchorOf(r)) ?? rows[0] ?? null;
  const anchor = picked ? anchorOf(picked) : null;
  const tasksApi = anchor ? `/api/tlines-dashboard/trust-tasks/${anchor}` : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Tasks (Figma 1025:9993): T Lines and Trust Lines side by side. */}
      {tasksApi ? (
        <div key={tasksApi} className="flex shrink-0 flex-col gap-2.5 xl:flex-row xl:items-start">
          <BoardTaskPanel title="T Lines Tasks" apiBasePath={tasksApi} query="?side=tlines" assignees={assignees} canEdit={canEdit} meId={meId} />
          <BoardTaskPanel title="Trust Lines Tasks" apiBasePath={tasksApi} query="?side=trust" assignees={assignees} canEdit={canEdit} meId={meId} />
        </div>
      ) : (
        <div className="shrink-0 rounded-[16px] border border-ui-divider bg-ui-surface-elevated px-4 py-3">
          <EmptyState size="sm" icon={<ListTodo />} title="No tasks yet."
            description={rows.length ? 'Tasks belong to a Potential or Opportunity — this need has neither yet.' : 'Add a Potential or Opportunity to start its task lists.'} />
        </div>
      )}

      <div className="flex min-h-[320px] flex-1 flex-col gap-4 md:flex-row">
        {/* Needs list (Figma 1025:10129): 262px rail of white cards on the surface colour. */}
        <div className="flex shrink-0 flex-col gap-2 overflow-y-auto rounded-[10px] bg-ui-surface p-2 md:w-[262px]" role="listbox" aria-label="Needs">
          {rows.length === 0 ? (
            <p className="m-0 px-3 py-4 text-[13px] text-ui-text-secondary">No needs on this contact yet.</p>
          ) : rows.map(r => {
            const on = picked?.need.id === r.need.id;
            return (
              <button
                key={r.need.id} type="button" role="option" aria-selected={on} onClick={() => setPickedId(r.need.id)}
                className={cn(
                  'flex w-full cursor-pointer flex-col items-start gap-2 rounded-[6px] border-2 border-solid bg-ui-page-bg px-5 py-3 text-left',
                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring',
                  on ? 'border-[var(--ui-btn-primary)]' : 'border-transparent hover:border-ui-divider',
                )}
              >
                <span className="flex w-full min-w-0 flex-col gap-[3px] leading-[1.4]">
                  <span className="truncate text-[13px] font-semibold text-ui-body">{r.need.title}</span>
                  <span className="truncate text-[11px] text-ui-text-secondary">{r.need.source || NEED_CLASSIFICATION_LABEL[r.need.classification]}</span>
                </span>
                <RowChip row={r} />
              </button>
            );
          })}
        </div>

        {/* Picked need (Figma 1025:10187): bordered card on the surface colour. */}
        <section aria-label="Need summary" className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-ui-surface p-5">
            {!picked ? (
              <EmptyState icon={<Target />} title="Nothing to show yet" description="Needs added to this contact appear here." className="m-auto" />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-2">
                    <h3 className="m-0 text-[20px] font-semibold leading-[1.35] text-[var(--color-secondary-700)] dark:text-ui-heading">{picked.need.title}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-ui-text-secondary">
                      <RowChip row={picked} />
                      <span>{picked.opp ? 'Opportunity' : picked.pot ? 'Potential' : 'Need'}</span>
                    </div>
                  </div>
                  <button
                    type="button" onClick={() => onOpenNeed(picked.need.id)}
                    className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[6px] border border-solid border-ui-divider bg-ui-surface-elevated px-4 text-[13px] font-semibold text-ui-body hover:border-ui-input-border"
                  >
                    Open in Client Info <ArrowRight size={14} aria-hidden />
                  </button>
                </div>
                <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
                  {([
                    ['Deadline', isoDateToUS(picked.opp?.deadline ?? picked.need.deadline)],
                    ['Contact by', isoDateToUS(picked.pot?.target_contact_date ?? picked.need.target_contact_date)],
                    ['Expected start', isoDateToUS(picked.need.expected_start_date)],
                    ['Budget', budget(picked.need)],
                    ['Project types', picked.need.project_types?.map(statusLabel).join(', ') || null],
                    ['Timing', picked.need.timing ? statusLabel(picked.need.timing) : null],
                  ] as [string, string | null][]).map(([label, value]) => (
                    <div key={label} className="flex min-w-0 flex-col gap-1">
                      <dt className="text-[12px] font-medium text-ui-text-secondary">{label}</dt>
                      <dd className="m-0 truncate text-[14px] text-ui-body">{value || '—'}</dd>
                    </div>
                  ))}
                </dl>
                {picked.need.description && (
                  <p className="m-0 whitespace-pre-wrap text-[13px] leading-[1.5] text-ui-body">{picked.need.description}</p>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
