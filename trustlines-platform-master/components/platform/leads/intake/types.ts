import type { Dispatch, SetStateAction } from 'react';

export interface DocRow {
  id: string;
  category: string;
  dropbox_path: string;
  file_name: string;
  created_at: string;
}

export type Scope = { shelving: boolean; millwork: boolean; image: boolean; ceiling: boolean };
export type Notes = {
  shelving: string;
  millwork: string;
  image: string;
  ceiling: string;
  areas: string;
  client_special_request: string;
};
export type ChecklistItem = { id: string; text: string; done: boolean };

export interface FormState {
  company: string;
  region: string;
  service_line: string;
  project_type: string;
  customer_name: string;
  brand: string;
  customer_email: string;
  contact_person: string;
  contact_phone: string;
  industry: string;
  customer_address: string;
  street: string;
  city: string;
  state: string;
  scope_of_work: Scope;
  notes: Notes;
  matterport_link: string;
  priority: string;
  assignee_id: string;
  deal_size: string;
  source: string;
  follow_up_date: string;
  next_action: string;
  tags: string;
  checklist: ChecklistItem[];
}

export type SetForm = Dispatch<SetStateAction<FormState>>;

/** Props shared by every wizard step: the form, its setter and the footer navigation. */
export interface StepProps {
  form: FormState;
  setForm: SetForm;
  onBack: () => void;
  onNext: () => void;
}

export const EMPTY: FormState = {
  company: '',
  region: '',
  service_line: 'ST',
  project_type: '',
  customer_name: '',
  brand: '',
  customer_email: '',
  contact_person: '',
  contact_phone: '',
  industry: '',
  customer_address: '',
  street: '',
  city: '',
  state: '',
  scope_of_work: { shelving: false, millwork: false, image: false, ceiling: false },
  notes: { shelving: '', millwork: '', image: '', ceiling: '', areas: '', client_special_request: '' },
  matterport_link: '',
  priority: 'medium',
  assignee_id: '',
  deal_size: '',
  source: '',
  follow_up_date: '',
  next_action: '',
  tags: '',
  checklist: [],
};

export const WIZARD_STEPS = [
  { step: 1, title: 'Project setup', subtitle: 'Company, region & site' },
  { step: 2, title: 'Customer', subtitle: 'Customer & contact info' },
  { step: 3, title: 'Lead details', subtitle: 'Priority, source & follow-up' },
  { step: 4, title: 'Scope of work', subtitle: 'Shelving, millwork, images' },
  { step: 5, title: 'Additional notes', subtitle: 'Areas & client requests' },
  { step: 6, title: 'Dimensions & media', subtitle: 'Plans, photos & 360 link' },
  { step: 7, title: 'Checklist', subtitle: 'Subtasks & next steps' },
];
