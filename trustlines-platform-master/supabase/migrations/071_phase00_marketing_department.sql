-- 071_phase00_marketing_department.sql — PHASE 00.2 Marketing Roles (cont.)
--
-- migration 066's profiles_department_check CHECK constraint is a closed list (Phase
-- 11.2). Every role in lib/permissions/catalog.ts DEFAULT_PERMISSIONS must map to a
-- department (lib/profile/metadata.ts defaultDepartmentForRole — pinned by
-- tests/profileMetadata.test.ts "covers EVERY role in the permission catalog"), and the
-- two new Phase 00 roles need a REAL department, not a reuse of 'sales' — the whole point
-- of Phase 00 is that Marketing and Sales are separate ownership (PHASE-00-...md §2).
-- Additive only: widens the CHECK, adds no column, touches no existing row.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_department_check;
ALTER TABLE profiles ADD  CONSTRAINT profiles_department_check
  CHECK (department IS NULL OR department IN
    ('sales','marketing','design','pm','supply','production','qc','warehouse','logistics','accounting','management'));
