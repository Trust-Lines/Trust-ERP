-- Migration 007: Simplify project stages to match actual workflow
-- Old stages: closed_deal, finalization, shop_drawing, client_approval,
--   item_plan, item_list, boq, book, price_list, po_bo_create, po_bo_signed,
--   pf_draft, pf_signed, production, qc, packing, shipment, delivered
-- New stages: closed_deal, finalization, client_approval, production, delivered
-- Old phases: intake_design, item_documents, po_bo, pf, production, delivery
-- New phases: intake_design, production, delivery

-- 1. Temporarily convert ENUM columns to TEXT
ALTER TABLE projects          ALTER COLUMN current_stage TYPE TEXT;
ALTER TABLE projects          ALTER COLUMN current_phase TYPE TEXT;
ALTER TABLE stage_transitions ALTER COLUMN from_stage   TYPE TEXT;
ALTER TABLE stage_transitions ALTER COLUMN to_stage     TYPE TEXT;

-- 2. Migrate old stage values → new values
UPDATE projects SET current_stage = 'production'
  WHERE current_stage IN (
    'shop_drawing','item_plan','item_list','boq','book','price_list',
    'po_bo_create','po_bo_signed','pf_draft','pf_signed','qc','packing'
  );
UPDATE projects SET current_stage = 'delivered' WHERE current_stage = 'shipment';

UPDATE stage_transitions SET from_stage = 'production'
  WHERE from_stage IN (
    'shop_drawing','item_plan','item_list','boq','book','price_list',
    'po_bo_create','po_bo_signed','pf_draft','pf_signed','qc','packing'
  );
UPDATE stage_transitions SET from_stage = 'delivered' WHERE from_stage = 'shipment';
UPDATE stage_transitions SET to_stage = 'production'
  WHERE to_stage IN (
    'shop_drawing','item_plan','item_list','boq','book','price_list',
    'po_bo_create','po_bo_signed','pf_draft','pf_signed','qc','packing'
  );
UPDATE stage_transitions SET to_stage = 'delivered' WHERE to_stage = 'shipment';

-- 3. Migrate old phase values → new values
UPDATE projects SET current_phase = 'intake_design'
  WHERE current_phase IN ('item_documents','po_bo','pf');

-- 4. Drop old ENUM types
DROP TYPE IF EXISTS project_stage CASCADE;
DROP TYPE IF EXISTS project_phase CASCADE;

-- 5. Create new, clean ENUM types
CREATE TYPE project_stage AS ENUM (
  'closed_deal',
  'finalization',
  'client_approval',
  'production',
  'delivered'
);

CREATE TYPE project_phase AS ENUM (
  'intake_design',
  'production',
  'delivery'
);

-- 6. Restore columns to new ENUM types
ALTER TABLE projects
  ALTER COLUMN current_stage TYPE project_stage USING current_stage::project_stage,
  ALTER COLUMN current_phase TYPE project_phase USING current_phase::project_phase;

ALTER TABLE stage_transitions
  ALTER COLUMN from_stage TYPE project_stage USING from_stage::project_stage,
  ALTER COLUMN to_stage   TYPE project_stage USING to_stage::project_stage;
