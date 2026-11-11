'use client';

import { ChevronRight, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HEADING, PANEL } from '@/components/platform/shared/panelStyles';
import { TaskList } from '@/components/platform/shared/TaskList';
import { ActivityFeed } from '@/components/platform/shared/ActivityFeed';
import { OPPORTUNITY_STAGE_LABEL } from '@/lib/marketing/classification';
import { StatusBadge } from '@/components/ui/status-badge';
import { OPPORTUNITY_STAGE_TAG } from '@/lib/status/tags';
import type { OpportunityRow } from './types';
import { EmptyState } from '@/components/ui/empty-state';

export function OpportunitiesTab({
  opportunities, canEdit, assignees, expandedOppId, setExpandedOppId, handingOffId, onHandOff,
}: {
  opportunities: OpportunityRow[];
  canEdit?: boolean;
  assignees: { id: string; full_name: string }[];
  expandedOppId: string | null;
  setExpandedOppId: (id: string | null) => void;
  handingOffId: string | null;
  onHandOff: (oppId: string, title: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 font-[family-name:var(--font-ui)]">
      <p className="m-0 text-[12px] leading-[1.4] text-ui-text-secondary">
        System-created for a Need with an active, ticketed signal — never chosen manually. This Lead can have
        more than one, if it has more than one distinct project need.
      </p>
      {opportunities.length === 0 ? (
        <div className={PANEL}><EmptyState size="sm" className="justify-center px-4 py-8" icon={<Target />} title="No opportunities yet." /></div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {opportunities.map(o => {
            const expanded = expandedOppId === o.id;
            const panelId = `opp-${o.id}`;
            return (
              <li key={o.id} className={PANEL}>
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  {/* The title row toggles the subtasks + comments; the hand-off button sits beside it, not inside. */}
                  <button
                    type="button" aria-expanded={expanded} aria-controls={panelId}
                    onClick={() => setExpandedOppId(expanded ? null : o.id)}
                    className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded-[4px] border-0 bg-transparent p-0 text-left outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring"
                  >
                    <ChevronRight className={cn('mt-0.5 size-4 shrink-0 text-ui-text-secondary transition-transform', expanded && 'rotate-90')} aria-hidden />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className={cn('truncate text-[14px] font-semibold leading-[1.4]', HEADING)}>{o.title}</span>
                        <StatusBadge group="lead_stage" status={OPPORTUNITY_STAGE_TAG[o.stage] ?? o.stage} label={OPPORTUNITY_STAGE_LABEL[o.stage]}
                          // Figma status chip (12px, 3px/8–10px padding) — same as the Sales Opportunities page.
                          className="h-auto gap-1 py-[3px] pl-2 pr-2.5 text-[12px] leading-4 [&_svg]:size-3.5" />
                      </span>
                      <span className="text-[12px] text-ui-text-secondary">{o.deadline ? `Deadline: ${o.deadline}` : 'No deadline set'}</span>
                    </span>
                  </button>
                  {/* /marketing/opportunities is Potentials-only now — this Opportunity has
                      nowhere else to "open" to, Sales's /leads board is where it actually
                      lives once handed off. */}
                  {canEdit && ['new', 'marketing_qualification'].includes(o.stage) && (
                    <Button size="md" className="h-9 shrink-0" onClick={() => onHandOff(o.id, o.title)} disabled={handingOffId === o.id}>
                      {handingOffId === o.id ? 'Sending…' : 'Hand off to Sales'}
                    </Button>
                  )}
                </div>
                {expanded && (
                  <div id={panelId} className="grid grid-cols-1 gap-3 border-t border-ui-divider p-4 xl:grid-cols-2">
                    <TaskList apiBasePath={`/api/marketing/opportunities/${o.id}`} assignees={assignees} />
                    <ActivityFeed apiBasePath={`/api/marketing/opportunities/${o.id}`} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
