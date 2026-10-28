export interface Customer {
  id: string; name: string; code: string | null; industry: string | null;
  email: string | null; phone: string | null; website: string | null; tax_id: string | null;
  status: string; notes: string | null; is_archived: boolean; created_at: string; updated_at: string;
}
export interface Contact {
  id: string; customer_id: string; name: string; title: string | null; role_type: string | null;
  email: string | null; phone: string | null; is_primary: boolean; is_authorized_approver: boolean;
  notes: string | null; created_at: string;
}

export interface Address {
  id: string; customer_id: string; label: string | null; address_type: string | null;
  line1: string | null; line2: string | null; city: string | null; state: string | null;
  postal_code: string | null; country: string | null; is_primary: boolean; notes: string | null; created_at: string;
}
export interface ProjectRow { id: string; code: string; name: string; current_stage: string | null; current_phase: string | null; is_draft: boolean }
export interface Meeting {
  id: string; title: string; meeting_type: string | null; meeting_at: string;
  location: string | null; attendees: string | null; notes: string | null; outcome: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  meet_url?: string | null; // Google Meet link when the meeting was sent as a Google invite (migration 130)
}
export interface FollowUp {
  id: string; note: string; due_date: string; assignee_id: string | null;
  status: 'open' | 'done' | 'cancelled'; completed_at: string | null;
}
export interface Assignee { id: string; full_name: string }

export const MEETING_TYPES = ['discovery', 'site_visit', 'presentation', 'handover', 'other'];
export const cap = (s: string) => s.replace(/_/g, ' ');
export const todayISO = () => new Date().toISOString().slice(0, 10);

export const ROLE_TYPES = ['owner', 'general_manager', 'project_manager', 'architect', 'site_manager', 'purchasing', 'accounting', 'authorized_approver'];

export const ADDRESS_TYPES = ['site', 'billing', 'mailing', 'other'];
