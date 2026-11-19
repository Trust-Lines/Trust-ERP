'use client';

import { OpportunityQuickView } from '@/components/platform/marketing/OpportunityQuickView';
import { LeadQuickView } from '../LeadQuickView';
import type { Lead } from '../types';
import type { Assignee } from './boardConfig';

/** Opens the right drawer for the record's origin: Opportunity/Potential vs intake lead. */
export function RecordQuickView({ id, origin, assignees, marketingAssignees, onClose }: {
  id: string;
  origin: Lead['origin'] | undefined;
  assignees: Assignee[];
  marketingAssignees: Assignee[];
  onClose: () => void;
}) {
  if (origin === 'opportunity' || origin === 'potential') {
    return <OpportunityQuickView opportunityId={id} kind={origin} assignees={marketingAssignees} onClose={onClose} />;
  }
  return <LeadQuickView intakeId={id} assignees={assignees} onClose={onClose} />;
}
