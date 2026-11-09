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
cd ios && xcodebuild -workspace TERP.xcworkspace -scheme TERP -configuration Release \
  -destination id=<device UDID> -derivedDataPath build -allowProvisioningUpdates -allowProvisioningDeviceRegistration build
xcrun devicectl device install app --device <CoreDevice id> build/Build/Products/Release-iphoneos/TERP.app
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

## Screens (mockup number → route)

| Module | Mockups | Routes |
|---|---|---|
| Giriş | 001, 046, 047 (Face ID lock) | `/login`, `/forgot-password`, Menu toggle |
| Ana sayfa | 002, 050–053, 054 | `/` (shortcuts follow the role) |
| Ortak | 049, 056, 057–059, 032, 030 | `/search`, `/assistant`, `/team`, `/team/[id]`, `/notifications`, `/menu` |
| HR çalışan | 003, 017, 062, 004, 064, 048, 018, 034, 035, 033 | `/shift`, `/hr/requests`, `/hr/new-request`, `/hr/shifts` |
| HR yönetici | 019, 066, 067, 068 | `/hr/team`, `/hr/approvals`, `/hr/shifts` (Ekibim) |
| QR / ürün | 005, 006, 021, 044, 072, 020 | `/scan`, `/items/[id]`, `/search` |
| Kalite kontrol | 007, 008, 023, 036, 076, 077 | `/qc`, `/qc/[itemId]` (photos → Dropbox) |
| Lojistik | 009, 024, 010, 079, 080, 081, 083 | `/containers`, `/containers/new`, `/containers/[id]` |
| Depo | 084, 011, 039, 038 (shelf view), 087 | `/warehouse`, `/items/[id]`, `/calendar` |
| Saha / proje | 043, 027, 071, 042, 045, 012, 089, 091, 092, 093, 094, 088 | `/projects`, `/projects/[id]`, `/calendar`, `/installations` |
| Onay & finans | 014, 028, 096, 097, 029, 013, 099 | `/approvals`, `/approvals/[id]`, `/expenses`, `/expenses/new` |
| Satış | 101, 104, 105 | `/sales`, `/customers`, `/customers/[id]` (visit log), `/surveys` |

Not built (need a decision or hardware): geofence (061), kiosk (063), leave balance rules, label printing (026/075),
count sessions, offline queue (015/055), card OCR (102), employee documents (065), tablet two-pane layouts.

Menu entries and home shortcuts follow the role's web page permissions (`pages` from `/api/mobile/me`);
every API still authorizes on its own.

