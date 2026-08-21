-- 025_sales_marketing_roles.sql
-- Adds the "Sales & Marketing" team roles that sit BEFORE the Closed Deal stage.
-- This step adds ONLY the role layer: the regional scoping column these roles need.
-- No new tables, UI, pages, or opportunity/lead logic yet — those come in later,
-- separate steps.
--
-- ── NOTE ON ROLE STORAGE (important) ──────────────────────────────────────────
--   In this database, profiles.role is stored as TEXT and roles are registered in
--   the role_definitions table. There is NO `user_role` enum to alter — an attempt
--   to run `ALTER TYPE user_role ADD VALUE ...` here fails with
--   `type "user_role" does not exist`, confirming the text-based model. This matches
--   migration 016, which added the PF signer roles (production_manager, project_
--   manager, general_manager, accountant) the SAME way: role_definitions only, no
--   enum. Therefore the two new Sales roles are registered ONLY in role_definitions
--   (migration 026); this file just adds the column they need.
--
-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SECURITY BOUNDARY — DO NOT REMOVE / DO NOT WIDEN                             │
-- │                                                                             │
-- │ `sales_marketing_manager` and `sales_rep` form an ISOLATED module. They     │
-- │ must NOT see anything the production / finance / PM roles see:               │
-- │   • PF documents, margins, supplier prices                                   │
-- │   • the production board (production_items)                                  │
-- │   • approvals / documents / projects                                         │
-- │                                                                             │
-- │ Therefore, in THIS step they are DELIBERATELY:                              │
-- │   • NOT added to is_internal_role()                                          │
-- │   • NOT included in ANY existing RLS policy (projects, documents,           │
-- │     production_items, approvals, suppliers, …)                              │
-- │                                                                             │
-- │ Their only future data access will be the (not-yet-created) opportunity /   │
-- │ lead tables introduced in a later step, which will get their own dedicated  │
-- │ RLS policies scoped to these two roles. Until then, these roles can log in  │
-- │ and reach the dashboard but see none of the existing operational data.      │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Regional scoping for `sales_rep` — mirrors profiles.pm_client_id (migration 023).
-- A "region" is a client, exactly like the Client-PM model. We use a DEDICATED
-- column (sales_region_id) rather than reusing pm_client_id so the Sales module's
-- scope stays fully independent of the PM scope — the two role systems never
-- entangle, and future Sales RLS can filter on sales_region_id in isolation.
-- NULL = not region-scoped (e.g. sales_marketing_manager, who sees all regions).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sales_region_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_sales_region
  ON profiles(sales_region_id) WHERE sales_region_id IS NOT NULL;
