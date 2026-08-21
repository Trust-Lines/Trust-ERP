# AUDIT — Phase 00 (Marketing, Lead Cloud & Opportunity Origination)

> Read-only audit. No migration, no rename, no code change in this pass.
> Scope: `lead_intake` + everything Phase 00 §3 says must be audited first
> (lead status/deliver flow, customer linking, Sales Design, meetings/follow-ups/
> tasks, duplicate logic, source/campaign fields, permissions/RLS, live migration state).

Date: 2026-07-22 · Method: full read of `PHASE-00-MARKETING-LEAD-OPPORTUNITY-ORIGINATION.md`
+ all 20 migrations touching `lead_intake`/`lead_tasks`/`lead_activity`/`lead_watchers`
+ `lib/sales/*` + the intake/deliver/archive API routes + `lib/permissions/catalog.ts`.

---

## 1. What "a Lead" actually is today (the load-bearing fact)

There is **no `leads` table**. A lead is **one `lead_intake` row 1:1-anchored to a
`projects` row** (`lead_intake.project_id UUID UNIQUE REFERENCES projects(id)`,
migration 029). The anchor is created **eagerly**, not at Closed Won:

`PATCH /api/leads/[id]/intake` (autosave) — the moment `region + service_line +
customer_name + city + state` ("Block 1") are all filled in, it:

1. calls `reserve_global_number()` — burns one slot of the **single global project
   number sequence** (migration 035), never released,
2. **creates real Dropbox folders** on the live 19 TB share (`createProjectFolders`),
3. inserts a `projects` row with `is_draft: true`.

