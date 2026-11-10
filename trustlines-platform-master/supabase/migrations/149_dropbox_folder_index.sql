-- Dropbox Matching (admin): which Dropbox folder belongs to which project.
--
-- dropbox_folder_index — the folder tree of the connected Dropbox down to project folders (the
--   scan never goes inside a project folder, so a 20 TB drive stays a few thousand rows). Rebuilt
--   when the connected account or the scan roots change. Read-only copy of names; nothing in
--   Dropbox is changed by scanning.
-- dropbox_project_links — a person's decision per project: which folder (or "no folder"), who, when.
--
-- Service role only (RLS on, no policies): read and written by /api/admin/dropbox-matching.

CREATE TABLE IF NOT EXISTS dropbox_folder_index (
  path_lower    TEXT PRIMARY KEY,
  path_display  TEXT NOT NULL,
  name          TEXT NOT NULL,
  parent_lower  TEXT,
  depth         INT  NOT NULL,
  project_like  BOOLEAN NOT NULL DEFAULT FALSE,
  listed        BOOLEAN NOT NULL DEFAULT FALSE,
  scanned_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dropbox_folder_index_todo ON dropbox_folder_index (depth) WHERE NOT listed AND NOT project_like;
CREATE INDEX IF NOT EXISTS dropbox_folder_index_projects ON dropbox_folder_index (path_lower) WHERE project_like;
ALTER TABLE dropbox_folder_index ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS dropbox_project_links (
  project_id  UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('confirmed', 'no_folder')),
  path        TEXT,
  decided_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decided_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  note        TEXT
);
ALTER TABLE dropbox_project_links ENABLE ROW LEVEL SECURITY;

-- Scan bookkeeping (account, roots, progress) lives next to the change-feed cursor.
INSERT INTO dropbox_sync_state (id) VALUES ('folder_scan') ON CONFLICT (id) DO NOTHING;
