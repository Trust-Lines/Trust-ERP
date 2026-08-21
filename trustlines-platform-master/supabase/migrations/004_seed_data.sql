-- ─────────────────────────────────────────────────────────────
-- Migration 004: Seed Data (demo users, clients, projects)
-- ─────────────────────────────────────────────────────────────
-- NOTE: Auth users must be created via Supabase Dashboard or
-- auth.admin API before these profiles can be inserted.
-- These UUIDs must match the auth.users IDs exactly.
-- ─────────────────────────────────────────────────────────────

INSERT INTO profiles (id, full_name, email, role, category_scope) VALUES
  ('f5dc0929-ab44-475a-807d-fcde883fc3be', 'Hamza Ghannom',   'hghannom@gmail.com',        'ops_manager',   NULL),
  ('00000000-0000-0000-0000-000000000002', 'Mr. T',            'mr.t@trust-lines.com',      'executive',     NULL),
  ('00000000-0000-0000-0000-000000000003', 'Beyza Aydın',      'beyza@trust-lines.com',     'pm_millwork',   ARRAY['M1','M2','M3','S1','S2','S3']::project_category[]),
  ('00000000-0000-0000-0000-000000000004', 'Ahmed Yılmaz',     'ahmed@trust-lines.com',     'pm_ceiling',    ARRAY['C1','C2','C3','I1','I2','I3']::project_category[]),
  ('00000000-0000-0000-0000-000000000005', 'Murat Şahin',      'murat@trust-lines.com',     'qc_responsible',NULL),
  ('00000000-0000-0000-0000-000000000006', 'T-Lines PM Demo',  'pm@t-lines.com',            'tlines_pm',     NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO clients (id, name, code) VALUES
  ('00000000-0000-0000-0000-000000000010', 'Kahve Dünyası', 'KD')
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (
  id, code, name, client_id, categories,
  current_stage, current_phase,
  deal_value, currency,
  ops_manager_id, tlines_pm_id, prod_pm_ms_id,
  est_delivery_date, closed_deal_date,
  dropbox_root_path
) VALUES (
  '00000000-0000-0000-0000-000000000020',
  'TL-260001-A',
  'Kahve Dünyası — Galataport',
  '00000000-0000-0000-0000-000000000010',
  ARRAY['M1','M2','C1']::project_category[],
  'item_plan',
  'item_documents',
  125000.00,
  'USD',
  'f5dc0929-ab44-475a-807d-fcde883fc3be',
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000003',
  '2026-09-15',
  '2026-05-20',
  '/Trust-Lines-Projects/TL-260001-A'
)
ON CONFLICT (id) DO NOTHING;
