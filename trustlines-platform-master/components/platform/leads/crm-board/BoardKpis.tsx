'use client';

import { BriefcaseBusiness, CircleCheck, Send } from 'lucide-react';
import { StatCard } from '@/components/platform/shared/StatCard';
import type { OpportunityStatus } from '../types';

const newChip = (n: number) => (n > 0 ? `+${n} New` : undefined);

/** All / Proposal Sent / Deals Closed. The last two filter the board by stage when clicked. */
export function BoardKpis({ total, proposalSent, dealsClosed, newCounts, selectedStage, onToggleStage }: {
  total: number;
  proposalSent: number;
  dealsClosed: number;
  newCounts: { all: number; proposal: number; closed: number };
  selectedStage: OpportunityStatus | null;
  onToggleStage: (stage: OpportunityStatus) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard icon={BriefcaseBusiness} label="All Records" value={total} chip={newChip(newCounts.all)} />
      <StatCard icon={Send} label="Proposal Sent" value={proposalSent} chip={newChip(newCounts.proposal)}
        active={selectedStage === 'design_proposal_sent'} onClick={() => onToggleStage('design_proposal_sent')} />
      <StatCard icon={CircleCheck} label="Deals Closed" value={dealsClosed} chip={newChip(newCounts.closed)}
        active={selectedStage === 'deal_closed'} onClick={() => onToggleStage('deal_closed')} />
    </div>
  );
}
