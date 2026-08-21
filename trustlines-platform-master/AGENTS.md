<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This repository uses a Next.js version with breaking changes. Before changing framework APIs, conventions, middleware/proxy behavior, caching, route handlers, or server/client boundaries, read the relevant guide under `node_modules/next/dist/docs/` and heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Trust-Lines Mandatory Engineering Rules

These rules are requirements, not suggestions.

## 1. Source hierarchy

Read `CLAUDE.md` first. Product behavior comes from `PROJECT-MASTER-PLAN.md`. Existing technical behavior comes from `SYSTEM_ARCHITECTURE.md`.

Do not use `TRUSTLINES_PLATFORM_IMPLEMENTATION.md` as an implementation source; it is retained only as historical context.

## 2. Business and visibility boundaries

- Trust Lines is the internal supply/production organization.
- T-Lines is the fixed corporate customer and owns Sales/PM customer relations.
- Customer means T-Lines’s real end customer.
- Do not treat current `clients` rows as end customers without auditing their actual usage.
- One business job has one `Project ID`.
- `tlines_pm` must never receive:
  - PF documents or internal PF fields
  - vendor purchase prices
  - internal cost calculations
  - margin data
  - private vendor notes

Enforce sensitive-field separation in RLS, API code, AI tools, exports, generated documents, email payloads, and UI rendering.

## Role authority model (2026-07-10)

- `general_manager` = **full system-wide authority**.
- `ops_manager` = **full Trust Lines operational authority**.
- `executive` = **removed / deprecated — must not be used in new code.** Migration 046 migrates existing
  `profiles.role = 'executive'` rows to `general_manager`. Any remaining `executive` string may only exist in
  historical applied migrations (001/002/004/020) as immutable history.

## 3. Authorization

- `createAdminClient()` bypasses RLS.
- Every service-role route must perform explicit authentication and authorization, preferably through `requireRole()`.
- Fail closed when a role or scope cannot be resolved.
- Hiding a UI element is not authorization.
- Public review links must use hashed tokens, expiry, revocation, scoped document access, idempotent decisions, and audit events.

## 4. Dropbox immutability

- Supabase Storage is not used.
- Never delete files or folders through application code.
- Never use unconditional Dropbox overwrite.
- Never move or rename existing files.
- Before creating a project root, detect whether it already exists.
- Use revision-conditional updates only where the existing approved workflow already requires a new Dropbox revision.
- Auto-sync imports PDFs only. Do not broaden it to DWG, XLSX, JPG, BAK, TMP, or other source files.

## 5. Performance and scale

The platform targets roughly 1,000 active projects and a 19 TB Dropbox share.

1. Never `select('*')` on `documents`.
2. Select explicit lightweight columns in lists.
3. Fetch heavy JSONB/base64 fields per document only when needed.
4. Filter hot paths by indexed columns.
5. Add an index in a new migration for every new frequent filter.
6. PostgreSQL does not automatically index foreign keys.
7. No N+1 queries. Fetch IDs in one query and group in memory.
8. Bound every cross-project query with an indexed filter and sane limit.
9. Reuse the role-permission cache in `lib/permissions/server.ts`.
10. Do not perform reconciliation or repair work on every page render.
11. Keep auto-sync and list endpoints idempotent and bounded.

## 6. Database and migrations

- Inspect the repository’s real highest migration number before creating the next migration.
- Never edit an already-applied migration to change production behavior.
- Add a new forward migration.
- Enable RLS on every new user-facing table.
- Add at least the required SELECT/write policies.
- Update `types/database.ts` and related domain types.
- The live `profiles.role` field is TEXT. Do not write migrations against a nonexistent `user_role` enum.
- For risky renames, first create a compatibility plan. Prefer additive migration and controlled backfill over destructive rename.
- Do not assume a migration was applied; handle and report deployment requirements explicitly.

## 7. API and writes

Every write must consider:

- input validation
- authentication
- role/scope authorization
- field-level visibility
- audit logging
- idempotency where repeated requests are possible
- useful error status and message
- notification side effects
- transaction/partial-failure behavior

## 8. UI requirements

Every new data screen must include:

- loading state
- empty state
- error state
- permission-aware actions
- accessible labels and keyboard behavior
- no fake/mock production data
- role-safe rendering of sensitive values

## 9. Verification

A task is not done until applicable checks pass:

```bash
npm run build
npm run lint
npm test
```

Use only scripts that exist in `package.json`.

For workflow changes, manually verify the relevant happy path and at least one denied/error path.

## 10. Documentation continuity

At the end of each completed task:

- update `PROJECT-MASTER-PLAN.md` CURRENT STATUS
- update NEXT TASKS
- append CHANGE LOG
- report changed files
- report migration files and whether they still need to be applied
- state the next task
