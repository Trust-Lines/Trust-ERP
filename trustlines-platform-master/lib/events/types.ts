
export type SystemEventType =
  | 'lead.closed_won'
  | 'handover.ready'
  | 'site.ready'
  | 'po.chain_complete'
  | 'project.items_ready'
  | 'container.arrived'
  | 'change_request.approved'
  | 'review.decision'
  | 'approval.reminder'
  | 'design.version_submitted'
  | 'design.revision_requested';

export interface SystemEvent {
  id:           string;
  event_type:   SystemEventType | string;
  project_id:   string | null;
  lead_id:      string | null;
  entity_table: string;
  entity_id:    string | null;
  actor_id:     string | null;
  payload:      Record<string, unknown>;
  dedupe_key:   string;
  created_at:   string;
  processed_at: string | null;
}
