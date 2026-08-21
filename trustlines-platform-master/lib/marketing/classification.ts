
import type { LeadClassification, LeadEntityType, LeadSource, LeadTiming, ProjectType, ScopeType, ProspectStatus, OpportunityStage, NeedClassification } from '@/types/database';

export const LEAD_CLASSIFICATION_LABEL: Record<LeadClassification, string> = {
  lead: 'Lead',
  potential: 'Potential',
  opportunity_candidate: 'Opportunity Candidate',
  disqualified: 'Disqualified',
};

export const ENTITY_TYPE_LABEL: Record<LeadEntityType, string> = {
  organization: 'Business / Organization',
  person: 'Person',
};
export const ENTITY_TYPES: LeadEntityType[] = ['organization', 'person'];

export const CLASSIFICATION_TO_STATUS: Record<LeadClassification, ProspectStatus> = {
  lead: 'captured',
  potential: 'potential',
  opportunity_candidate: 'opportunity_candidate',
  disqualified: 'disqualified',
};
export const STATUS_TO_CLASSIFICATION: Record<ProspectStatus, LeadClassification> = {
  captured: 'lead', enrichment: 'lead',
  potential: 'potential', nurture: 'potential',
  opportunity_candidate: 'opportunity_candidate', qualified_for_sales: 'opportunity_candidate',
  converted: 'opportunity_candidate', disqualified: 'disqualified', archived: 'lead',
};

export const CLASSIFICATION_TO_NEED: Record<LeadClassification, NeedClassification> = {
  lead: 'unclassified', potential: 'potential', opportunity_candidate: 'opportunity', disqualified: 'disqualified',
};

export const SOURCE_LABEL: Record<LeadSource, string> = {
  trade_fair: 'Trade Fair', event: 'Event', website: 'Website', instagram: 'Instagram',
  linkedin: 'LinkedIn', referral: 'Referral', cold_outreach: 'Cold Outreach',
  existing_customer: 'Existing Customer', partner: 'Partner', other: 'Other',
};
export const SOURCES = Object.keys(SOURCE_LABEL) as LeadSource[];

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  full_remodel: 'Full Remodel', small_remodel: 'Small Remodel',
  new_construction: 'New Construction', bid: 'BID',
};
export const PROJECT_TYPES = Object.keys(PROJECT_TYPE_LABEL) as ProjectType[];

export const SCOPE_TYPE_LABEL: Record<ScopeType, string> = {
  millwork: 'Millwork', shelving: 'Shelving', ceiling: 'Ceiling', image: 'Image',
  furniture: 'Furniture', decoration: 'Decoration', graphic: 'Graphic', shop_drawing: 'Shop Drawing',
};
export const SCOPE_TYPES = Object.keys(SCOPE_TYPE_LABEL) as ScopeType[];

export const TIMING_LABEL: Record<LeadTiming, string> = {
  immediate: 'Immediate', '0_3_months': '0–3 months', '3_6_months': '3–6 months',
  '6_12_months': '6–12 months', '12_plus_months': '12+ months',
  no_current_project: 'No current project', contact_later: 'Contact later',
};
export const TIMINGS = Object.keys(TIMING_LABEL) as LeadTiming[];

export const OPPORTUNITY_STAGE_LABEL: Record<OpportunityStage, string> = {
  new: 'New', marketing_qualification: 'Marketing Qualification', qualified_for_sales: 'Qualified for Sales',
  sales_handoff: 'Sales Handoff', sales_accepted: 'Sales Accepted', discovery: 'Discovery',
  sales_design: 'Sales Design', proposal: 'Proposal', negotiation: 'Negotiation',
  working_on_it_trust: 'Working on it Trust',
  closed_won: 'Closed Won', closed_lost: 'Closed Lost', on_hold: 'On Hold',
};

export const NEAR_TERM_START_HORIZON_DAYS = 180;
export const MAX_FOLLOW_UP_HORIZON_DAYS = 730;
export const DEFAULT_FOLLOW_UP_DAYS = 7;
export const POTENTIAL_FOLLOW_UP_DAYS = 30;

export const CLASSIFICATION_RULE_VERSION = 2;

export interface ClassificationInput {
  hasActiveProject: boolean | null;
  deadline: string | null;
  expectedStartDate: string | null;
  projectTypes: ProjectType[];
  locationCount: number | null;
  futureExpansion: boolean;
  layoutAvailable: boolean | null;
  timing: LeadTiming | null;
  explicitInterest?: boolean;
  hasDocumentEvidence: boolean;
}

export interface ClassificationResult {
  classification: LeadClassification;
  reasons: string[];
  recommendedNextAction: string;
  recommendedFollowUpDate: string;
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function classifyLead(input: ClassificationInput): ClassificationResult {
  const reasons: string[] = [];

  if (input.hasDocumentEvidence) reasons.push('Layout/Matterport/reference document attached');

  if (reasons.length) {
    return {
      classification: 'opportunity_candidate',
      reasons,
      recommendedNextAction: 'Qualify and hand off to Sales',
      recommendedFollowUpDate: addDays(DEFAULT_FOLLOW_UP_DAYS),
    };
  }

  if ((input.locationCount ?? 0) > 0) reasons.push(`${input.locationCount} location(s) on file`);
  if (input.futureExpansion) reasons.push('Future expansion indicated');
  if (input.timing === 'contact_later') reasons.push('Asked to be contacted later');
  if (input.timing === '6_12_months' || input.timing === '12_plus_months') reasons.push(`Timing is ${TIMING_LABEL[input.timing]}`);
  if (!reasons.length) reasons.push('No document/link attached yet');

  return {
    classification: 'potential',
    reasons,
    recommendedNextAction: 'Add to nurture and set a target contact date',
    recommendedFollowUpDate: addDays(POTENTIAL_FOLLOW_UP_DAYS),
  };
}
