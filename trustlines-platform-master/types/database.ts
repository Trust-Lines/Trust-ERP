





import type { CompanySide, Office, Department, Skill } from '@/lib/profile/metadata';
export type { CompanySide, Office, Department, Skill };

export type UserRole =
  | 'ops_manager'
  | 'pm_millwork'
  | 'pm_ceiling'
  | 'trustlines_pm'
  | 'tlines_pm'
  | 'qc_responsible'
  | 'logistics'
  | 'accounting'

  | 'production_manager'
  | 'project_manager'
  | 'general_manager'
  | 'accountant'


  | 'sales_marketing_manager'
  | 'sales_rep'



  | 'designer'



  | 'design_lead'
  | 'shop_drawer'

  | 'supply_manager'
  | 'supply_user'
  | 'production_user'
  | 'warehouse_manager'
  | 'warehouse_user'

  | 'marketing_pr'
  | 'marketing_manager';

export type ProjectCategory =
  | 'M1' | 'M2' | 'M3'
  | 'S1' | 'S2' | 'S3'
  | 'C1' | 'C2' | 'C3'
  | 'I1' | 'I2' | 'I3';

export type ProjectStage =
  | 'closed_deal'
  | 'finalization'
  | 'client_approval'
  | 'production'
  | 'delivered';

export type ProjectPhase =
  | 'finalization'
  | 'construction_documents'
  | 'production'
  | 'delivery';

export type DocStatus =
  | 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'signed' | 'revised';

export type QcResult = 'pass' | 'fail' | 'pending';
export type CurrencyType = 'USD' | 'EUR' | 'TRY';
export type DocType =
  | 'closed_deal_email' | 'shop_drawing' | 'item_plan' | 'item_list'
  | 'boq' | 'book' | 'price_list' | 'po_bo' | 'pf' | 'qc_checklist'
  | 'packing_list' | 'shipment_doc' | 'delivery_confirm'
  | 'proposal' | 'plan_layout' | 'construction_drawings'

  | 'sales_design';

export type StepStatus = 'pending' | 'done' | 'approved' | 'rejected';
export type CategoryGroup = 'millwork' | 'shelving' | 'ceiling' | 'image';

