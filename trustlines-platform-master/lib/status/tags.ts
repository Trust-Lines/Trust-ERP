import {
  Award, BadgeCheck, BadgeX, Binoculars, Calendar, CalendarClock, CircleCheck, CircleDashed, CircleOff, CircleX,
  ClipboardCheck, ClockAlert, Factory, Hammer, HandHelping, Hourglass, Map, MessagesSquare, NotepadText, Paintbrush,
  Pause, PhoneForwarded, RotateCcw, ScanSearch, Send, ShieldCheck, SquarePen, SquarePlus, UserRoundSearch,
  type LucideIcon,
} from 'lucide-react';

// Status tag colours (approved list, 2026-10-16) — one hue per status, rendered as a soft tint
// (.status-tag in app/globals.css) by <StatusBadge>. Rule: no status ships without a row here.

export type TagHue =
  | 'slate' | 'steel' | 'blue' | 'indigo' | 'purple' | 'violet' | 'teal'
  | 'jade' | 'ochre' | 'amber' | 'copper' | 'green' | 'red';

/** Same values as --color-tag-* in app/globals.css — for code that needs raw hex (e.g. contrast maths). */
export const TAG_HEX: Record<TagHue, string> = {
  slate: '#8290A4', steel: '#678FAF', blue: '#2A6FBE', indigo: '#5260AE', purple: '#8064BA',
  violet: '#8968A8', teal: '#168E90', jade: '#3A9180', ochre: '#C48A28', amber: '#F4A717',
  copper: '#C46A43', green: '#38A648', red: '#D52D31',
};

export interface StatusTag {
  key: string;
  label: string;
  hue: TagHue;
  icon: LucideIcon;
}

export const STATUS_TAGS = {
  project_stage: {
    title: 'Project Stages',
    tags: [
      { key: 'planning',        label: 'Planning',        hue: 'slate',  icon: Map },
      { key: 'design',          label: 'Design',          hue: 'purple', icon: Paintbrush },
      { key: 'approval',        label: 'Approval',        hue: 'ochre',  icon: CircleDashed },
      { key: 'production',      label: 'Production',      hue: 'blue',   icon: Factory },
      { key: 'quality_control', label: 'Quality Control', hue: 'teal',   icon: ShieldCheck },
      { key: 'installation',    label: 'Installation',    hue: 'copper', icon: Hammer },
      { key: 'completed',       label: 'Completed',       hue: 'green',  icon: ClipboardCheck },
    ],
  },
  lead_stage: {
    title: '12 Lead stages',
    tags: [
      { key: 'new_lead',             label: 'New Lead',                hue: 'slate',  icon: SquarePlus },
      { key: 'contact_attempted',    label: 'Contact Attempted',       hue: 'steel',  icon: UserRoundSearch },
      { key: 'contacted',            label: 'Contacted',               hue: 'blue',   icon: PhoneForwarded },
      { key: 'qualification',        label: 'Qualification',           hue: 'indigo', icon: NotepadText },
      { key: 'qualified',            label: 'Qualified',               hue: 'purple', icon: Award },
      { key: 'discovery',            label: 'Discovery / Site Survey', hue: 'violet', icon: Binoculars },
      { key: 'proposal_preparation', label: 'Proposal Preparation',    hue: 'teal',   icon: HandHelping },
      { key: 'proposal_sent',        label: 'Proposal Sent',           hue: 'jade',   icon: Send },
      { key: 'negotiation',          label: 'Negotiation',             hue: 'ochre',  icon: MessagesSquare },
      { key: 'decision_pending',     label: 'Decision Pending',        hue: 'copper', icon: Hourglass },
      { key: 'won',                  label: 'Won',                     hue: 'green',  icon: BadgeCheck },
      { key: 'lost',                 label: 'Lost',                    hue: 'red',    icon: BadgeX },
    ],
  },
  approval: {
    title: 'Approval Status',
    tags: [
      { key: 'not_submitted',     label: 'Not Submitted',     hue: 'slate', icon: CircleOff },
      { key: 'pending_review',    label: 'Pending Review',    hue: 'blue',  icon: Hourglass },
      { key: 'changes_requested', label: 'Changes Requested', hue: 'amber', icon: SquarePen },
      { key: 'approved',          label: 'Approved',          hue: 'green', icon: CircleCheck },
      { key: 'rejected',          label: 'Rejected',          hue: 'red',   icon: CircleX },
    ],
  },
  production: {
    title: 'Production Status',
    tags: [
      { key: 'not_started',   label: 'Not Started',   hue: 'slate',  icon: CircleOff },
      { key: 'scheduled',     label: 'Scheduled',     hue: 'steel',  icon: Calendar },
      { key: 'in_production', label: 'In Production', hue: 'blue',   icon: Factory },
      { key: 'on_hold',       label: 'On Hold',       hue: 'amber',  icon: Pause },
      { key: 'delayed',       label: 'Delayed',       hue: 'copper', icon: ClockAlert },
      { key: 'completed',     label: 'Completed',     hue: 'green',  icon: CircleCheck },
    ],
  },
  quality_control: {
    title: 'Quality Control',
    tags: [
      { key: 'not_inspected',        label: 'Not Inspected',        hue: 'slate', icon: CircleOff },
      { key: 'inspection_scheduled', label: 'Inspection Scheduled', hue: 'steel', icon: CalendarClock },
      { key: 'under_inspection',     label: 'Under Inspection',     hue: 'blue',  icon: ScanSearch },
      { key: 'rework_required',      label: 'Rework Required',      hue: 'amber', icon: RotateCcw },
      { key: 'failed',               label: 'Failed',               hue: 'red',   icon: CircleX },
      { key: 'passed',               label: 'Passed',               hue: 'green', icon: CircleCheck },
    ],
  },
} as const satisfies Record<string, { title: string; tags: readonly StatusTag[] }>;