`deliverLeadToTrust()` (Closed Won) does **not create a second project** — it flips
the SAME draft row `is_draft: false`, stamps `delivered_to_trust_at`, advances the
stage, and emits `lead.closed_won` (Phase 10's A1: opens handover, notifies both PMs).

**🔴 This is the central compatibility risk for Phase 00.** The master-plan's model
(Marketing captures a Prospect → nurtures a Potential → Sales works an Opportunity →
Closed Won "creates or activates one Project ID") assumes **no Project exists before
Closed Won**. Today's system already creates a real project number + live Dropbox
folders **the instant a trade-show contact's company name + city are typed in** —
before there is any Opportunity, before Sales has even looked at it. If Marketing's
new fuar/tablet intake (§4) or Prospect capture (§3) reuses this endpoint or its
side-effect, every booth conversation that never becomes a deal still burns a
project number and leaves an empty Dropbox folder tree behind (folders are
IMMUTABLE — AGENTS.md §4 — so these can never be cleaned up).
→ **Open decision, not mine to make unilaterally — see §7.**

## 2. `lead_intake` — full column inventory (from the 20 migrations, not the docs)

| Added by | Columns |
|---|---|
| 029 | `id, project_id (UNIQUE→projects), lead_ref, region, client_id (→clients), service_line, project_number, address, scope_of_work JSONB, notes JSONB, matterport_link, is_delivered, created_by, updated_at, created_at` |
| 030 | `lead_intake_documents` (child table — plan/layout files, category, dropbox_path) |
| 032 | `customer_name, brand, customer_email, contact_person, contact_phone, industry, city, street, state, opportunity_status TEXT` (CHECK, 4 values then) |
| 033 | `customer_address` (composed display field) |
| 034 | `project_type` |
| 036 | `priority, assignee_id (→profiles), deal_size, source TEXT (free text!), follow_up_date, next_action, tags TEXT[]` |
| 037 | `lead_activity` (child table — change/comment feed) |
| 038 | `checklist JSONB` (subtasks baked into the row) |
| 039 | `lead_watchers` (child table) |
| 040 | `is_archived, deleted_at` (soft-delete + 30-day trash) |
| 041/042 | `lead_tasks` (child table — ClickUp-style subtasks, `completed_at`) |
| 043 | RLS re-alignment (still sales-only, see §5) |
| 044 | `opportunity_status` CHECK expanded to **7** values (final list below) |
| 048 | `customer_id` (→`customers`, migration 045) |

**`opportunity_status` today (flat, no Prospect/Opportunity split):**
`new_opportunity → ready_to_start → modification_request → working_on_it_trust →
design_proposal_sent → waiting_from_op → contract_stage`
(`components/platform/leads/types.ts STATUS_ORDER` — UI is the source of truth for order/labels.)

**🔴 No "Closed Lost" state and no loss reason anywhere.** `is_archived` is a
generic soft-delete/trash toggle (`POST /api/leads/[id]/archive`), reused for
"this lead is dead" and for ordinary cleanup alike — there is no
`closed_reason` field the way Phase 00 §3 `opportunities.closed_reason` expects.
"Closed Won" = `is_delivered = true` (a boolean, not a stage value).

**`source` is free TEXT**, not a linked `marketing_sources` row — confirms Phase
00 §3's `marketing_sources/campaigns/events` attribution tables are genuinely new,
nothing to migrate data *from*, only a value to optionally backfill *into*.

## 3. What Phase 1–2 already built that Phase 00 §8 (Closed Won conversion) can reuse as-is

This is good news — most of §8's steps already exist and are tested/live:

- **Prospect → Customer**: `customers`, `customer_contacts`, `customer_addresses`
  (migrations 045/049) + `POST /api/leads/[id]/link-customer` (link existing /
  create-from-lead / unlink) + `CustomerLinkCard` UI + case-insensitive duplicate-name
  guard on create. `lead_intake.customer_id` and `projects.customer_id` already
  propagate on deliver (§ of `deliverLeadToTrust`, line 62-65 above).
- **PM Handover**: `project_handovers` (migration 050) + A1 automation already opens
  it automatically on `lead.closed_won`.
- **Idempotency**: `deliverLeadToTrust` already checks `is_delivered` and no-ops
  (`alreadyDelivered: true`) on a repeat call — the exact idempotency §8 asks for.
- **Approved Sales Design pointer → project**: already built (Phase 10.6,
  `linkDesignFilesToProject`, `doc_type='sales_design'` pointers).

None of this needs to be rebuilt. Only the **front half** (Prospect/Potential/
Opportunity, before today's lead_intake row exists) is genuinely new.

## 4. Sales Design overlap

`sales_design_jobs` (migration 051) is created **only** when `opportunity_status`
becomes `working_on_it_trust`, via `ensureDesignJobForLead()` (idempotent, one live
job per lead). Phase 00's `opportunities.stage` enum includes `sales_design` as one
stage among many (`discovery → sales_design → proposal → negotiation → closed_won`).
**These two need to line up 1:1** — either `sales_design` stage IS the trigger
condition (replacing the `working_on_it_trust` string match), or the compatibility
column keeps the existing trigger untouched and `stage='sales_design'` is a derived
label, never a second source of truth. Not deciding here — flagged for §00.1.

## 5. Permissions / RLS — nothing marketing-shaped exists

- `lib/permissions/catalog.ts` `PAGE_ROUTES`: no `page.leads`, no `page.marketing`,
  no `page.prospects`. (The Sidebar today shows "Leads" gated with `bypassPerm`
  because `page.leads` was never actually added to the catalog — a pre-existing
  gap, not something Phase 00 caused.)
- `lib/sales/roles.ts`: `SALES_INTAKE_ROLES = [sales_rep, sales_marketing_manager,
  ops_manager, general_manager]`. **No `marketing_pr` / `marketing_manager` role
  exists anywhere** — role_definitions, DEFAULT_PERMISSIONS, nothing.
- `lead_intake` RLS (029, realigned 043): **only** `created_by = auth.uid()` OR
  `role = 'sales_marketing_manager'`. A brand-new `marketing_pr` role would see
  **zero rows** under current RLS — needs its own policy, not a reuse of the
  sales one (Marketing owns Prospects, which are pre-Sales; the existing policy's
  shape doesn't distinguish "my lead" the same way a Prospect-owner would need).
- `lib/sales/leadAccess.ts` object-level check (`canAccessLead`) mirrors the RLS
  shape (service-role bypasses RLS, so this is the *real* enforcement for
  `/api/leads/[id]/*`) — a Prospect equivalent will need its own `assertProspectAccess`.

## 6. Duplicate detection today

Only exists at **Customer creation** (case-insensitive exact-name guard, 409 on
collision) — nothing at lead/prospect capture time. Phase 00 §5's "duplicate
suggestion" (normalized org name + email + phone + website domain, suggestion
only, never auto-merge) is entirely new work, no existing logic to extend.

## 7. Decisions (resolved with the user, 2026-07-22)

1. **When does a `projects` row + global number + Dropbox folders get created?**
   **DECIDED: at Opportunity `sales_accepted`**, not at first Marketing contact.
   Marketing's Prospect/Potential layer (§00.3/00.4, including the fuar/tablet
   intake §4) never touches the project sequence, `projects` table, or Dropbox.
   The existing Block-1-complete trigger in `PATCH /api/leads/[id]/intake` moves
   to fire when a new `opportunities` row transitions into `sales_accepted` —
   implementation detail for §00.5, not done in this audit pass.

2. **Is `lead_intake` the Opportunity record, or a new parallel table?**
   **DECIDED: build a new, separate `opportunities` table**, per PHASE-00 §3's
   literal schema — NOT an extension of `lead_intake`. This was the audit's
   secondary recommendation (extending `lead_intake` was the lower-risk option);
   the user chose the schema-faithful path instead. Recorded here so §00.5 does
   not re-litigate it. **Implication for later phases (flagging now, building
   nothing yet):**
   - `sales_design_jobs`' trigger (`ensureDesignJobForLead`, keyed off
     `lead_intake.opportunity_status = 'working_on_it_trust'`) will need to key
     off the NEW `opportunities.stage = 'sales_design'` instead once Opportunities
     exist — `lead_intake` does not disappear (§12 forbids deleting it) but stops
     being the row Sales Design watches.
   - `deliverLeadToTrust()` / Closed Won conversion (§8) will need a NEW code path
     off `opportunities.stage → closed_won`, separate from today's
     `lead_intake.is_delivered` flip — the existing one keeps working for any
     `lead_intake` rows already in flight during the transition (§9 backfill plan).
   - Customer linking (`link-customer` API, `CustomerLinkCard`) is reusable
     as-is — it operates on `customers`/`customer_contacts`, not on `lead_intake`'s
     shape, so it attaches to `opportunities` the same way.
   - A **controlled backfill plan** (§12's own requirement) is now REQUIRED, not
     optional: every live `lead_intake` row needs an `opportunities` row created
     for it (mapping `opportunity_status` → `stage` per the table below) so
     existing/in-flight leads don't fall through a crack between the two tables.

3. **`opportunity_status` → `opportunities.stage` mapping** (for the backfill and
   for keeping the two in sync going forward — build this table in §00.5):

   | `lead_intake.opportunity_status` (today) | `opportunities.stage` (new) |
   |---|---|
   | `new_opportunity` | `sales_accepted` (already Sales-owned today — see note) |
   | `ready_to_start` | `sales_accepted` |
   | `modification_request` | `discovery` |
   | `working_on_it_trust` | `sales_design` |
   | `design_proposal_sent` | `proposal` |
   | `waiting_from_op` | `proposal` |
   | `contract_stage` | `negotiation` |
   | `is_delivered = true` | `closed_won` |
   | `is_archived = true` (no live equivalent) | `closed_lost` (reason unknown — backfill as `closed_reason: 'unspecified (migrated)'`) |

   Note: every live `lead_intake` row today is already past Marketing entirely
   (there was no Marketing stage) — so the backfill's earliest mapped stage is
   `sales_accepted`, never `new`/`marketing_qualification`/`sales_handoff`. Those
   earlier stages only start populating going forward, from real Prospect/
   Opportunity records created by the new Marketing flow.

4. **Closed Lost** did not exist as a concept before this phase (only generic
   archive). Pure addition on the new `opportunities.closed_reason` — no
   migration risk, nothing to preserve.

## 8. Compatibility map (Phase 00 §3 model → what exists today)

| Phase 00 concept | Today | Verdict |
|---|---|---|
| Lead / **Prospect** (pre-Opportunity, Marketing-owned) | Does not exist — `lead_intake` already implies an Opportunity-shaped record | **NEW** — `prospects` + `prospect_contacts` + `prospect_locations`, fully additive, no project/Dropbox side-effects |
| **Potential** (future possibility) | Does not exist | **NEW** — `prospect_potentials`, additive |
| **Opportunity** (real ticketed need) | `lead_intake` (mislabeled "lead", is actually Opportunity-shaped: status/assignee/deal_size/source) — stays, untouched, forever (§12 forbids deletion) | **NEW, separate `opportunities` table** per PHASE-00 §3's schema (decided §7.2). `lead_intake` remains live for in-flight rows; backfilled per the mapping in §7.3; Sales Design trigger + deliver flow both need a NEW code path pointed at `opportunities.stage` (§7.2) |
| **Customer** | `customers`/`customer_contacts`/`customer_addresses` (Phase 1, migrations 045/049) — real, live, tested | **REUSE AS-IS** — attaches to `opportunities` the same way it attaches to `lead_intake` today |
| **Project** | `projects`, draft-anchored at Block-1-complete, flipped real at Closed Won | **REUSE AS-IS** for the flip mechanism; **trigger point moves to `opportunities.stage = 'sales_accepted'`** (decided §7.1) |
| Marketing attribution (source/campaign/event) | `lead_intake.source` = free TEXT only | **NEW** — `marketing_sources/campaigns/events`, additive columns |
| Sales handoff (Marketing → Sales) | Does not exist (Sales already owns the row from row 1 today) | **NEW** process, sits between Prospect capture and the new `opportunities` table |
| Marketing roles | Do not exist | **NEW** — `marketing_pr`, `marketing_manager` + new RLS (§5) |

## 9. No destructive action taken

- No table created, renamed, or dropped.
- No migration written.
- `lead_intake` and its four child tables (`lead_intake_documents`, `lead_tasks`,
  `lead_activity`, `lead_watchers`) are untouched and fully intact.

## Next

§00.1 Compatibility Map, §00.2 Marketing Roles, and §00.3 Prospect Core are all
COMPLETE (migrations 070–072, applied and live-verified). The Marketing UI was then
redesigned around a guided **Lead Capture wizard** with real product language (Lead
Cloud / Lead / Potential / Opportunity, `prospects` stays the technical name) and a
`classifyLead()` engine — migration **073**, also applied and live-verified. Next task
is §00.4 Potentials & Nurture — `prospect_potentials`, target contact dates, reminders,
My Day (`potentials_due`/`nurture_overdue` go from pending to real), and the
convert-to-Opportunity action (the Opportunity table itself is §00.5).
