-- 027_region_service_sequences.sql
-- Per-(region, service_line) auto-incrementing project number, used by the Sales
-- Meeting/Intake form (Block 1). Each pair keeps its own running counter; the
-- first time a pair is used the operator seeds it with the last-used number from
-- the old Excel sheet, then every new project atomically claims the next number.
--
-- ── CONCURRENCY (hard requirement) ────────────────────────────────────────────
-- Numbers are handed out ONLY by reserve_project_number(), which does a single
-- atomic `UPDATE ... SET last_number = last_number + 1 ... RETURNING`. There is
-- NO read-then-write in the write path, so two intakes created at the same instant
-- for the same pair can NEVER receive the same number. peek_project_number() is a
-- read-only preview for the UI and never consumes a number.
--
-- ── SECURITY ──────────────────────────────────────────────────────────────────
-- RLS is ENABLED with NO permissive policies: direct client access is denied by
-- default. All access is through SECURITY DEFINER functions, called only from
-- role-gated API routes (requireRole([...])). Never add a broad write policy here.

CREATE TABLE IF NOT EXISTS region_service_sequences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region       TEXT NOT NULL,
  service_line TEXT NOT NULL,
  last_number  INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT region_service_sequences_uniq UNIQUE (region, service_line)
);

ALTER TABLE region_service_sequences ENABLE ROW LEVEL SECURITY;
-- (no policies on purpose — see header)

-- ── Atomic reserve: claim the next number for a pair ──────────────────────────
-- Single-statement UPDATE ... RETURNING — race-safe by construction. Returns the
-- newly claimed number, or NULL when the pair has not been seeded yet.
CREATE OR REPLACE FUNCTION reserve_project_number(p_region TEXT, p_service_line TEXT)
RETURNS INTEGER AS $$
DECLARE v_num INTEGER;
BEGIN
  UPDATE region_service_sequences
     SET last_number = last_number + 1,
         updated_at  = now()
   WHERE region = p_region AND service_line = p_service_line
  RETURNING last_number INTO v_num;
  RETURN v_num;  -- NULL when no row exists yet
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Seed a first-time pair with the last-used number from Excel ───────────────
-- Stores last_number = p_last_used, so the FIRST reserve returns p_last_used + 1.
-- Idempotent: if the pair already exists it is left untouched (never rewinds a
-- live counter). Returns the preview of the next number (last_number + 1).
CREATE OR REPLACE FUNCTION seed_project_sequence(
  p_region TEXT, p_service_line TEXT, p_last_used INTEGER
) RETURNS INTEGER AS $$
DECLARE v_last INTEGER;
BEGIN
  INSERT INTO region_service_sequences (region, service_line, last_number)
  VALUES (p_region, p_service_line, GREATEST(COALESCE(p_last_used, 0), 0))
  ON CONFLICT (region, service_line) DO NOTHING;

  SELECT last_number INTO v_last
    FROM region_service_sequences
   WHERE region = p_region AND service_line = p_service_line;

  RETURN v_last + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Read-only preview (never consumes a number) ───────────────────────────────
-- Returns last_number + 1, or NULL when the pair has not been seeded yet.
CREATE OR REPLACE FUNCTION peek_project_number(p_region TEXT, p_service_line TEXT)
RETURNS INTEGER AS $$
  SELECT last_number + 1
    FROM region_service_sequences
   WHERE region = p_region AND service_line = p_service_line;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reserve_project_number(TEXT, TEXT)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION seed_project_sequence(TEXT, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION peek_project_number(TEXT, TEXT)            TO authenticated, service_role;
