import {
  Award, BadgeCheck, BadgeX, Binoculars, Calendar, CalendarCheck, CalendarClock, CheckCheck, CircleCheck, CircleDashed,
  CircleOff, CircleX, ClockAlert, Container, DraftingCompass, Eye, Factory, GitPullRequest, Hammer, HandHelping,
  Hourglass, Landmark, Lock, Map, MessagesSquare, NotepadText, PackageCheck, Pause, PhoneForwarded, RotateCcw,
  ScanSearch, Send, ShieldCheck, Ship, SquarePen, SquarePlus, Undo2, UserRoundSearch, Wrench,
  type LucideIcon,
} from 'lucide-react';

// Status language (Figma "Status Colors" T0–T10 + status table, received 2026-10-16).
// Each status = one tone + one Lucide icon + one label. Tone colours live in app/globals.css
// (--status-t0-bg / --status-t0-fg … t10, light + dark); <StatusBadge> renders them.
// Rule: no status ships without a row here.
// Icons not in the installed lucide-react: circle-dashed-check → CircleDashed, square-dashed-plus → SquarePlus.

export type StatusTone = 't0' | 't1' | 't2' | 't3' | 't4' | 't5' | 't6' | 't7' | 't8' | 't9' | 't10';

/** Light-mode background / text hex per tone — for code that needs raw hex (contrast maths in ColorSelect). Same values as globals.css. */
export const TONE_HEX: Record<StatusTone, { bg: string; fg: string }> = {
  t0: { bg: '#DDDDDD', fg: '#787881' },
  t1: { bg: '#D2F7FF', fg: '#2398B2' },
  t2: { bg: '#D2E6FF', fg: '#2366B2' },
  t3: { bg: '#FDDBFF', fg: '#B93FBF' },
  t4: { bg: '#EEDDFF', fg: '#74489D' },
  t5: { bg: '#D0FBFB', fg: '#206470' },
  t6: { bg: '#E7F6F3', fg: '#3A9166' },
  t7: { bg: '#FFF2D8', fg: '#805000' },
  t8: { bg: '#FFE3D7', fg: '#B34819' },
  t9: { bg: '#E4F5E7', fg: '#216B2E' },
  t10: { bg: '#FBE7E7', fg: '#922025' },
};

export interface StatusTag {
  key: string;
  label: string;
  tone: StatusTone;
  icon: LucideIcon;
}

