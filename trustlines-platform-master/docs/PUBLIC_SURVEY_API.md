# Public Survey API — Frontend Integration Contract

Phase 00.6 — Marketing Campaigns & Public Survey backend. This document is the contract
for whoever builds the **public survey frontend** (a separate app/deploy from this
repo). It covers the two public, unauthenticated endpoints only. Everything else in
Trust-Lines (login, `/marketing/campaigns/**`) is out of scope here.

## Base URL

The public API lives on **this** app (the internal Trust-Lines platform), not a separate
service:

```
{NEXT_PUBLIC_APP_URL}/api/public/campaigns
```

Example (production): `https://platform.trust-lines.com/api/public/campaigns`
Example (local dev): `http://localhost:3000/api/public/campaigns`

The **survey page itself** (`/survey/{slug}`) is expected to be built and hosted
separately, at a base URL controlled by `NEXT_PUBLIC_SURVEY_BASE_URL` (see
[Environment](#environment) below). The internal "Campaigns & Surveys" screen displays
and QR-codes exactly `{NEXT_PUBLIC_SURVEY_BASE_URL}/survey/{slug}` — wherever that
resolves to is where the survey frontend should live and read `{slug}` from its own
route.

## Endpoints

### `GET /api/public/campaigns/:slug`

No login. No cookies required. Returns only what a survey landing page needs to render
itself — nothing internal.

**Request**

```
GET /api/public/campaigns/atlanta-build-expo-2026
```

**Success response — `200`**

```json
{
  "campaign": {
    "slug": "atlanta-build-expo-2026",
    "name": "Visit our booth — Trust-Lines",
    "publicTitle": "Visit our booth — Trust-Lines",
    "publicDescription": "Tell us about your project and we'll follow up after the show.",
    "campaignType": "trade_fair",
    "city": "Atlanta",
    "country": "US",
    "startDate": "2026-09-10",
    "endDate": "2026-09-12",
    "defaultLanguage": "en",
    "consentTextVersion": "v1",
    "status": "active",
    "submissionOpen": true
  }
}
```

- `name` falls back to the campaign's internal name if `publicTitle` was never set —
  always safe to display as-is.
- `status` is one of `draft` / `active` / `paused` / `closed`. `submissionOpen` is a
  convenience boolean (`true` only when `status === "active"`) — use it to decide whether
  to show the form or a "not open yet" / "closed" message. The form should still call
  `POST .../submissions` on submit even if you don't gate on `submissionOpen`
  client-side — the server re-checks status regardless (see [Errors](#campaign-unavailable-errors)).
- **Never returned**: internal database id, owner, code, internal description, or any
  statistics. Do not expect them — they are deliberately absent, not just optional.

**Not found — `404`**

```json
{ "error": "Survey not found", "errorCode": "campaign_not_found" }
```

---

### `POST /api/public/campaigns/:slug/submissions`

No login. Creates (or reuses) a CRM Prospect from the survey response, entirely
server-side.

**Request**

```
POST /api/public/campaigns/atlanta-build-expo-2026/submissions
Content-Type: application/json
```

```json
{
  "leadType": "organization",
  "organizationName": "Acme Retail LLC",
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@acme.example",
  "phone": "+1 212 555 0100",
  "jobTitle": "Store Owner",
  "city": "Atlanta",
  "state": "GA",
  "country": "US",
  "preferredLanguage": "en",
  "hasActiveProject": true,
  "deadline": "2026-11-01",
  "layoutAvailable": false,
  "projectTypes": ["full_remodel"],
  "timing": "3_6_months",
  "notes": "Interested in a new storefront.",
  "consentAccepted": true,
  "consentTextVersion": "v1",
  "submissionToken": "a-client-generated-uuid-v4",
  "honeypot": ""
}
```

#### Supported fields

| Field | Type | Notes |
|---|---|---|
| `leadType` | `"organization"` \| `"person"` | Defaults to `organization` if omitted/invalid. |
| `organizationName` | string | Required when `leadType` is `organization`. |
| `firstName` / `lastName` | string | The respondent's name. Required (at least one, combined non-empty) when `leadType` is `person`; for `organization` this becomes the primary contact. |
| `email` | string | Used for de-duplication (case-insensitive). |
| `phone` | string | Used for de-duplication (digits-only compare). |
| `jobTitle` | string | Only used for `organization` leads (the contact's title). |
| `city` / `state` / `country` | string | Creates a Location on the Prospect. |
| `preferredLanguage` | string | Falls back to the campaign's default language if omitted. |
| `hasActiveProject` | boolean | Informational — no longer a classification input (see [Classification](#what-happens-after-a-submission)). |
| `deadline` | string (`YYYY-MM-DD`) | Informational. |
| `layoutAvailable` | boolean | Informational. |
| `projectTypes` | string[] | Any of `full_remodel`, `small_remodel`, `new_construction`, `bid`. Unknown values are silently dropped, not rejected. |
| `timing` | string | Any of `immediate`, `0_3_months`, `3_6_months`, `6_12_months`, `12_plus_months`, `no_current_project`, `contact_later`. `contact_later` is accepted but normalized away server-side (the survey has no follow-up-date picker). |
| `notes` | string | Free text. |
| `consentAccepted` | boolean | **Required, must be `true`.** See [Consent](#consent). |
| `consentTextVersion` | string | The version of the consent text the visitor saw/agreed to. Falls back to the campaign's configured version if omitted. |
| `submissionToken` | string | **Strongly recommended.** See [Idempotency](#idempotency). |
| `honeypot` | string | See [Anti-spam](#anti-spam-honeypot). |

#### Fields you must NOT send (and that are silently ignored if you do)

`source`, `campaignId`, `ownerId`, `classification`, `status`, or any other field not
listed above. The backend determines all of these itself from the campaign the slug
resolves to and from its own classification engine — sending them has **no effect**, they
are never read off the request body at all (not just validated-and-rejected).

#### Success response — `201`

```json
{ "ok": true, "submissionId": "a1b2c3d4-...", "status": "processed" }
```

`status` is one of:

| Status | Meaning |
|---|---|
| `processed` | A Prospect + project Need were created/updated normally. |
| `needs_review` | The email/phone matched more than one existing Prospect — a human needs to resolve it manually. Still a "successful" submission from the visitor's point of view; show a normal thank-you screen. |
| `rejected_spam` | The honeypot field was filled in. Still respond with a normal thank-you screen — never reveal spam detection to the caller. |

No internal Prospect ID, Need ID, or classification result is ever included in the
response — only `submissionId` (for your own idempotency bookkeeping) and `status`.

#### Consent

`consentAccepted` must be `true`, or the request is rejected outright with **no** row
created at all:

```json
{ "error": "Please accept the consent notice to submit.", "errorCode": "validation_error" }
```
— HTTP `400`.

#### Idempotency

Generate a random token (e.g. a UUID v4) **once per form session**, on page load — not
per submit-click — and send it as `submissionToken` on every attempt (including retries
after a network error or a double-tap on a slow connection). If the same
`submissionToken` is sent twice for the same campaign, the second call returns the exact
same `submissionId`/`status` as the first — no duplicate Prospect/Need is ever created.

#### Anti-spam (honeypot)

Include a form field named to match `honeypot` in the payload that is **invisible to a
real visitor** (e.g. `display:none`, off-screen positioning, or a field a screen reader
would skip) and that must be left **empty** by a human. Bots that fill in every field
will fill this one too. Leaving it empty (or omitting it) is the normal case.

#### Campaign-unavailable errors

| HTTP | `errorCode` | Meaning |
|---|---|---|
| 404 | `campaign_not_found` | The slug doesn't resolve to any campaign. |
| 409 | `campaign_not_open` | Campaign exists but is still in `draft`. |
| 409 | `campaign_paused` | Campaign is `paused`. |
| 409 | `campaign_closed` | Campaign is `closed` — permanently, no more submissions ever. |
| 429 | `rate_limited` | Too many submissions from this network in a short window — show a "please wait a moment and try again" message, not an error. Limits are generous (tens of submissions per 5 minutes) specifically so a shared trade-fair WiFi/NAT is never locked out by one busy booth. |
| 413 | `payload_too_large` | Request body exceeded 100KB — shouldn't happen with a normal form. |
| 400 | `invalid_body` / `validation_error` | Malformed JSON, or a required field failed validation (message is safe to show as-is). |
| 500 | `processing_error` / `unknown_error` | Something failed server-side. The message is always a generic "Something went wrong, please try again" — never a raw database/internal error. Safe to retry with the same `submissionToken`. |

Every error response has the shape `{ "error": "<safe message>", "errorCode": "<code>" }`.

### What happens after a submission

- A Prospect is found by exact email or phone match, or created fresh.
- A project "Need" is created and run through the **same classification engine** every
  internal Lead goes through. As of the current rule version, the only thing that turns a
  Need into a real Opportunity is an attached document/link (layout file, Matterport
  tour, reference link) — something the public survey doesn't currently collect — so
  **survey-originated Needs land as "Potential" by default**, to be picked up and
  qualified by a human. This is expected, not a bug.
- If the Prospect already existed, its **original** source/campaign attribution is never
  changed — only its "most recent touch" is updated to this campaign.

## CORS

Configure the survey frontend's real origin(s) via the `PUBLIC_SURVEY_ORIGINS`
environment variable on **this** app (comma-separated, no wildcard):

```
PUBLIC_SURVEY_ORIGINS=https://survey.trust-lines.com,https://external.trust-lines.com
```

If the survey frontend is served from the **same origin** as this app (e.g. both behind
`platform.trust-lines.com`), no CORS configuration is needed at all. If it's a different
origin, it must be listed here or the browser will block reading the response (the
request itself still reaches the server either way — CORS is a browser-side read
restriction, not a server-side auth mechanism).

Both endpoints answer `OPTIONS` preflight requests automatically.

## Environment

Variables relevant to the survey frontend integration (set on **this** app, not the
survey frontend):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SURVEY_BASE_URL` | Base URL the public survey link/QR code point to, e.g. `https://external.trust-lines.com`. Falls back to `NEXT_PUBLIC_APP_URL` if unset (so local dev works with zero config). |
| `PUBLIC_SURVEY_ORIGINS` | Comma-separated list of origins allowed to call `/api/public/campaigns/**` cross-origin. Empty = same-origin only. |

## Local testing

```bash
# 1. Create + activate a campaign from the internal UI (Marketing → Campaigns & Surveys →
#    New Campaign → Activate), or via the internal API as a logged-in Marketing user:
curl -X POST http://localhost:3000/api/marketing/campaigns \
  -H "Content-Type: application/json" -b "<your session cookie>" \
  -d '{"name":"ZZTEST Local","campaignType":"trade_fair","source":"trade_fair"}'
curl -X POST http://localhost:3000/api/marketing/campaigns/<id>/activate -b "<your session cookie>"

# 2. Read the public campaign info (no auth needed):
curl http://localhost:3000/api/public/campaigns/zztest-local

# 3. Submit a test response (no auth needed):
curl -X POST http://localhost:3000/api/public/campaigns/zztest-local/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "leadType": "organization",
    "organizationName": "ZZTEST Curl Co",
    "email": "zztest@example.com",
    "consentAccepted": true,
    "consentTextVersion": "v1",
    "submissionToken": "11111111-1111-1111-1111-111111111111"
  }'
```

A successful submission is visible immediately on the campaign's internal detail page
(`/marketing/campaigns/{id}`) under "Recent submissions" and in the Results stats.
