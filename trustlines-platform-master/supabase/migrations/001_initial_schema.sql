-- ─────────────────────────────────────────────────────────────
-- Migration 001: Initial Schema
-- Trust-Lines Production & Delivery Platform
-- ─────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM (
  'ops_manager','executive','pm_millwork','pm_ceiling',
  'trustlines_pm','tlines_pm','qc_responsible','logistics','accounting'
);
CREATE TYPE project_category AS ENUM (
  'M1','M2','M3','S1','S2','S3','C1','C2','C3','I1','I2','I3'
);
CREATE TYPE project_stage AS ENUM (
  'closed_deal','finalization','shop_drawing','client_approval',
  'item_plan','item_list','boq','book','price_list',
  'po_bo_create','po_bo_signed',
  'pf_draft','pf_signed',
  'production','qc','packing',
  'shipment','delivered'
);
CREATE TYPE project_phase AS ENUM (
  'intake_design','item_documents','po_bo','pf','production','delivery'
);
CREATE TYPE doc_status AS ENUM (
  'draft','pending_approval','approved','rejected','signed','revised'
);
CREATE TYPE qc_result AS ENUM ('pass','fail','pending');
CREATE TYPE currency_type AS ENUM ('USD','EUR','TRY');
CREATE TYPE doc_type AS ENUM (
  'closed_deal_email','shop_drawing','item_plan','item_list','boq',
  'book','price_list','po_bo','pf','qc_checklist','packing_list',
  'shipment_doc','delivery_confirm'
);

-- ── PROFILES ──────────────────────────────────────────────────
CREATE TABLE profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  role           user_role NOT NULL,
  category_scope project_category[] DEFAULT NULL,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- ── CLIENTS ───────────────────────────────────────────────────
CREATE TABLE clients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  code       TEXT UNIQUE,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── PROJECTS ──────────────────────────────────────────────────
CREATE TABLE projects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT UNIQUE NOT NULL,
  name                  TEXT NOT NULL,
  client_id             UUID REFERENCES clients(id),
  site_location         TEXT,
  current_stage         project_stage NOT NULL DEFAULT 'closed_deal',
  current_phase         project_phase NOT NULL DEFAULT 'intake_design',
  categories            project_category[] NOT NULL,
  has_millwork_shelving BOOLEAN GENERATED ALWAYS AS (
    categories && ARRAY['M1','M2','M3','S1','S2','S3']::project_category[]
  ) STORED,
  has_ceiling_image     BOOLEAN GENERATED ALWAYS AS (
    categories && ARRAY['C1','C2','C3','I1','I2','I3']::project_category[]
  ) STORED,
  is_mixed_scope        BOOLEAN GENERATED ALWAYS AS (
    (categories && ARRAY['M1','M2','M3','S1','S2','S3']::project_category[])
    AND
    (categories && ARRAY['C1','C2','C3','I1','I2','I3']::project_category[])
  ) STORED,
  deal_value            NUMERIC(15,2),
  currency              currency_type DEFAULT 'USD',
  payment_terms         TEXT,
  margin_target_pct     NUMERIC(5,2),
  closed_deal_date      DATE,
  est_finalization_date DATE,
  est_production_start  DATE,
  est_delivery_date     DATE,
  hard_deadline         BOOLEAN DEFAULT FALSE,
  actual_delivery_date  DATE,
  ops_manager_id        UUID REFERENCES profiles(id),
  trustlines_pm_id      UUID REFERENCES profiles(id),
  tlines_pm_id          UUID REFERENCES profiles(id),
  prod_pm_ms_id         UUID REFERENCES profiles(id),
  prod_pm_ci_id         UUID REFERENCES profiles(id),
  qc_inspector_id       UUID REFERENCES profiles(id),
  clickup_task_id       TEXT,
  quickbooks_ref        TEXT,
  dropbox_root_path     TEXT,
  is_archived           BOOLEAN DEFAULT FALSE,
  scope_summary         TEXT,
  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- ── DOCUMENTS ─────────────────────────────────────────────────
CREATE TABLE documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  doc_type         doc_type NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  status           doc_status NOT NULL DEFAULT 'draft',
  dropbox_path     TEXT NOT NULL,
  dropbox_file_id  TEXT,
  dropbox_rev      TEXT,
  file_name        TEXT NOT NULL,
  file_size_bytes  INTEGER,
  mime_type        TEXT DEFAULT 'application/pdf',
  uploaded_by      UUID REFERENCES profiles(id),
  approved_by      UUID REFERENCES profiles(id),
  signed_by        UUID REFERENCES profiles(id),
  approved_at      TIMESTAMPTZ,
  signed_at        TIMESTAMPTZ,
  uploaded_at      TIMESTAMPTZ DEFAULT now(),
  branch           TEXT CHECK (branch IN ('ms','ci','combined')),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_documents_project_type
  ON documents(project_id, doc_type, status, version DESC);

-- ── DOCUMENT APPROVALS ────────────────────────────────────────
CREATE TABLE document_approvals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES projects(id),
  requested_by UUID REFERENCES profiles(id),
  approved_by  UUID REFERENCES profiles(id),
  status       TEXT CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  resolved_at  TIMESTAMPTZ
);

-- ── QC CHECKLISTS ─────────────────────────────────────────────
CREATE TABLE qc_checklists (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id           UUID REFERENCES documents(id),
  form_code             TEXT NOT NULL,
  overall_result        qc_result DEFAULT 'pending',
  sections              JSONB NOT NULL DEFAULT '[]',
  trustlines_rep_name   TEXT,
  trustlines_rep_signed BOOLEAN DEFAULT FALSE,
  trustlines_signed_at  TIMESTAMPTZ,
  customer_rep_name     TEXT,
  customer_rep_signed   BOOLEAN DEFAULT FALSE,
  customer_signed_at    TIMESTAMPTZ,
  conducted_by          UUID REFERENCES profiles(id),
  conducted_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- ── STAGE TRANSITIONS ─────────────────────────────────────────
CREATE TABLE stage_transitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_stage      project_stage,
  to_stage        project_stage NOT NULL,
  transitioned_by UUID REFERENCES profiles(id),
  is_override     BOOLEAN DEFAULT FALSE,
  override_reason TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── AUDIT LOG ─────────────────────────────────────────────────
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id),
  actor_id    UUID REFERENCES profiles(id),
  action      TEXT NOT NULL,
  resource    TEXT,
  old_value   JSONB,
  new_value   JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_project ON audit_log(project_id);
CREATE INDEX idx_audit_actor   ON audit_log(actor_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ── NOTIFICATIONS ─────────────────────────────────────────────
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id),
  project_id UUID REFERENCES projects(id),
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── PROJECT NOTES ─────────────────────────────────────────────
CREATE TABLE project_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES profiles(id),
  content     TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── SUPPLIERS ─────────────────────────────────────────────────
CREATE TABLE suppliers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  code       TEXT UNIQUE,
  category   project_category[],
  contact    JSONB,
  country    TEXT DEFAULT 'TR',
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── TRIGGERS ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── PROJECT CODE SEQUENCE ─────────────────────────────────────
CREATE SEQUENCE project_code_seq START 1001;

CREATE OR REPLACE FUNCTION generate_project_code()
RETURNS TEXT AS $$
DECLARE
  yr  TEXT := to_char(now(), 'YY');
  seq TEXT := lpad(nextval('project_code_seq')::TEXT, 4, '0');
  suf TEXT := chr(65 + (random() * 25)::int);
BEGIN
  RETURN 'TL-' || yr || seq || '-' || suf;
END;
$$ LANGUAGE plpgsql;