export const STATUS_TAGS = {
  project_stage: {
    title: 'Project Stages',
    tags: [
      { key: 'planning',        label: 'Planning',        tone: 't0', icon: Map },
      { key: 'design',          label: 'Design',          tone: 't4', icon: DraftingCompass },
      { key: 'approval',        label: 'Approval',        tone: 't7', icon: CircleDashed },
      { key: 'production',      label: 'Production',      tone: 't2', icon: Factory },
      { key: 'quality_control', label: 'Quality Control', tone: 't5', icon: ShieldCheck },
      { key: 'installation',    label: 'Installation',    tone: 't8', icon: Hammer },
      { key: 'completed',       label: 'Completed',       tone: 't9', icon: CircleCheck },
    ],
  },
  lead_stage: {
    title: '12 Lead Stages',
    tags: [
      { key: 'new_lead',             label: 'New Lead',                tone: 't0',  icon: SquarePlus },
      { key: 'contact_attempted',    label: 'Contact Attempted',       tone: 't0',  icon: UserRoundSearch },
      { key: 'contacted',            label: 'Contacted',               tone: 't1',  icon: PhoneForwarded },
      { key: 'qualification',        label: 'Qualification',           tone: 't2',  icon: NotepadText },
      { key: 'qualified',            label: 'Qualified',               tone: 't3',  icon: Award },
      { key: 'discovery',            label: 'Discovery / Site Survey', tone: 't4',  icon: Binoculars },
      { key: 'proposal_preparation', label: 'Proposal Preparation',    tone: 't5',  icon: HandHelping },
      { key: 'proposal_sent',        label: 'Proposal Sent',           tone: 't6',  icon: Send },
      { key: 'negotiation',          label: 'Negotiation',             tone: 't7',  icon: MessagesSquare },
      { key: 'decision_pending',     label: 'Decision Pending',        tone: 't8',  icon: Hourglass },
      { key: 'won',                  label: 'Won',                     tone: 't9',  icon: BadgeCheck },
      { key: 'lost',                 label: 'Lost',                    tone: 't10', icon: BadgeX },
    ],
  },
  approval: {
    title: 'Document Approval',
    tags: [
      { key: 'not_submitted',     label: 'Not Submitted',     tone: 't0',  icon: CircleOff },
      { key: 'pending_review',    label: 'Pending Review',    tone: 't2',  icon: Hourglass },
      { key: 'changes_requested', label: 'Changes Requested', tone: 't7',  icon: SquarePen },
      { key: 'approved',          label: 'Approved',          tone: 't9',  icon: CircleCheck },
      { key: 'rejected',          label: 'Rejected',          tone: 't10', icon: CircleX },
    ],
  },
  production: {
    title: 'Production',
    tags: [
      { key: 'not_started',   label: 'Not Started',   tone: 't0', icon: CircleOff },
      { key: 'scheduled',     label: 'Scheduled',     tone: 't1', icon: Calendar },
      { key: 'in_production', label: 'In Production', tone: 't2', icon: Factory },
      { key: 'on_hold',       label: 'On Hold',       tone: 't7', icon: Pause },
      { key: 'delayed',       label: 'Delayed',       tone: 't8', icon: ClockAlert },
      { key: 'completed',     label: 'Completed',     tone: 't9', icon: CircleCheck },
    ],
  },
  quality_control: {
    title: 'Quality Control',
    tags: [
      { key: 'not_inspected',        label: 'Not Inspected',        tone: 't0',  icon: CircleOff },
      { key: 'inspection_scheduled', label: 'Inspection Scheduled', tone: 't1',  icon: CalendarClock },
      { key: 'under_inspection',     label: 'Under Inspection',     tone: 't2',  icon: ScanSearch },
      { key: 'rework_required',      label: 'Rework Required',      tone: 't7',  icon: RotateCcw },
      { key: 'failed',               label: 'Failed',               tone: 't10', icon: CircleX },
      { key: 'passed',               label: 'Passed',               tone: 't9',  icon: CircleCheck },
    ],
  },
  container: {
    title: 'Container',
    tags: [
      { key: 'booked',          label: 'Booked',            tone: 't0', icon: CalendarCheck },
      { key: 'loading',         label: 'Loading',           tone: 't1', icon: Container },
      { key: 'loaded_sealed',   label: 'Loaded & Sealed',   tone: 't3', icon: Lock },
      { key: 'in_transit',      label: 'In Transit',        tone: 't2', icon: Ship },
      { key: 'at_port_customs', label: 'At Port / Customs', tone: 't8', icon: Landmark },
      { key: 'delayed',         label: 'Delayed',           tone: 't7', icon: ClockAlert },
      { key: 'delivered',       label: 'Delivered',         tone: 't9', icon: PackageCheck },
    ],
  },
  change_request: {
    title: 'Change Request',
    tags: [
      { key: 'requested',    label: 'Requested',    tone: 't0',  icon: GitPullRequest },
      { key: 'under_review', label: 'Under Review', tone: 't1',  icon: Eye },
      { key: 'approved',     label: 'Approved',     tone: 't7',  icon: CircleCheck },
      { key: 'implementing', label: 'Implementing', tone: 't2',  icon: Wrench },
      { key: 'implemented',  label: 'Implemented',  tone: 't9',  icon: CheckCheck },
      { key: 'rejected',     label: 'Rejected',     tone: 't10', icon: CircleX },
      { key: 'withdrawn',    label: 'Withdrawn',    tone: 't0',  icon: Undo2 },
    ],
  },
  social_post: {
    title: 'Social Media Post',
    tags: [
      { key: 'idea',      label: 'Idea',      tone: 't0',  icon: CircleDashed },
      { key: 'draft',     label: 'Draft',     tone: 't4',  icon: SquarePen },
      { key: 'scheduled', label: 'Scheduled', tone: 't2',  icon: CalendarClock },
      { key: 'publishing', label: 'Publishing', tone: 't1', icon: Send },
      { key: 'published', label: 'Published', tone: 't9',  icon: CircleCheck },
      { key: 'failed',    label: 'Failed',    tone: 't10', icon: CircleX },
      { key: 'cancelled', label: 'Cancelled', tone: 't10', icon: CircleOff },
    ],
  },
  email_campaign: {
    title: 'Email Campaign',
    tags: [
      { key: 'draft',     label: 'Draft',     tone: 't0',  icon: SquarePen },
      { key: 'scheduled', label: 'Scheduled', tone: 't2',  icon: CalendarClock },
      { key: 'sending',   label: 'Sending',   tone: 't1',  icon: Send },
      { key: 'paused',    label: 'Paused',    tone: 't7',  icon: Pause },
      { key: 'sent',      label: 'Sent',      tone: 't9',  icon: CheckCheck },
      { key: 'cancelled', label: 'Cancelled', tone: 't10', icon: CircleOff },
    ],
  },
  email_message: {
    title: 'Email',
    tags: [
      { key: 'queued',  label: 'Queued',  tone: 't0',  icon: Hourglass },
      { key: 'sending', label: 'Sending', tone: 't1',  icon: Send },
      { key: 'sent',    label: 'Sent',    tone: 't9',  icon: CircleCheck },
      { key: 'failed',  label: 'Failed',  tone: 't10', icon: CircleX },
      { key: 'skipped', label: 'Skipped', tone: 't7',  icon: CircleOff },
    ],
  },
  sales_estimate: {
    title: 'Estimate',
    tags: [
      { key: 'draft',      label: 'Draft',      tone: 't0',  icon: SquarePen },
      { key: 'sent',       label: 'Sent',       tone: 't2',  icon: Send },
      { key: 'accepted',   label: 'Accepted',   tone: 't9',  icon: CircleCheck },
      { key: 'rejected',   label: 'Rejected',   tone: 't10', icon: CircleX },
      { key: 'expired',    label: 'Expired',    tone: 't7',  icon: ClockAlert },
      { key: 'superseded', label: 'Replaced',   tone: 't0',  icon: RotateCcw },
    ],
  },
  sales_contract: {
    title: 'Contract',
    tags: [
      { key: 'draft',     label: 'Draft',     tone: 't0',  icon: SquarePen },
      { key: 'sent',      label: 'Sent',      tone: 't2',  icon: Send },
      { key: 'signed',    label: 'Signed',    tone: 't9',  icon: BadgeCheck },
      { key: 'declined',  label: 'Declined',  tone: 't10', icon: BadgeX },
      { key: 'cancelled', label: 'Cancelled', tone: 't0',  icon: CircleOff },
    ],
  },
  // Design workspace (sales_design_jobs.status / sales_design_versions.status).
  design_job: {
    title: 'Design job',
    tags: [
      { key: 'awaiting_assignment',    label: 'Awaiting designer', tone: 't7',  icon: Hourglass },
      { key: 'assigned',               label: 'Assigned',          tone: 't2',  icon: UserRoundSearch },
      { key: 'working_on_it',          label: 'Working on it',     tone: 't5',  icon: DraftingCompass },
      { key: 'ready_for_sales_review', label: 'Sales review',      tone: 't3',  icon: Eye },
      { key: 'revision_requested',     label: 'Revision',          tone: 't8',  icon: RotateCcw },
      { key: 'approved_by_sales',      label: 'Approved',          tone: 't9',  icon: BadgeCheck },
      { key: 'presented_to_customer',  label: 'With customer',     tone: 't4',  icon: Send },
      { key: 'completed',              label: 'Completed',         tone: 't9',  icon: CheckCheck },
      { key: 'cancelled',              label: 'Cancelled',         tone: 't0',  icon: CircleOff },
    ],
  },
  design_version: {
    title: 'Design version',
    tags: [
      { key: 'draft',              label: 'Draft',          tone: 't0',  icon: SquarePen },
      { key: 'submitted',          label: 'Sent to Sales',  tone: 't3',  icon: Eye },
      { key: 'presented',          label: 'With customer',  tone: 't4',  icon: Send },
      { key: 'approved',           label: 'Approved',       tone: 't9',  icon: BadgeCheck },
      { key: 'revision_requested', label: 'Revision',       tone: 't8',  icon: RotateCcw },
      { key: 'rejected',           label: 'Rejected',       tone: 't10', icon: BadgeX },
    ],
  },
  // Design → Customer Reviews: a design proposal link sent to the customer (approval_links).
  customer_review: {
    title: 'Customer review',
    tags: [
      { key: 'waiting',            label: 'Not opened',  tone: 't0',  icon: Hourglass },
      { key: 'opened',             label: 'Opened',      tone: 't2',  icon: Eye },
      { key: 'approved',           label: 'Approved',    tone: 't9',  icon: BadgeCheck },
      { key: 'revision_requested', label: 'Revision',    tone: 't7',  icon: RotateCcw },
      { key: 'rejected',           label: 'Rejected',    tone: 't10', icon: BadgeX },
      { key: 'revoked',            label: 'Revoked',     tone: 't0',  icon: CircleOff },
      { key: 'expired',            label: 'Expired',     tone: 't0',  icon: ClockAlert },
    ],
  },
  // Production → Projects board (Trust System rows). Keys are the Trust display values; tones keep
  // the meaning of the Trust colours (red = not ordered, blue = ordered, green = sent…).
  trust_status: {
    title: 'Production status',
    tags: [
      { key: 'HOLD / T',          label: 'Hold / T',          tone: 't0',  icon: Pause },
      { key: 'HOLD / PM',         label: 'Hold / PM',         tone: 't0',  icon: Pause },
      { key: 'HOLD BOOKS',        label: 'Hold books',        tone: 't8',  icon: Pause },
      { key: 'NOT ORDERED',       label: 'Not ordered',       tone: 't10', icon: CircleX },
      { key: 'TO ORDER',          label: 'To order',          tone: 't8',  icon: ClockAlert },
      { key: 'BOOKS IN PROGRESS', label: 'Books in progress', tone: 't1',  icon: NotepadText },
      { key: 'ORDERED',           label: 'Ordered',           tone: 't2',  icon: CheckCheck },
      { key: 'WAITING PAYMENT',   label: 'Waiting payment',   tone: 't4',  icon: Hourglass },
      { key: 'ASSEMBLY',          label: 'Assembly',          tone: 't7',  icon: Hammer },
      { key: 'READY TO RECEIVE',  label: 'Ready to receive',  tone: 't8',  icon: PackageCheck },
      { key: 'RECEIVED',          label: 'Received',          tone: 't5',  icon: PackageCheck },
      { key: 'READY',             label: 'Ready',             tone: 't6',  icon: CircleCheck },
      { key: 'SENT TO TLINES',    label: 'Sent to TLines',    tone: 't9',  icon: Ship },
      { key: 'PARTIAL SENT',      label: 'Partial sent',      tone: 't3',  icon: Ship },
      { key: 'SENT',              label: 'Sent',              tone: 't9',  icon: Ship },
    ],
  },
  trust_sign: {
    title: 'PO / PF signature',
    tags: [
      { key: 'NOT SIGNED',             label: 'Not signed',        tone: 't10', icon: CircleOff },
      { key: 'READY TO SIGN',          label: 'Ready to sign',     tone: 't7',  icon: SquarePen },
      { key: 'WAITING TLINES TO SIGN', label: 'Waiting TLines',    tone: 't2',  icon: Hourglass },
      { key: 'WAITING T TO SIGN',      label: 'Waiting T',         tone: 't3',  icon: Hourglass },
      { key: 'SIGNED WITH EST PRICE',  label: 'Signed (est. price)', tone: 't5', icon: BadgeCheck },
      { key: 'SIGNED',                 label: 'Signed',            tone: 't9',  icon: BadgeCheck },
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

/** Tone of the lead tag a CRM opportunity_status maps to (t0 when unmapped). */
export function opportunityTagTone(status: string): StatusTone {
  const key = OPPORTUNITY_STATUS_TAG[status];
  return (STATUS_TAGS.lead_stage.tags as readonly StatusTag[]).find(t => t.key === key)?.tone ?? 't0';
}

/** Look up a status by key (or by label, case-insensitive) within its group. */
export function findStatusTag(group: StatusGroup, status: string): StatusTag | undefined {
  const s = status.trim().toLowerCase();
  return (STATUS_TAGS[group].tags as readonly StatusTag[]).find(t => t.key === s || t.label.toLowerCase() === s);
}
