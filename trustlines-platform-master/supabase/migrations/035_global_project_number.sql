-- 035_global_project_number.sql
-- SINGLE global project number for ALL projects (Trust + Sales), replacing the
-- per-(region, service_line) counters. One starting number is set once; every new
-- project — regardless of company/region — takes the next number from this single
-- counter. The company + region still form the code PREFIX ("STW", "PSNE", …); only
-- the running number is now global. Correctable by an admin.
--
-- CONCURRENCY: numbers are handed out ONLY by reserve_global_number(), a single
-- atomic `UPDATE ... last_number = last_number + 1 ... RETURNING` — race-safe.

CREATE TABLE IF NOT EXISTS project_number_counter (
  id          INTEGER PRIMARY KEY DEFAULT 1,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_number_counter_single CHECK (id = 1)
);
INSERT INTO project_number_counter (id, last_number) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

ALTER TABLE project_number_counter ENABLE ROW LEVEL SECURITY;
-- no policies — access only via SECURITY DEFINER functions + role-gated routes.

-- Atomic claim of the next number (returns the assigned number).
CREATE OR REPLACE FUNCTION reserve_global_number() RETURNS INTEGER AS $$
DECLARE v INTEGER;
BEGIN
  UPDATE project_number_counter SET last_number = last_number + 1, updated_at = now()
   WHERE id = 1 RETURNING last_number INTO v;
  RETURN v;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Read-only: the number the next project will get (last_number + 1).
CREATE OR REPLACE FUNCTION peek_global_number() RETURNS INTEGER AS $$
  SELECT last_number + 1 FROM project_number_counter WHERE id = 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Admin correction: make the NEXT project get p_next (stores last_number = p_next-1).
CREATE OR REPLACE FUNCTION set_global_next_number(p_next INTEGER) RETURNS INTEGER AS $$
DECLARE v INTEGER;
BEGIN
  UPDATE project_number_counter SET last_number = GREATEST(COALESCE(p_next, 1) - 1, 0), updated_at = now()
   WHERE id = 1 RETURNING last_number INTO v;
  RETURN v + 1;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reserve_global_number()          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION peek_global_number()             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION set_global_next_number(INTEGER)  TO authenticated, service_role;

-- Remove the old per-(region, service_line) system.
DROP FUNCTION IF EXISTS reserve_project_number(TEXT, TEXT);
DROP FUNCTION IF EXISTS seed_project_sequence(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS peek_project_number(TEXT, TEXT);
DROP TABLE IF EXISTS region_service_sequences;