export interface ProjectStep {
  id: string;
  project_id: string;
  phase: string;
  cat_group: string | null;
  step_key: string;
  status: StepStatus;
  document_id: string | null;
  version_approved: number | null;
  completed_by: string | null;
  completed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  category_scope: ProjectCategory[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;




  company_side: CompanySide | null;
  office: Office | null;
  department: Department | null;
  skills: Skill[];
  manager_id: string | null;
  region_ids: string[];
  service_line_ids: string[];
}






export interface Client {
  id: string;
  name: string;
  code: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ClientFranchise {
  id: string;
  client_id: string;
  name: string;
  code: string | null;
  margin_pct: number | null;
  pm_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ClientCompany {
  id: string;
  franchise_id: string;
  name: string;
  code: string | null;
  margin_pct: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  client_id: string | null;
  client_franchise_id: string | null;
  client_company_id: string | null;
  customer_id: string | null;
  region: string | null;
  service_line: string | null;
  is_draft: boolean;
  delivered_to_trust_at: string | null;
  site_location: string | null;
  current_stage: ProjectStage;
  current_phase: ProjectPhase;
  categories: string[];
  has_millwork_shelving: boolean;
  has_ceiling_image: boolean;
  is_mixed_scope: boolean;
  deal_value: number | null;
  currency: CurrencyType;
  payment_terms: string | null;
  margin_target_pct: number | null;
  closed_deal_date: string | null;
  est_finalization_date: string | null;
  est_production_start: string | null;
  est_delivery_date: string | null;
  hard_deadline: boolean;
  actual_delivery_date: string | null;
  ops_manager_id: string | null;
  trustlines_pm_id: string | null;
  tlines_pm_id: string | null;
  prod_pm_ms_id: string | null;
  prod_pm_ci_id: string | null;
  qc_inspector_id: string | null;
  clickup_task_id: string | null;
  quickbooks_ref: string | null;
  dropbox_root_path: string | null;
  is_archived: boolean;
  scope_summary: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  doc_type: DocType;
  version: number;
  status: DocStatus;
  dropbox_path: string;
  dropbox_file_id: string | null;
  dropbox_rev: string | null;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string;
  uploaded_by: string | null;
  approved_by: string | null;
  signed_by: string | null;
  approved_at: string | null;
  signed_at: string | null;
  uploaded_at: string;
  branch: 'ms' | 'ci' | 'combined' | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface QcChecklist {
  id: string;
  project_id: string;
  document_id: string | null;
  form_code: string;
  overall_result: QcResult;
  sections: unknown[];
  trustlines_rep_name: string | null;
  trustlines_rep_signed: boolean;
  trustlines_signed_at: string | null;
  customer_rep_name: string | null;
  customer_rep_signed: boolean;
  customer_signed_at: string | null;
  conducted_by: string | null;
  conducted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  project_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  project_id: string | null;
  actor_id: string | null;
  action: string;
  resource: string | null;
  old_value: unknown | null;
  new_value: unknown | null;
  created_at: string;
}

export interface StageTransition {
  id: string;
  project_id: string;
  from_stage: string;
  to_stage: string;
  transitioned_by: string | null;
  is_override: boolean;
  override_reason: string | null;
  created_at: string;
}

export interface ProjectNote {
  id: string;
  project_id: string;
  author_id: string | null;
  content: string;
  is_internal: boolean;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  code: string | null;
  category: ProjectCategory[] | null;
  contact: unknown | null;
  country: string;
  is_active: boolean;

  email: string | null;
  phone: string | null;
  address: string | null;
  tax_office: string | null;
  tax_number: string | null;
  payment_terms: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CurrencyCode = 'USD' | 'TL' | 'EUR';
export type SupplierInvoiceStatus = 'unpaid' | 'partial' | 'paid';
export type SupplierPaymentMethod = 'bank_transfer' | 'cash' | 'check' | 'other';

export interface SupplierInvoice {
  id: string;
  supplier_id: string;
  project_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  currency: CurrencyCode;
  amount: number;
  description: string | null;
  dropbox_path: string | null;
  status: SupplierInvoiceStatus;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrustExpense {
  id: string;
  category: string;
  description: string | null;
  currency: CurrencyCode;
  amount: number;
  expense_date: string | null;
  project_id: string | null;
  supplier_id: string | null;
  is_paid: boolean;
  dropbox_path: string | null;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  invoice_id: string | null;
  project_id: string | null;
  currency: CurrencyCode;
  amount: number;
  paid_at: string | null;
  method: SupplierPaymentMethod;
  reference: string | null;
  notes: string | null;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}





export type OpportunityStatus =
  | 'new_opportunity' | 'ready_to_start' | 'modification_request' | 'waiting_from_op';

export interface LeadIntake {
  id: string;
  project_id: string | null;
  lead_ref: string | null;
  region: string | null;
  client_id: string | null;
  customer_id: string | null;
  service_line: string | null;
  project_number: number | null;
  address: string | null;

  customer_name: string | null;
  brand: string | null;
  customer_email: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  industry: string | null;
  project_type: string | null;
  customer_address: string | null;

  priority: 'high' | 'medium' | 'low';
  assignee_id: string | null;
  deal_size: number | null;
  source: string | null;
  follow_up_date: string | null;
  next_action: string | null;
  tags: string[];
  checklist: { id: string; text: string; done: boolean }[];

  city: string | null;
  street: string | null;
  state: string | null;
  opportunity_status: OpportunityStatus;
  scope_of_work: { shelving?: boolean; millwork?: boolean; image?: boolean; ceiling?: boolean };
  notes: {
    shelving?: string; millwork?: string; image?: string; ceiling?: string;
    areas?: string; client_special_request?: string;
  };
  matterport_link: string | null;
  is_delivered: boolean;
  created_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface LeadActivity {
  id: string;
  lead_intake_id: string;
  actor_id: string | null;
  kind: 'comment' | 'change';
  body: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export type LeadIntakeDocCategory =
  | 'shelving_note' | 'millwork_note' | 'image_note' | 'ceiling_note'
  | 'areas_note' | 'client_special_request_note' | 'plan_layout' | 'photos';

export interface LeadIntakeDocument {
  id: string;
  lead_intake_id: string;
  category: LeadIntakeDocCategory;
  dropbox_path: string;
  file_name: string;
  uploaded_by: string | null;
  created_at: string;
}




export type CustomerStatus = 'active' | 'inactive' | 'prospect';

export interface Customer {
  id: string;
  name: string;
  code: string | null;
  industry: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  tax_id: string | null;
  status: CustomerStatus;
  notes: string | null;
  created_by: string | null;
  is_archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerContact {
  id: string;
  customer_id: string;
  name: string;
  title: string | null;
  role_type: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  is_authorized_approver: boolean;
  notes: string | null;
  created_by: string | null;
  is_archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  label: string | null;
  address_type: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  is_primary: boolean;
  notes: string | null;
  created_by: string | null;
  is_archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCustomerContact {
  id: string;
  project_id: string;
  customer_contact_id: string;
  role_on_project: string | null;
  is_primary: boolean;
  created_by: string | null;
  created_at: string;
}

export interface HandoverChecklistItem {
  key: string;
  label: string;
  done: boolean;
  done_at?: string | null;
  done_by?: string | null;
}

export interface ProjectHandover {
  id: string;
  project_id: string;
  checklist: HandoverChecklistItem[];
  status: 'in_progress' | 'complete';
  meeting_at: string | null;
  notes: string | null;
  handed_over_by: string | null;
  handover_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}




export type SalesDesignJobStatus =
  | 'awaiting_assignment' | 'assigned' | 'working_on_it' | 'ready_for_sales_review'
  | 'revision_requested' | 'approved_by_sales' | 'presented_to_customer' | 'completed' | 'cancelled';
export type SalesDesignVersionStatus =
  | 'draft' | 'submitted' | 'presented' | 'approved' | 'revision_requested' | 'rejected';

export interface SalesDesignJob {
  id: string;

  lead_intake_id: string | null;
  opportunity_id: string | null;
  customer_id: string | null;
  title: string;
  brief: string | null;
  assigned_designer_id: string | null;
  status: SalesDesignJobStatus;
  priority: string;
  due_date: string | null;
  created_by: string | null;
  is_archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}


export interface SalesDesignVersionFile {
  id: string;
  version_id: string;
  job_id: string;
  dropbox_path: string;
  file_name: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface SalesDesignVersion {
  id: string;
  job_id: string;
  version_no: number;
  status: SalesDesignVersionStatus;
  preview_link: string | null;
  notes: string | null;
  presented_at: string | null;
  customer_feedback: string | null;
  created_by: string | null;
  created_at: string;
}


export interface CustomerMeeting {
  id: string;
  customer_id: string;
  lead_intake_id: string | null;
  project_id: string | null;
  title: string;
  meeting_type: string | null;
  meeting_at: string;
  location: string | null;
  attendees: string | null;
  notes: string | null;
  outcome: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerFollowUp {
  id: string;
  customer_id: string;
  lead_intake_id: string | null;
  project_id: string | null;
  note: string;
  due_date: string;
  assignee_id: string | null;
  status: 'open' | 'done' | 'cancelled';
  completed_at: string | null;
  completed_by: string | null;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}


export type ChangeRequestStatus =
  | 'open' | 'under_review' | 'approved' | 'rejected' | 'implemented' | 'cancelled';

export interface ChangeRequest {
  id: string;
  project_id: string;
  customer_contact_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  status: ChangeRequestStatus;
  budget_impact: number | null;
  currency: string | null;
  timeline_impact_days: number | null;
  decision_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteReadinessItem {
  key: string; label: string; done: boolean; done_at?: string | null; done_by?: string | null;
}
export interface SiteReadiness {
  id: string;
  project_id: string;
  checklist: SiteReadinessItem[];
  overall_status: 'not_ready' | 'partial' | 'ready';
  target_ready_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}


export type ApprovalLinkStatus = 'active' | 'completed' | 'revoked' | 'expired';
export type ApprovalDecision = 'approved' | 'rejected' | 'revision_requested';

export interface ApprovalLink {
  id: string;
  project_id: string;
  document_id: string | null;
  document_version_id: string | null;
  sales_design_version_id: string | null;
  customer_contact_id: string | null;
  title: string | null;
  token_hash: string;
  status: ApprovalLinkStatus;
  decision: ApprovalDecision | null;
  expires_at: string | null;
  max_views: number | null;
  view_count: number;
  require_email_verification: boolean;
  created_by: string | null;
  first_opened_at: string | null;
  completed_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalLinkEvent {
  id: string;
  approval_link_id: string;
  event_type: string;
  actor_name: string | null;
  actor_email: string | null;
  comment: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}


export type ContainerStatus =
  | 'PLANNING' | 'BOOKED' | 'WAITING_LOADING' | 'LOADING' | 'DEPARTED' | 'IN_TRANSIT'
  | 'ARRIVED_PORT' | 'CUSTOMS' | 'RELEASED' | 'WAREHOUSE' | 'COMPLETED' | 'CANCELLED';

export interface Container {
  id: string;
  container_no: string | null;
  booking_no: string | null;
  carrier: string | null;
  vessel_name: string | null;
  voyage_no: string | null;
  origin_port: string | null;
  destination_port: string | null;
  departure_date: string | null;
  estimated_arrival_date: string | null;
  actual_arrival_date: string | null;
  customs_clearance_date: string | null;
  warehouse_arrival_date: string | null;
  status: ContainerStatus;
  seal_no: string | null;
  tracking_url: string | null;
  notes: string | null;

  delivery_destination: 'warehouse' | 'direct_job_site';
  job_site_address: string | null;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContainerDocument {
  id: string;
  container_id: string;
  doc_type: string | null;
  name: string;
  dropbox_path: string | null;
  url: string | null;
  uploaded_by: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface ContainerItem {
  id: string;
  container_id: string;
  production_item_id: string;
  quantity: number | null;
  package_count: number | null;
  pallet_count: number | null;
  gross_weight: number | null;
  volume_cbm: number | null;
  loaded_at: string | null;
  unloaded_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}


export interface DeliveryPlan {
  id: string;
  project_id: string;
  delivery_method: 'warehouse' | 'direct_job_site' | 'partial' | 'hold';
  installation_date: string | null;
  build_by: string | null;
  build_schedule: string | null;
  site_confirmed: boolean;
  customer_accepted: boolean;
  accepted_by: string | null;
  accepted_at: string | null;
  status: 'planning' | 'scheduled' | 'in_progress' | 'completed';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PunchListItem {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: 'open' | 'done';
  resolved_at: string | null;
  resolved_by: string | null;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}





export interface SystemEventRow {
  id:           string;
  event_type:   string;
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






export type ProspectStatus =
  | 'captured' | 'enrichment' | 'potential' | 'nurture' | 'opportunity_candidate'
  | 'qualified_for_sales' | 'converted' | 'disqualified' | 'archived';




export type LeadSource =
  | 'trade_fair' | 'event' | 'website' | 'instagram' | 'linkedin' | 'referral'
  | 'cold_outreach' | 'existing_customer' | 'partner' | 'other';

export type ProjectType = 'full_remodel' | 'small_remodel' | 'new_construction' | 'bid';

export type ScopeType =
  | 'millwork' | 'shelving' | 'ceiling' | 'image' | 'furniture' | 'decoration' | 'graphic' | 'shop_drawing';

export type LeadTiming =
  | 'immediate' | '0_3_months' | '3_6_months' | '6_12_months' | '12_plus_months'
  | 'no_current_project' | 'contact_later';


export type LeadClassification = 'lead' | 'potential' | 'opportunity_candidate' | 'disqualified';


export type LeadEntityType = 'organization' | 'person';

export interface Prospect {
  id: string;
  entity_type: LeadEntityType;

  display_name: string;
  organization_name: string | null;
  person_name: string | null;
  brand_name: string | null;
  industry: string | null;
  website: string | null;
  main_email: string | null;
  main_phone: string | null;
  company_size: string | null;
  location_count: number | null;
  status: ProspectStatus;
  source_id: string | null;
  source_label: string | null;
  campaign_id: string | null;
  event_id: string | null;

  latest_source_label: string | null;
  latest_campaign_id: string | null;

  external_source: string | null;
  external_ref: string | null;

  region: string | null;

  business_types: string[];

  source_detail: string | null;
  owner_id: string | null;
  assigned_marketing_user_id: string | null;
  customer_id: string | null;

  project_types: ProjectType[];
  scope_types: ScopeType[];
  has_active_project: boolean | null;
  project_count: number | null;
  deadline: string | null;
  expected_start_date: string | null;
  layout_available: boolean | null;
  site_ready: boolean | null;
  budget_range: string | null;
  notes: string | null;

  timing: LeadTiming | null;
  target_contact_date: string | null;

  classification_reasons: string[];
  next_action: string | null;
  next_action_date: string | null;
  classification_overridden: boolean;
  classification_override_reason: string | null;
  is_archived: boolean;
  deleted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProspectContact {
  id: string;
  prospect_id: string;
  name: string;
  title: string | null;
  role_type: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  preferred_contact_method: string | null;
  is_decision_maker: boolean;
  is_primary: boolean;
  contact_consent: boolean;
  notes: string | null;

  other_contact: string | null;
  whatsapp: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProspectLocation {
  id: string;
  prospect_id: string;
  location_name: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;

  latitude: number | null;
  longitude: number | null;

  mailing_address: string | null;
  postal_code: string | null;
  country: string | null;
  location_type: string | null;
  is_active: boolean;
  store_status: string | null;
  estimated_remodel_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}






export type OpportunityStage =
  | 'new' | 'marketing_qualification' | 'qualified_for_sales' | 'sales_handoff' | 'sales_accepted'
  | 'discovery' | 'sales_design' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost' | 'on_hold'



  | 'working_on_it_trust';

export type OpportunityType =
  | 'new_construction' | 'full_remodel' | 'small_remodel' | 'repair' | 'upgrade'
  | 'items_only' | 'design_only' | 'multi_location_rollout' | 'unknown';





export type NeedStatus = 'open' | 'disqualified' | 'archived';
export type NeedClassification = 'unclassified' | 'potential' | 'opportunity' | 'disqualified';

export interface ProspectNeed {
  id: string;
  prospect_id: string;
  location_id: string | null;
  title: string;
  description: string | null;
  has_active_project: boolean | null;
  project_types: ProjectType[];
  scope_types: ScopeType[];
  deadline: string | null;
  expected_start_date: string | null;
  layout_available: boolean | null;
  site_ready: boolean | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string | null;
  timing: LeadTiming | null;

  target_contact_date: string | null;
  source: string | null;
  status: NeedStatus;
  classification: NeedClassification;
  classification_reasons: string[];
  classification_rule_version: number;

  region: string | null;
  service_line: string | null;
  state: string | null;
  project_id: string | null;

  external_source: string | null;
  external_ref: string | null;
  deleted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PotentialStatus =
  | 'identified' | 'nurture' | 'waiting_timing' | 'contact_due' | 'converted' | 'lost' | 'cancelled';

export interface ProspectPotential {
  id: string;
  need_id: string;
  prospect_id: string;
  title: string;
  potential_type: string | null;
  status: PotentialStatus;
  estimated_start_date: string | null;
  target_contact_date: string | null;
  estimated_quantity: number | null;
  estimated_value: number | null;
  currency: string | null;
  confidence: string | null;
  assigned_to: string | null;
  last_contact_at: string | null;
  next_contact_at: string | null;
  converted_opportunity_id: string | null;
  auto_managed: boolean;
  classification_reasons: string[];
  classification_rule_version: number;
  notes: string | null;

  external_source: string | null;
  external_ref: string | null;
  external_stage_label: string | null;
  deleted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Opportunity {
  id: string;
  prospect_id: string;

  need_id: string;
  customer_id: string | null;
  primary_contact_id: string | null;
  title: string;
  description: string | null;
  opportunity_type: OpportunityType | null;
  project_types: ProjectType[];
  scope_types: ScopeType[];
  stage: OpportunityStage;
  source_label: string | null;
  marketing_owner_id: string | null;
  sales_owner_id: string | null;

  project_id: string | null;

  return_reason: string | null;
  estimated_location_count: number | null;
  estimated_value: number | null;
  currency: string | null;
  probability: number | null;
  expected_close_date: string | null;
  deadline: string | null;
  urgency: string | null;
  budget_status: string | null;
  decision_maker_status: string | null;
  next_action: string | null;
  next_action_date: string | null;
  sales_handoff_at: string | null;
  sales_accepted_at: string | null;
  closed_at: string | null;
  closed_reason: string | null;

  auto_managed: boolean;
  classification_reasons: string[];
  classification_rule_version: number;

  admin_corrected: boolean;
  admin_correction_reason: string | null;

  external_source: string | null;
  external_ref: string | null;
  external_stage_label: string | null;
  deleted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpportunityLocation {
  opportunity_id: string;
  prospect_location_id: string;
  scope_summary: string | null;
  estimated_start_date: string | null;
  deadline: string | null;
  priority: number | null;
  created_at: string;
}




export type CampaignType = 'trade_fair' | 'event';
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'closed';

export interface MarketingCampaign {
  id: string;
  name: string;
  code: string | null;

  slug: string;
  campaign_type: CampaignType;
  source: LeadSource;
  city: string | null;

  state: string | null;
  country: string | null;
  venue: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  default_language: string;
  owner_user_id: string | null;
  status: CampaignStatus;
  public_title: string | null;
  public_description: string | null;
  consent_text_version: string;

  survey_template: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  deleted_at: string | null;
}

export type SurveySubmissionStatus = 'processed' | 'needs_review' | 'rejected_spam' | 'failed';

export interface SurveySubmission {
  id: string;
  campaign_id: string;
  prospect_id: string | null;
  need_id: string | null;
  status: SurveySubmissionStatus;
  submitted_data: Record<string, unknown>;
  normalized_email: string | null;
  normalized_phone: string | null;
  consent_accepted: boolean;
  consent_text_version: string | null;
  consent_accepted_at: string | null;
  language: string | null;
  submitted_at: string;
  processed_at: string | null;

  error_code: string | null;
  error_message: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}


export type CampaignInteractionType = 'survey_submission' | 'clickup_import';

export interface CampaignInteraction {
  id: string;
  campaign_id: string;
  prospect_id: string;
  survey_submission_id: string | null;
  interaction_type: CampaignInteractionType;
  occurred_at: string;
  source: string | null;
  created_at: string;
}


export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at' | 'updated_at'>; Update: Partial<Profile>; };
      clients:  { Row: Client;  Insert: Omit<Client, 'created_at'>;                 Update: Partial<Client>; };
      client_franchises: { Row: ClientFranchise;  Insert: Omit<ClientFranchise, 'id' | 'created_at'>;  Update: Partial<ClientFranchise>; };
      client_companies:  { Row: ClientCompany; Insert: Omit<ClientCompany, 'id' | 'created_at'>; Update: Partial<ClientCompany>; };
      projects: { Row: Project; Insert: Omit<Project, 'created_at' | 'updated_at' | 'has_millwork_shelving' | 'has_ceiling_image' | 'is_mixed_scope'>; Update: Partial<Project>; };
      documents:{ Row: Document;Insert: Omit<Document,'created_at'|'updated_at'>;   Update: Partial<Document>; };
      notifications: { Row: Notification; Insert: Omit<Notification,'id'|'created_at'>; Update: Partial<Notification>; };
      audit_log: { Row: AuditLog; Insert: Omit<AuditLog,'id'|'created_at'>; Update: Partial<AuditLog>; };
      suppliers: { Row: Supplier; Insert: Omit<Supplier,'id'|'created_at'|'updated_at'>; Update: Partial<Supplier>; };
      supplier_invoices: { Row: SupplierInvoice; Insert: Omit<SupplierInvoice,'id'|'created_at'|'updated_at'>; Update: Partial<SupplierInvoice>; };
      supplier_payments: { Row: SupplierPayment; Insert: Omit<SupplierPayment,'id'|'created_at'|'updated_at'>; Update: Partial<SupplierPayment>; };
      trust_expenses: { Row: TrustExpense; Insert: Omit<TrustExpense,'id'|'created_at'|'updated_at'>; Update: Partial<TrustExpense>; };
      stage_transitions: { Row: StageTransition; Insert: Omit<StageTransition,'id'|'created_at'>; Update: Partial<StageTransition>; };
      project_notes: { Row: ProjectNote; Insert: Omit<ProjectNote,'id'|'created_at'>; Update: Partial<ProjectNote>; };
      qc_checklists: { Row: QcChecklist; Insert: Omit<QcChecklist,'id'|'created_at'|'updated_at'>; Update: Partial<QcChecklist>; };
      lead_intake: { Row: LeadIntake; Insert: Omit<LeadIntake,'id'|'created_at'|'updated_at'>; Update: Partial<LeadIntake>; };
      lead_intake_documents: { Row: LeadIntakeDocument; Insert: Omit<LeadIntakeDocument,'id'|'created_at'>; Update: Partial<LeadIntakeDocument>; };
      customers: { Row: Customer; Insert: Omit<Customer,'id'|'created_at'|'updated_at'>; Update: Partial<Customer>; };
      customer_contacts: { Row: CustomerContact; Insert: Omit<CustomerContact,'id'|'created_at'|'updated_at'>; Update: Partial<CustomerContact>; };
      customer_addresses: { Row: CustomerAddress; Insert: Omit<CustomerAddress,'id'|'created_at'|'updated_at'>; Update: Partial<CustomerAddress>; };
      customer_meetings: { Row: CustomerMeeting; Insert: Omit<CustomerMeeting,'id'|'created_at'|'updated_at'>; Update: Partial<CustomerMeeting>; };
      customer_follow_ups: { Row: CustomerFollowUp; Insert: Omit<CustomerFollowUp,'id'|'created_at'|'updated_at'>; Update: Partial<CustomerFollowUp>; };
      project_customer_contacts: { Row: ProjectCustomerContact; Insert: Omit<ProjectCustomerContact,'id'|'created_at'>; Update: Partial<ProjectCustomerContact>; };
      project_handovers: { Row: ProjectHandover; Insert: Omit<ProjectHandover,'id'|'created_at'|'updated_at'>; Update: Partial<ProjectHandover>; };
      sales_design_jobs: { Row: SalesDesignJob; Insert: Omit<SalesDesignJob,'id'|'created_at'|'updated_at'>; Update: Partial<SalesDesignJob>; };
      sales_design_versions: { Row: SalesDesignVersion; Insert: Omit<SalesDesignVersion,'id'|'created_at'>; Update: Partial<SalesDesignVersion>; };
      sales_design_version_files: { Row: SalesDesignVersionFile; Insert: Omit<SalesDesignVersionFile,'id'|'created_at'>; Update: Partial<SalesDesignVersionFile>; };
      change_requests: { Row: ChangeRequest; Insert: Omit<ChangeRequest,'id'|'created_at'|'updated_at'>; Update: Partial<ChangeRequest>; };
      site_readiness: { Row: SiteReadiness; Insert: Omit<SiteReadiness,'id'|'created_at'|'updated_at'>; Update: Partial<SiteReadiness>; };
      approval_links: { Row: ApprovalLink; Insert: Omit<ApprovalLink,'id'|'created_at'|'updated_at'>; Update: Partial<ApprovalLink>; };
      approval_link_events: { Row: ApprovalLinkEvent; Insert: Omit<ApprovalLinkEvent,'id'|'created_at'>; Update: Partial<ApprovalLinkEvent>; };
      containers: { Row: Container; Insert: Omit<Container,'id'|'created_at'|'updated_at'>; Update: Partial<Container>; };
      container_items: { Row: ContainerItem; Insert: Omit<ContainerItem,'id'|'created_at'>; Update: Partial<ContainerItem>; };
      container_documents: { Row: ContainerDocument; Insert: Omit<ContainerDocument,'id'|'created_at'>; Update: Partial<ContainerDocument>; };
      delivery_plans: { Row: DeliveryPlan; Insert: Omit<DeliveryPlan,'id'|'created_at'|'updated_at'>; Update: Partial<DeliveryPlan>; };
      punch_list_items: { Row: PunchListItem; Insert: Omit<PunchListItem,'id'|'created_at'|'updated_at'>; Update: Partial<PunchListItem>; };
      system_events: { Row: SystemEventRow; Insert: Omit<SystemEventRow,'id'|'created_at'|'processed_at'>; Update: Partial<SystemEventRow>; };
      prospects: { Row: Prospect; Insert: Omit<Prospect,'id'|'created_at'|'updated_at'>; Update: Partial<Prospect>; };
      prospect_contacts: { Row: ProspectContact; Insert: Omit<ProspectContact,'id'|'created_at'|'updated_at'>; Update: Partial<ProspectContact>; };
      prospect_locations: { Row: ProspectLocation; Insert: Omit<ProspectLocation,'id'|'created_at'|'updated_at'>; Update: Partial<ProspectLocation>; };
      opportunities: { Row: Opportunity; Insert: Omit<Opportunity,'id'|'created_at'|'updated_at'>; Update: Partial<Opportunity>; };
      opportunity_locations: { Row: OpportunityLocation; Insert: Omit<OpportunityLocation,'created_at'>; Update: Partial<OpportunityLocation>; };
      prospect_needs: { Row: ProspectNeed; Insert: Omit<ProspectNeed,'id'|'created_at'|'updated_at'>; Update: Partial<ProspectNeed>; };
      prospect_potentials: { Row: ProspectPotential; Insert: Omit<ProspectPotential,'id'|'created_at'|'updated_at'>; Update: Partial<ProspectPotential>; };
    };
    Enums: {
      user_role: UserRole;
      project_category: ProjectCategory;
      project_stage: ProjectStage;
      project_phase: ProjectPhase;
      doc_status: DocStatus;
      qc_result: QcResult;
      currency_type: CurrencyType;
      doc_type: DocType;
    };
  };
}
