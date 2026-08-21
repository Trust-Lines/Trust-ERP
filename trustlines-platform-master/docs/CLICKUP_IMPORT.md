# ClickUp → Trust-Lines Customer/Project Import

Scaffolding only right now — no import has run yet, no schema changes have been made.
The user's ClickUp holds "tüm müşterilerim tüm projelerim" (all customers, all projects)
and wants a one-time pull into this app's DB instead of manual re-entry, and to use
ClickUp's real field usage to sanity-check/extend our own `customers`/`projects` schema
before importing.

## Safety guarantee

Everything that talks to ClickUp is **read-only**. `lib/clickup/client.ts` only
implements `GET` wrappers — there is no create/update/delete-task helper anywhere in this
codebase, and there must never be one added casually. Nothing in ClickUp is ever
modified, moved, or deleted by this import. The worst case of a mistake here is wasted
time, never data loss — on either side (ClickUp is untouched; our own writes are
additive inserts, reversible by deleting the rows we added).

## Status

- [x] `lib/clickup/client.ts` — read-only API wrapper (teams/spaces/folders/lists/custom
      fields/tasks).
- [x] `scripts/clickup-discover.mts` — read-only discovery script. Walks the whole
      workspace, inspects any List whose name matches `customer|client|project|lead|deal|
      contact|account`, prints its custom field schema + a few sample tasks. Writes
      nothing to ClickUp or to our DB — only saves a local, gitignored JSON snapshot
      (`scripts/clickup-discovery-output.json`) for review.
- [ ] **Blocked on `CLICKUP_API_TOKEN`** (ClickUp → Settings → Apps → API Token) — user
      is providing this separately. Add it to `.env.local`, never commit it.
- [ ] Run discovery (`npm run clickup:discover`), read the output together with the user.
- [ ] Propose a field mapping (ClickUp custom field → `customers`/`projects` column) —
      **additive only**: new columns via `ADD COLUMN IF NOT EXISTS`, never a rename or
      drop of anything existing (CLAUDE.md rule). User approves before any migration is
      written.
- [ ] Write the mapping migration (next free number — check `supabase/migrations/`
      again at that point, don't trust this doc's number).
- [ ] Build the actual import as a **dry-run first**: read ClickUp, compute what WOULD be
      inserted/matched against existing `customers`/`projects`, print a summary, write
      NOTHING to Supabase until the user reviews and explicitly approves.
- [ ] Only after approval: real import run, using the same duplicate-detection philosophy
      as the rest of this app (advisory match, never silent overwrite/merge — see
      `lib/marketing/duplicates.ts` for the existing pattern to mirror).

## Local usage (once the token is set)

```bash
npm run clickup:discover
```
