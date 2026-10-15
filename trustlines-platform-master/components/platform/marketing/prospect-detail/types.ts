import type { LeadEntityType, ProjectType, ScopeType, LeadTiming, NeedClassification, OpportunityStage, PotentialStatus } from '@/types/database';

export interface Prospect {
  id: string; entity_type: LeadEntityType; display_name: string;
  organization_name: string | null; person_name: string | null;
  brand_name: string | null; industry: string | null;
  website: string | null; main_email: string | null; main_phone: string | null;
  company_size: string | null; location_count: number | null; status: string;
  owner_id: string | null; assigned_marketing_user_id: string | null; customer_id: string | null;
  source_label: string | null;
  business_types?: string[]; region?: string | null;
  tags?: { name: string; color: string }[];
  source_detail?: string | null; source_raw_label?: string | null; x_note?: string | null; created_by_label?: string | null;
  external_created_at?: string | null;
  is_archived: boolean; created_at: string; updated_at: string;
}
export interface Contact {
  id: string; prospect_id: string; name: string; title: string | null; role_type: string | null;
  email: string | null; phone: string | null; linkedin_url: string | null; preferred_contact_method: string | null;
  is_decision_maker: boolean; is_primary: boolean; contact_consent: boolean; notes: string | null; created_at: string;
  other_contact?: string | null;
  whatsapp?: boolean; company2_phone?: string | null;
}
export interface ProspectLocation {
  id: string; prospect_id: string; location_name: string | null; address_line_1: string | null;
  address_line_2: string | null; city: string | null; state: string | null; postal_code: string | null;
  country: string | null; location_type: string | null; is_active: boolean; store_status: string | null;
  estimated_remodel_date: string | null; notes: string | null; created_at: string;
  mailing_address?: string | null;
}
// A location saved with only a street address (no location_name, no city/state — e.g. pasted
// straight from a note) used to show as a generic "Location" everywhere it's picked from a
// list, including the Potential-creation dropdown ("kişiye ana adres çıksın" — the Contact's
// own address should actually be visible/selectable there, not hidden behind a placeholder).
export function locationLabel(l: ProspectLocation): string {
  return l.location_name
    || [l.address_line_1, l.city, l.state].filter(Boolean).join(', ')
    || 'Location';
}

export interface Need {
  id: string; prospect_id: string; location_id: string | null; title: string; description: string | null;
  has_active_project: boolean | null; project_types: ProjectType[]; scope_types: ScopeType[];
  deadline: string | null; expected_start_date: string | null; layout_available: boolean | null; site_ready: boolean | null;
  budget_min: number | null; budget_max: number | null; currency: string | null;
  timing: LeadTiming | null; target_contact_date: string | null; source: string | null; status: string;
  classification: NeedClassification;
  classification_reasons: string[]; created_at: string; updated_at: string;
  region?: string | null; service_line?: string | null; state?: string | null; project_id?: string | null;
}
export interface Potential {
  id: string; need_id: string; prospect_id: string; title: string; status: PotentialStatus;
  target_contact_date: string | null; converted_opportunity_id: string | null; auto_managed: boolean;
  classification_reasons: string[]; created_at: string;
}
export interface OpportunityRow {
  id: string; need_id: string; prospect_id: string; title: string; stage: OpportunityStage;
  deadline: string | null; auto_managed: boolean; admin_corrected: boolean;
  classification_reasons: string[]; created_at: string;
}

export interface ContactNote {
  id: string; prospect_contact_id: string; author_name: string | null; body: string;
  source_created_at: string | null; created_at: string;
}
export interface ProspectFile {
  id: string; prospect_id: string; dropbox_path: string; file_name: string;
  uploaded_by: string | null; uploaded_by_name?: string | null; created_at: string;
}

export interface HistoricalProject {
  id: string; code: string; name: string; region: string; service_line: string;
  site_location: string | null; categories: string[]; actual_delivery_date: string | null; created_at: string;
}

export const NEED_CLASSIFICATION_VARIANT: Record<NeedClassification, 'neutral' | 'warning' | 'info' | 'danger'> = {
  unclassified: 'neutral', potential: 'warning', opportunity: 'info', disqualified: 'danger',
};
export const NEED_CLASSIFICATION_LABEL: Record<NeedClassification, string> = {
  unclassified: 'Unclassified', potential: 'Potential', opportunity: 'Opportunity', disqualified: 'Disqualified',
};

export const STATUSES = [
  'captured', 'enrichment', 'potential', 'nurture', 'opportunity_candidate',
  'qualified_for_sales', 'converted', 'disqualified', 'archived',
];
export const STATUS_LABEL: Record<string, string> = {
  captured: 'Captured', enrichment: 'Enrichment', potential: 'Potential', nurture: 'Nurture',
  opportunity_candidate: 'Opportunity candidate', qualified_for_sales: 'Qualified for Sales',
  converted: 'Converted', disqualified: 'Disqualified', archived: 'Archived',
};

export type Tab = 'overview' | 'contacts' | 'locations' | 'needs' | 'potentials' | 'opportunities' | 'history' | 'activities' | 'files';
export const VALID_TABS: Tab[] = ['overview', 'contacts', 'locations', 'needs', 'potentials', 'opportunities', 'history', 'activities', 'files'];

export const DONE_POTENTIAL_STATUSES = new Set(['converted', 'lost', 'cancelled']);
