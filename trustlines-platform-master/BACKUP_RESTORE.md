# Backup & Restore Strategy — Trust-Lines Platform

_Phase 9 deliverable. Last updated 2026-07-14 (schema version 061)._

The platform has two independent stores of truth. They are backed up differently and
must be restored together to reach a consistent state.

| Store | Contents | Mutable? | Primary backup |
|-------|----------|----------|----------------|
| **Supabase Postgres** | All records: projects, customers, suppliers, finance, production, workflow, audit, auth | Yes | Supabase automated backups + PITR |
| **Dropbox** (`/D-Projects`, `/Design`) | Every generated & uploaded file (plans, PFs, POs, proposals, receipts) | **No — immutable** | Dropbox version history + the immutability rule |

---

## 1. Database (Supabase Postgres)

### 1.1 Automated (primary)
- **Daily automated backups** are taken by Supabase for the project. Retention depends on
  the plan (typically 7 days on Pro).
- **Point-in-Time Recovery (PITR)** — where enabled, the database can be restored to any
  second within the retention window. This is the primary Recovery mechanism.
- **RPO** (max data loss): ≤ the PITR window granularity (seconds) where PITR is on;
  otherwise ≤ 24h (last daily backup).
- **RTO** (time to restore): minutes–hours via the Supabase dashboard restore flow.

### 1.2 Manual / off-site (secondary)
Take a periodic logical dump and store it off Supabase (e.g. encrypted object storage):

```bash
# Full logical backup (schema + data)
pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges -Fc -f trustlines-$(date +%F).dump

# Restore into a fresh database
pg_restore --no-owner --no-privileges -d "$TARGET_DB_URL" trustlines-YYYY-MM-DD.dump
```

The repo's `supabase/migrations/*.sql` are the schema source of truth (001 → 061) and are
idempotent/re-runnable, so a schema can always be rebuilt from the repo, then data loaded
from a dump.

### 1.3 In-app snapshot (tertiary, convenience)
**Settings → Backup & restore → Download backup (JSON)** (General Manager only) exports a
JSON snapshot of the core operational tables via `GET /api/admin/backup`.

- Purpose: a quick, human-readable, downloadable copy for spot-checks, migrations between
  environments, or a lightweight off-site copy. It is **not** a substitute for §1.1/§1.2.
- Coverage: role_definitions, clients/franchises/companies, customers (+contacts/addresses),
  projects (+notes/steps/stage_transitions), documents **(metadata only)**, suppliers,
  supplier_invoices, supplier_payments, trust_expenses, production_items, containers
  (+items), delivery_plans, punch_list_items, sales_design_jobs/versions, lead_intake,
  project_handovers.
- Excluded on purpose: `documents.form_data` / `pf_signatures` (heavy, may embed base64),
  and `auth.users` (managed by Supabase Auth — restore separately).
- Security: the snapshot aggregates vendor cost, margins and PF data → gated to
  `general_manager` only, and every download is written to the audit log
  (`admin.backup_downloaded`).

---

## 2. Documents (Dropbox)

Dropbox is treated as **write-once / immutable** by the platform (enforced in code, see
`AGENTS.md` + `lib/dropbox/*`): files are never deleted, never overwritten (always `add`
mode), never moved or renamed, and a project root is never rebuilt over an existing one.

Consequences for backup:
- Every revision is preserved as a new file/version — the store is self-versioning.
- Dropbox's own version history / file recovery covers accidental external changes.
- The DB holds the pointers (`documents.dropbox_path` / `dropbox_file_id` / `dropbox_rev`);
  restoring the DB re-links to the files already in Dropbox.

---

## 3. Restore procedure (full)

1. **Database**: restore Supabase from PITR/backup (§1.1), or rebuild schema from
   `supabase/migrations/*` then `pg_restore` a dump (§1.2).
2. **Auth**: Supabase Auth users are restored with the Supabase project restore; if
   rebuilding elsewhere, re-provision users and keep `profiles.id = auth.users.id`.
3. **Documents**: no action needed if the same Dropbox account is connected — the restored
   `documents` rows already point at the immutable files. If the Dropbox app/token changed,
   re-connect it in the Dropbox Wizard; paths are stable.
4. **Verify**: sign in as `general_manager`, open a few projects, confirm documents open,
   the production board loads, and `/projects/[id]/finance` totals render.

---

## 4. Schedule & ownership

- Supabase automated backups + PITR: continuous (platform-managed).
- Manual `pg_dump` off-site copy: **weekly**, retained 90 days (Ops).
- In-app JSON snapshot: **ad hoc** before risky migrations or bulk edits (General Manager).
- Restore drill: **quarterly** into a staging project to validate RTO/RPO.
