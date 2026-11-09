# T-ERP Mobil (T Holding)

Expo (SDK 58) app built from `../mobile-design/` (Trust Lines DS tokens). It has no backend of its own:
it signs in with the same Supabase accounts as the web platform and calls
`../trustlines-platform-master/app/api/*` with `Authorization: Bearer <supabase access token>`.

## Run

```bash
cp .env.example .env.local   # fill in Supabase URL / anon key and the platform URL
npm install
npx expo start               # scan with a dev build (expo-camera needs one)
```

On a phone, `EXPO_PUBLIC_API_URL` must be reachable from the phone (your LAN IP or the deployed platform).

Checks: `npm run typecheck`, `npm run lint`.

Install on an iPhone over USB (Release build, JS embedded — no Metro / Expo Go):

```bash
npx expo prebuild --platform ios
cd ios && xcodebuild -workspace TrustLines.xcworkspace -scheme TrustLines -configuration Release \
  -destination id=<device UDID> -derivedDataPath build -allowProvisioningUpdates -allowProvisioningDeviceRegistration build
xcrun devicectl device install app --device <CoreDevice id> build/Build/Products/Release-iphoneos/TrustLines.app
```

`EXPO_PUBLIC_*` values are baked in at build time — rebuild after changing `.env.local`.

## Layout

| Path | What |
|---|---|
| `src/ui/theme.ts` | DS tokens (same values as `mobile-mockups.html` `:root`) |
| `src/ui/icons.ts` | the mockup's icon set, copied verbatim |
| `src/ui/kit.tsx` | mockup building blocks: Card, Li/List, Chip, Ico, Btn, Seg, Field, Alert, Timeline… |
| `src/lib/` | Supabase client, `api()` (bearer), auth context, `useApi()` |
| `src/features/` | per-module types + shared parts (shift card, my-day, QC, containers) |
| `src/app/` | Expo Router screens; `(app)/` is behind sign-in |

## Screens (mockup number → route → API)

| Mockup | Route | API |
|---|---|---|
| 001 Giriş, 046 Şifre sıfırlama | `/login`, `/forgot-password` | Supabase auth, `POST /api/auth/forgot-password` |
| 002 / 050–053 Ana sayfa | `/` | `/api/mobile/me`, `/api/my-day`, `/api/hr/shift` |
| 016 Görevler | `/tasks` | `/api/my-day` |
| 003 / 017 / 062 / 004 Mesai | `/shift` | `GET/POST /api/hr/shift` (migration 144) |
| 015 / 030 Menü, profil | `/menu` | `/api/mobile/me` |
| 005 / 044 QR | `/scan` | platform links, container / booking numbers |
| 007 / 008 QC | `/qc`, `/qc/[itemId]` | `/api/qc/queue`, `/api/qc/inspections` |
| 009 / 024 Konteyner | `/containers`, `/containers/[id]` | `/api/containers…` |
| 014 Onaylar | `/approvals` | `/api/approvals/mine` (signing opens the web) |

Menu entries and home shortcuts follow the role's web page permissions (`pages` from `/api/mobile/me`);
every API still authorizes on its own.

## Not built yet

Waiting on open decisions (`../mobile-design/README.md`): geofence/shift rules, leave requests, item-QR
format, language, offline queue, label printer. Next slice: QC photos + checklist, document viewer and
in-app signing, expenses. Tablet layouts (`mobile-design/tablet/`) are not done; the phone layout runs on tablets.