export type StatusGroup = keyof typeof STATUS_TAGS;

// ── Stored app values → tag keys (approved 2026-10-16) ───────────────────────────────────
// The app stores its own status values; these maps say which tag each one shows as.

/** projects.current_stage (types/database.ts ProjectStage) → project_stage tag. */
export const PROJECT_STAGE_TAG: Record<string, string> = {
  closed_deal: 'planning',
  finalization: 'planning',
  client_approval: 'approval',
  production: 'production',
  delivered: 'installation',
};

/** documents.status (DocStatus) → approval tag. */
export const DOC_STATUS_TAG: Record<string, string> = {
  draft: 'not_submitted',
  pending_approval: 'pending_review',
  revised: 'changes_requested',
  rejected: 'rejected',
  approved: 'approved',
  signed: 'approved',
};

/** /qc queue bucket (lib/qc/queue.ts) → quality_control tag. */
export const QC_BUCKET_TAG: Record<string, string> = {
  readyForQc: 'not_inspected',
  myInspections: 'under_inspection',
  rework: 'rework_required',
  failed: 'failed',
  completed: 'passed',
};

/** lead_intake.opportunity_status (CRM / ClickUp stages) → lead_stage tag. CRM keeps its own labels. */
export const OPPORTUNITY_STATUS_TAG: Record<string, string> = {
  potential: 'new_lead',
  in_target_list: 'contact_attempted',
  new_opportunity: 'qualified',
  ready_to_start: 'discovery',
  working_on_it_trust: 'proposal_preparation',
  design_proposal_sent: 'proposal_sent',
  modification_request: 'negotiation',
  contract_stage: 'negotiation',
  waiting_from_op: 'decision_pending',
  waiting: 'decision_pending',
  deal_closed: 'won',
  deal_missed: 'lost',
};

/** Hue of the lead tag a CRM opportunity_status maps to (slate when unmapped). */
export function opportunityTagHue(status: string): TagHue {
  const key = OPPORTUNITY_STATUS_TAG[status];
  return (STATUS_TAGS.lead_stage.tags as readonly StatusTag[]).find(t => t.key === key)?.hue ?? 'slate';
}

/** Look up a status by key (or by label, case-insensitive) within its group. */
export function findStatusTag(group: StatusGroup, status: string): StatusTag | undefined {
  const s = status.trim().toLowerCase();
  return (STATUS_TAGS[group].tags as readonly StatusTag[]).find(t => t.key === s || t.label.toLowerCase() === s);
}
