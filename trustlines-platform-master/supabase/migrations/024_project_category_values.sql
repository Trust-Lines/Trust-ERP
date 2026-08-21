-- 024_project_category_values.sql
-- Per-type estimated value on a project (Millwork $1000, Image $10000, …).
-- deal_value stays as the total (sum of the per-type values).

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS category_values JSONB NOT NULL DEFAULT '{}'::jsonb;
