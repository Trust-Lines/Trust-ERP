-- 092_prospect_contact_checklist_notes.sql — 2026-08-13
--
-- User showed a live ClickUp contact task screenshot and asked for our own contact
-- detail screen to be just as comprehensive: the real "Client Information progress"
-- checklist (10 items, each individually resolved/unresolved) AND the comment/activity
-- thread on the right (real conversation notes like "WhatsApp available, no chats
-- before" — these carry real information the team already verified, not decoration).
-- Both come from ClickUp endpoints we were not calling yet (GET /task/{id} for
-- checklists, GET /task/{id}/comment for comments) — still read-only, see
-- lib/clickup/client.ts's GET-only rule. Two new tables, RLS mirrors prospect_contacts'
-- own policy exactly (072/084) since both are one level below it in the same tree.

CREATE TABLE IF NOT EXISTS prospect_contact_checklist_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_contact_id  UUID NOT NULL REFERENCES prospect_contacts(id) ON DELETE CASCADE,
  checklist_name       TEXT NOT NULL,
  item_name            TEXT NOT NULL,
  resolved             BOOLEAN NOT NULL DEFAULT false,
  order_index          INT NOT NULL DEFAULT 0,
  external_source      TEXT,
  external_ref         TEXT,   -- ClickUp checklist item id
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pcci_dedupe
  ON prospect_contact_checklist_items (prospect_contact_id, external_ref)
  WHERE external_source IS NOT NULL AND external_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pcci_contact ON prospect_contact_checklist_items (prospect_contact_id, order_index);

CREATE TABLE IF NOT EXISTS prospect_contact_notes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_contact_id  UUID NOT NULL REFERENCES prospect_contacts(id) ON DELETE CASCADE,
  author_name          TEXT,
  body                 TEXT NOT NULL,
  source_created_at    TIMESTAMPTZ,
  external_source      TEXT,
  external_ref         TEXT,   -- ClickUp comment id
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pcn_dedupe
  ON prospect_contact_notes (prospect_contact_id, external_ref)
  WHERE external_source IS NOT NULL AND external_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pcn_contact ON prospect_contact_notes (prospect_contact_id, source_created_at DESC);

ALTER TABLE prospect_contact_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_contact_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prospect_contact_checklist_items_read ON prospect_contact_checklist_items;
CREATE POLICY prospect_contact_checklist_items_read ON prospect_contact_checklist_items
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospect_contacts pc
      JOIN prospects pr ON pr.id = pc.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pc.id = prospect_contact_checklist_items.prospect_contact_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS prospect_contact_checklist_items_write ON prospect_contact_checklist_items;
CREATE POLICY prospect_contact_checklist_items_write ON prospect_contact_checklist_items
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospect_contacts pc
      JOIN prospects pr ON pr.id = pc.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pc.id = prospect_contact_checklist_items.prospect_contact_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospect_contacts pc
      JOIN prospects pr ON pr.id = pc.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pc.id = prospect_contact_checklist_items.prospect_contact_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS prospect_contact_notes_read ON prospect_contact_notes;
CREATE POLICY prospect_contact_notes_read ON prospect_contact_notes
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospect_contacts pc
      JOIN prospects pr ON pr.id = pc.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pc.id = prospect_contact_notes.prospect_contact_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS prospect_contact_notes_write ON prospect_contact_notes;
CREATE POLICY prospect_contact_notes_write ON prospect_contact_notes
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospect_contacts pc
      JOIN prospects pr ON pr.id = pc.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pc.id = prospect_contact_notes.prospect_contact_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospect_contacts pc
      JOIN prospects pr ON pr.id = pc.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pc.id = prospect_contact_notes.prospect_contact_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );
