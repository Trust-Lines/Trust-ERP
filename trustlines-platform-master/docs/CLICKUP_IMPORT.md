# ClickUp → Trust-Lines Customer/Project Import

> ⚠️ Updated 2026-08-28 — this file previously said "scaffolding only, no import has run
> yet." That went stale: the full import (Contacts → Prospects, Opportunities, Potentials,
> checklist/notes, files, tags) has actually run and is live — see PROJECT-MASTER-PLAN.md's
> 2026-08-28 CHANGE LOG entry for migrations 087–104 for the real, current status.

The user's ClickUp holds "tüm müşterilerim tüm projelerim" (all customers, all projects)
and a one-time pull into this app's DB replaced manual re-entry, using ClickUp's real field
usage to sanity-check/extend our own `prospects`/`opportunities`/`prospect_potentials`
schema as it went (not `customers`/`projects` in the end — see the Status section).

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
- [x] `CLICKUP_API_TOKEN` provided and set in `.env.local`.
- [x] Discovery run, output reviewed with the user.
- [x] Field mapping proposed and approved — landed as `prospects`/`opportunities`/
      `prospect_potentials` columns (Marketing's existing pipeline), **not**
      `customers`/`projects` as originally scoped above. Additive only throughout
      (migrations 088, 094, 096, 097, 098, 099, 100, 104) — nothing renamed or dropped.
- [x] Contacts import — `scripts/clickup-import-dry-run.mts` then
      `scripts/clickup-import-write.mts`: real ClickUp Contacts → `prospects` +
      `prospect_contacts`, dedupe by `external_ref`.
- [x] Opportunities + Potentials import — `scripts/clickup-import-opportunities.mts`: the
      real "Opportunities NE" board (176 tasks) → `opportunities` + `prospect_potentials`,
      full Status OP → stage mapping (migration 103 added the one missing value,
      `working_on_it_trust`, after it was found silently dropping rows).
- [x] Checklist + comment/note threads — `scripts/clickup-import-contact-details.mts`
      (contacts) and inline in the opportunities import (needs), matching ClickUp's own
      "Client Information progress" checklist and comment thread.
- [x] Field-parity backfills — `scripts/backfill-clickup-field-parity.mts`,
      `backfill-deal-field-parity.mts`, `backfill-external-project-code.mts`,
      `backfill-opportunity-notes.mts`, `backfill-opportunity-region-contact.mts`,
      `backfill-potential-stage-labels.mts`, `backfill-primary-contact-on-needs.mts` — run
      after each parity gap was found by comparing our screens against live ClickUp
      screenshots side by side.
- [x] Real import run — completed; duplicate detection used the advisory-match philosophy
      (`lib/marketing/duplicates.ts`), never silent overwrite/merge.
- [ ] Not done: a full re-verification pass confirming every ClickUp field has a home (the
      backfills above were reactive, found one gap at a time — a deliberate side-by-side
      audit of the complete field list has not been done as a single pass).

## Local usage (once the token is set)

```bash
npm run clickup:discover
```
