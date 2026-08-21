import { z } from 'zod';

export const newProjectSchema = z.object({
  name:                 z.string().min(3, 'At least 3 characters').max(120),
  project_code:         z.string().min(2, 'Project code required').max(50),
  closed_deal_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  site_location:        z.string().min(2, 'At least 2 characters').max(200),
  client_id:            z.string().uuid('Select a client'),
  client_franchise_id:  z.string().uuid().optional(),
  client_company_id:    z.string().uuid().optional(),
  tlines_pm_id:         z.string().uuid('Select a T-Lines PM'),
  categories:           z.array(z.string()).min(1, 'Select at least one category'),
  deal_value:           z.number().positive().optional(),
  currency:             z.enum(['USD', 'EUR', 'TRY']),
  est_delivery_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  clickup_task_id:      z.string().optional(),
  quickbooks_ref:       z.string().optional(),
  dropbox_section:      z.string().min(1, 'Select a section'),
  dropbox_region:       z.string().min(1, 'Select a region'),
  dropbox_status:       z.enum(['Under Working', 'Done']),
  dropbox_client_type:  z.enum(['Clients', 'Individuals']),
  dropbox_client_name:  z.string().optional(),
  trustlines_pm_id:     z.string().uuid('Select a Trust-Lines PM'),
  qc_inspector_id:      z.string().uuid().optional(),
});

export type NewProjectFormValues = z.infer<typeof newProjectSchema>;
