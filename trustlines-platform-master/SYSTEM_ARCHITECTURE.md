# Trust-Lines Platform — Mevcut Sistem Mimarisi

> **Belge rolü:** Bu dosya mevcut çalışan kodun teknik mimarisini ve korunacak davranışlarını açıklar.
>
> **Ürün hedefi ve yeni iş akışı için ana kaynak:** `PROJECT-MASTER-PLAN.md`
>
> Bu dosyadaki eski `client` ifadeleri mevcut kod/tablo adlarını tarif edebilir. İş anlamında:
>
> - Trust Lines = iç supply / production / operations
> - T-Lines = sabit kurumsal müşteri; Sales ve PM ilişkileri
> - Customer / End Customer = T-Lines'ın gerçek müşterisi
>
> `clients` veya `client_companies` tabloları audit edilmeden end-customer tablosu gibi yorumlanmamalı ve doğrudan rename edilmemelidir.
>

> Bu doküman, ChatGPT veya başka biriyle projeyi tartışmak için hazırlanmış **detaylı ve uzun** bir özettir. Kod tabanının tamamı (263 kaynak dosya, 44 migration, ~75 API route, `SYSTEM_ARCHITECTURE.md`) incelenerek yazılmıştır.
>
> Hazırlanma tarihi: 2026-07-10 · Konum: `C:\Users\Trust\Desktop\Trust\trustlines-platform`

---

## İÇİNDEKİLER

1. Proje Nedir? (Genel Bakış)
2. İş Bağlamı ve Kullanıcılar
3. Teknoloji Yığını (Tam Liste)
4. Mimari Felsefe (3 Temel İlke)
5. Dizin Yapısı
6. Kimlik Doğrulama & 4 Katmanlı Yetkilendirme
7. Roller (15 Rol)
8. İzin Sistemi (6 Kategori, DB-Driven)
9. Veri Modeli (Tüm Tablolar)
10. Bölge & Servis Hattı Sistemi
11. İş Akışı: Aşamalar, Fazlar, Adımlar
12. Doküman & Versiyon Sistemi
13. Onay & İmza Motoru (Sistemin Kalbi)
14. Dropbox Entegrasyonu
15. Üretim Panosu (Operational Board)
16. PDF Üretimi & İmzalama
17. AI Asistanı (Trust Lines AI)
18. Satış / CRM Modülü (Leads)
19. E-posta & Bildirimler
20. Güvenlik Notları
21. API Route Envanteri (Tam)
22. Frontend Bileşen Yapısı
23. Migration Geçmişi (44 Migration)
24. Mevcut Durum & Bilinen Kısıtlar
25. Yeni Özellik Eklerken Kontrol Listesi

---

## 1. Proje Nedir? (Genel Bakış)

**Trust-Lines Platform**, mağaza içi üretim projelerini (millwork = ahşap işçiliği, shelving = raf sistemleri, ceiling = tavan, image = görsel/marka öğeleri, furniture = mobilya, decoration = dekorasyon) **kapanan anlaşmadan (closed deal) nihai teslimata (delivered) kadar** tüm yaşam döngüsü boyunca yöneten **dahili (internal), kurumsal bir üretim & doküman yönetim platformudur.**

Bu bir SaaS ürünü veya müşteriye satılan bir yazılım DEĞİLDİR. Trust-Lines şirketinin kendi ekiplerinin (operasyon yöneticileri, proje yöneticileri, üretim ekibi, kalite kontrol, lojistik, muhasebe ve satış) günlük olarak kullandığı iç bir sistemdir.

Sistem, bir mağaza kurulum/üretim işinin karmaşık sürecini dijitalleştirir:
- Anlaşma kapandığında proje açılır,
- Tasarım/plan dokümanları oluşturulur ve müşteri onayına sunulur,
- Üretim dokümanları (item plan, item list, price list, book, purchase order, production form) hazırlanır,
- Bu dokümanlar çok adımlı imza zincirlerinden geçer,
- Tedarikçilere üretim siparişi verilir, üretim panosunda takip edilir,
- Kalite kontrol yapılır, paketlenir, gönderilir,
- ABD'deki depoya ulaşır ve nihai olarak iş yerine (job site) teslim edilir.

**Ölçek hedefi:** ~1000 aktif proje ve **19 TB'lık bir Dropbox paylaşımı**. Yani kod, "az veri var, sorun olmaz" varsayımıyla değil; veri büyüdükçe hızlı kalacak biçimde (indeksleme, N+1'den kaçınma, sınırlı sorgular) yazılmıştır.

---

## 2. İş Bağlamı ve Kullanıcılar

Sistemin merkezinde iki farklı "PM" (Proje Yöneticisi) kavramı vardır ve bunların ayrımı sistemin **en kritik güvenlik kuralıdır**:

- **`trustlines_pm` (Trust-Lines iç PM):** Trust-Lines şirketinin kendi proje yöneticisi. Her şeyi görür (fiyatlar, marjlar, tedarikçi bilgileri, PF dokümanları).
- **`tlines_pm` (Client PM / Müşteri tarafı PM):** Müşteri tarafını temsil eden, kısıtlı yetkili proje yöneticisi. **ASLA** şunları göremez:
  - PF (Production Form) dokümanları,
  - Tedarikçi/vendor fiyatları,
  - Kâr marjı (margin) bilgisi.

Bu ayrım hem veritabanı düzeyinde (RLS), hem uygulama kodu düzeyinde (API kontrolleri, AI aracı kısıtları) çift katmanlı olarak zorlanır. "tlines_pm'e marj/PF/tedarikçi fiyatı sızması" sistemdeki 1 numaralı güvenlik ihlali senaryosudur.

---

## 3. Teknoloji Yığını (Tam Liste)

| Katman | Teknoloji | Notlar |
|---|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) | React 19. Eğitim verisinden farklı breaking değişiklikler içerir; `middleware` konvansiyonu `proxy` olarak deprecate edilmiş (uyarı verir ama çalışır) |
| **Dil** | TypeScript 5 | Sıkı tip kullanımı |
| **Paket yöneticisi** | npm | |
| **Veritabanı & Auth** | Supabase (Postgres + RLS + Supabase Auth) | `@supabase/ssr` ile SSR entegrasyonu |
| **Dosya depolama** | Dropbox SDK (`dropbox` paketi) | **Supabase Storage KULLANILMIYOR** |
| **Stil** | Tailwind v4 (CSS-first, `tailwind.config.ts` YOK) | shadcn/ui bileşenleri, `sonner` (toast bildirimleri) |
| **UI primitives** | `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge` | |
| **İkonlar** | `lucide-react` | |
| **Formlar** | React Hook Form + Zod | `@hookform/resolvers` |
| **Durum makinesi** | XState v5 | `lib/workflow/machine.ts` |
| **PDF üretimi** | `@react-pdf/renderer` | PF, PO, Price List render |
| **PDF imzalama** | `pdf-lib` | İmza görselini PDF'e damgalar |
| **Excel** | `exceljs` + `file-saver` | Proje listesi export |
| **E-posta** | `nodemailer` (SMTP, birincil) + `resend` (yedek) | |
| **AI** | `@anthropic-ai/sdk` | Claude (model `claude-sonnet-4-6`) |
| **Görsel işleme** | `@imgly/background-removal` | Ürün fotoğrafı arka plan silme |
| **3D** | `three` + `@react-three/fiber` + `@react-three/drei` | (kısmi/deneysel kullanım) |
| **Test** | `vitest` | `tests/` klasörü yeni; test altyapısı kuruluş aşamasında |
| **Lint** | ESLint 9 + typescript-eslint + jsx-a11y | |

**Ortam değişkenleri** (`.env.local`, git'e girmez):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DROPBOX_APP_KEY
DROPBOX_APP_SECRET
DROPBOX_REFRESH_TOKEN
SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
ANTHROPIC_API_KEY          # AI asistanı + e-posta ayrıştırıcı
NEXT_PUBLIC_APP_URL        # e-posta linkleri + davet yönlendirmesi
```

---

## 4. Mimari Felsefe (3 Temel İlke)

1. **Tek gerçek kaynağı Supabase (Postgres):** Tüm metadata, iş akışı durumu, imzalar, denetim kaydı ve izinler burada tutulur.

2. **Tüm dosyalar Dropbox'ta:** Supabase Storage kullanılmaz. `documents` tablosu asla dosya içeriği tutmaz; sadece Dropbox yollarına ve metadata'ya (dosya adı, boyut, rev, versiyon, durum) işaret eder. Bunun nedeni şirketin zaten 19 TB'lık mevcut Dropbox arşividir — sistem bunu birebir aynalar, yerini değiştirmez.

3. **Katı rol tabanlı görünürlük:** 15 rol, 6 kategoriye ayrılmış ince taneli izin kataloğu ve satır düzeyi güvenlik (RLS) ile "kim neyi görür" katı biçimde ayrılır.

---

## 5. Dizin Yapısı

```
trustlines-platform/
├── app/
│   ├── (auth)/               # login, set-password (public shell)
│   ├── (platform)/           # oturum-korumalı uygulama (AppShell içinde)
│   │   ├── layout.tsx        # kullanıcı + izinleri çeker, AppShell render eder
│   │   ├── dashboard/        # ana panel
│   │   ├── projects/         # proje listesi + [id] detay + new + trash + edit
│   │   ├── approvals/        # imza/onay gelen kutusu
│   │   ├── production/       # üretim panosu
│   │   ├── clients/          # müşteri/servis yönetimi
│   │   ├── team/             # ekip üyeleri
│   │   ├── roles/            # rol & izin yönetimi (ops_manager)
│   │   ├── audit/            # denetim kaydı
│   │   ├── notifications/    # bildirimler
│   │   ├── settings/         # ayarlar (imza vb.)
│   │   ├── dropbox-wizard/   # Dropbox klasör kurulum sihirbazı
│   │   ├── leads/            # SATIŞ CRM: liste + [id] + new + trash
│   │   ├── sales-dashboard/  # satış paneli
│   │   ├── sales-tasks/      # satış görev listesi (ClickUp tarzı)
│   │   └── sales-team/       # satış ekibi + bölge atama + proje numarası
│   ├── api/                  # ~75 route handler (backend)
│   └── auth/callback         # Supabase auth callback
├── components/platform/      # tüm UI bileşenleri (rol bazlı)
│   ├── shell/  shared/  projects/  production/  approvals/
│   ├── ai/  roles/  team/  clients/  audit/  dashboard/  dropbox/  leads/  sales/
│   └── SignaturePad.tsx
├── lib/                      # iş mantığı (framework'ten bağımsız)
│   ├── supabase/             # client.ts (browser), server.ts, admin.ts
│   ├── permissions/          # catalog.ts, can.ts, server.ts, requirePage.ts, requireApi.ts
│   ├── workflow/             # machine.ts (aşamalar), steps.ts (adımlar)
│   ├── approvals/            # stageConfig.ts (imza zincirleri)
│   ├── dropbox/              # paths.ts, client.ts, upload.ts
│   ├── pdf/                  # signPdf.ts, logo.ts
│   ├── production/           # board.ts, pfCode.ts, vendorCode.ts, resetPf.ts
│   ├── ai/                   # assistantTools.ts (AI'ın okuma araçları)
│   ├── sales/                # activity, leadAccess, notify, projectTypes, roles, scope, format
│   ├── email/send.ts, audit/log.ts, versions.ts, excel/, regions.ts, usStates.ts
│   └── validations/project.ts
├── supabase/
│   ├── migrations/           # 001 → 044 (elle sırayla uygulanır)
│   └── functions/            # dropbox-create-project-folder (Deno edge fn)
├── types/database.ts         # elle yazılmış DB tipleri (Database generic)
├── middleware.ts             # oturum kapısı (tüm route'lar)
├── SYSTEM_ARCHITECTURE.md    # 30KB mimari rehber (Türkçe)
└── AGENTS.md                 # performans & ölçek kuralları
```

---

## 6. Kimlik Doğrulama & 4 Katmanlı Yetkilendirme

Yetkilendirme **4 katmanlıdır**. Yeni bir özellik eklerken her katman ayrı ayrı düşünülmelidir.

### 6.1 Katman 1 — Middleware (kaba kapı)
`middleware.ts`: Supabase oturumunu `getUser()` ile doğrular. Public path'ler (`/login`, `/auth/callback`, `/auth/set-password`) dışında oturumsuz her istek `/login`'e yönlendirilir. `/api/*` dahil **tüm** route'ları kapsar. Yani hiçbir endpoint tamamen anonim değildir — ama middleware **rol kontrolü yapmaz**, sadece "giriş yapılmış mı?" der.

### 6.2 Katman 2 — Supabase İstemcileri (3 çeşit)
| Dosya | İstemci | RLS | Kullanım |
|---|---|---|---|
| `lib/supabase/client.ts` | browser (anon key) | ✅ uygulanır | client component'ler |
| `lib/supabase/server.ts` | server (anon key + cookie) | ✅ uygulanır | server component + kullanıcı-kapsamlı okuma |
| `lib/supabase/admin.ts` → `createAdminClient()` | **service role** | ❌ **BYPASS eder** | RLS'i aşması gereken yazma/okuma |

> **KRİTİK:** `createAdminClient()` RLS'i tamamen atlar. Onu kullanan **her route kendi rol kontrolünü yapmak ZORUNDADIR.** Aksi halde yetki yükseltme (privilege escalation) açığı oluşur.

`server.ts` yardımcıları:
- `getSessionUser()` — cookie'den kullanıcıyı ağ çağrısı yapmadan okur (middleware zaten doğruladığı için güvenli, rate-limit korur).
- `requireUser()` → `{ user, unauth }`; `if (!user) return unauth;` (401).

API rol kapısı: `lib/permissions/requireApi.ts` → `requireRole(allowed[], denyMessage?)` → `{ user, role, admin, deny }`.

### 6.3 Katman 3 — İzin Kataloğu (bkz. §8)
DB-driven, 6 kategorili ince taneli izin sistemi.

### 6.4 Katman 4 — Row-Level Security (veritabanı)
`supabase/migrations/002_rls_policies.sql` — son savunma hattı:
- `projects`: `ops_manager`/`general_manager` her şeyi (migration 046; eski `executive` kaldırıldı); `tlines_pm` yalnız `tlines_pm_id = auth.uid()` projeleri; `trustlines_pm` tümünü; `pm_millwork`/`pm_ceiling` kategori-kapsamlı; `logistics`/`accounting`/`qc_responsible` aşama-kapsamlı.
- `documents`: **`tlines_no_pf` politikası** — `tlines_pm` yalnız kendi projelerinin `doc_type != 'pf'` dokümanlarını görür (PF tamamen gizli).
- Yardımcı fonksiyonlar: `auth_role()` (SECURITY DEFINER), `is_internal_role()`.

---

## 7. Roller (14 Rol — `executive` kaldırıldı, migration 046)

> **ÖNEMLİ — Rol depolama:** Canlı veritabanında `profiles.role` **TEXT**'tir; `user_role` enum'ı **YOKTUR** (migration 001'de tanımlı olsa da uygulanmamış). `ALTER TYPE user_role ADD VALUE` komutu `type "user_role" does not exist` hatası verir. Roller tamamen **`role_definitions`** tablosuyla (text `name` sütunu) yönetilir. Yeni rol eklerken enum'a ASLA dokunulmaz, sadece `role_definitions`'a seed verilir (guarded INSERT ... WHERE NOT EXISTS deseni).

**Çekirdek roller:**
- `ops_manager` — Operasyon yöneticisi, tam yetki (admin, `{ all: true }`)
- `general_manager` — **Full system-wide authority** (tüm sistem; eski `executive` rolünün yerini alır — migration 046; PF imza zincirinde de yer alır). `executive` KALDIRILDI, yeni kodda kullanılmaz.
- `trustlines_pm` — Trust-Lines iç PM (her şeyi görür)
- `tlines_pm` — Müşteri tarafı Client PM (KISITLI: PF/marj/tedarikçi fiyatı yasak)
- `pm_millwork` — Millwork/Shelving üretim PM'i
- `pm_ceiling` — Ceiling/Image üretim PM'i
- `qc_responsible` — Kalite kontrol sorumlusu
- `logistics` — Lojistik
- `accounting` — Muhasebe

**PF imza-zinciri rolleri:**
- `production_manager`, `project_manager`, `general_manager`, `accountant`

**Satış modülü rolleri:**
- `sales_rep` — Satış temsilcisi
- `sales_marketing_manager` — Satış & pazarlama yöneticisi

**Bölgesel PM modeli (migration 023):** Client PM'ler artık **bölgesel** — her bölge (bir `client`) kendi Client PM'ine sahip ve yalnız o bölgeyi görür (`profiles.pm_client_id`). Tek bir global **"Project Management Supervisor"** (`profiles.is_pm_supervisor`) tüm bölgeleri denetler ve PO süpervizör kutusunu imzalar. Yeni bir projeye hem bölgesel Client PM hem de global süpervizör otomatik atanır.

---

## 8. İzin Sistemi (6 Kategori, DB-Driven)

`lib/permissions/catalog.ts` sistemin izin sözlüğüdür. İzin haritası `role_definitions.permissions` (JSONB, `{ [key]: true }`) sütununda saklanır. `{ "all": true }` her şeyi bypass eder. `permCan(perms, key)` kontrol eder; depolanan değer yoksa `DEFAULT_PERMISSIONS[role]` fallback devreye girer.

**6 İzin Kategorisi:**

1. **`page.*` — Sayfalar (açılabilen):** dashboard, projects, approvals, notifications, clients, production, qc, logistics, team, roles, audit, dropbox_wizard, trash, settings. Hem nav'da gizler hem URL ile bloke eder (`requirePage`).

2. **`edit.*` — Düzenleme hakları (kapalıysa salt-görüntüleme):** `edit.projects`, `edit.clients`, `edit.team`, `edit.roles`, `edit.production`.

3. **`sign.*` — İmza kutuları:** `sign.production_millwork`, `sign.production_ceiling`, `sign.trust_pm`, `sign.client_pm`, `sign.general_manager`, `sign.accountant`, `sign.pm_supervisor`.

4. **`view.*` — Görünürlük:** Sekmeler (overview, plan_layout, design_proposal, construction, millwork, shelving, ceiling, image, decoration), `view.pf`, `view.po`, `view.prices` (marjlar/fiyatlar), `view.production_board`.

5. **`notify.*` — E-posta abonelikleri:** approval_request, approval_complete, revision, hold_t, payment, ready.

6. **`progress.*` — Faz ilerleme görünürlüğü:** finalization, construction, production, delivery.

**Cache:** `lib/permissions/server.ts` rol izinlerini **30 sn TTL cache** ile okur (`getRolePermissions`, `roleCan`, `userCan`). Her çağrıda `role_definitions` sorgulanmaz.

**Sayfa koruması:** `lib/permissions/requirePage.ts` → `requirePage('page.xxx')` server component başında çağrılır, izin yoksa `/dashboard`'a redirect.

**Eski/kaba model:** `lib/permissions/can.ts` — sabit `Action` listesiyle `can(role, action)`. Katalogla paralel çalışan daha eski bir kontrol.

**Örnek default izinler (kod'dan):**
- `ops_manager`: `{ all: true }` (her şey)
- `trustlines_pm`: tüm sekmeler + `view.prices` + `sign.trust_pm` + üretim/qc/lojistik sayfaları
- `tlines_pm`: temel sayfalar + tüm sekmeler + `sign.client_pm` — **ama PF/marj RLS ve kod ile ayrıca kısıtlanır**
- `production_manager`: üretim sekmeleri + `sign.production_millwork` + `sign.production_ceiling` + üretim panosu
- `accountant`/`accounting`: PO/PF/prices görünürlüğü + `sign.accountant` + payment bildirimleri

---

## 9. Veri Modeli (Tüm Tablolar)

`projects` merkez tablodur. Tam envanter:

| Tablo | Rolü |
|---|---|
| `profiles` | Kullanıcı (auth.users'a 1-1). `role` (TEXT), `pm_client_id`, `is_pm_supervisor`, `category_scope`, `signature_base64`, `sales_region_id` |
| `clients` | Bölge/müşteri (kod + isim) |
| `client_franchises` | (Legacy) müşteri altı franchise — artık UI'da kullanılmıyor |
| `client_companies` | **Servis/şirket** (ör. "Store Maker"), `margin_pct`; migration 022 sonrası doğrudan `client_id` altında |
| `projects` | **Merkez tablo** — aşağıda detay |
| `documents` | Dropbox dosya metadata'sı + iş akışı bağlamı (`step_key`, `cat_group`, `version`, `status`, `form_data` JSONB) |
| `document_approvals` | İmza/onay adımları (stage, status, assigned_to, version_num) |
| `document_versions` | Versiyon setleri (canonical versioning — migration 013) |
| `project_steps` | Proje × faz × kategori × adım tamamlanma durumu (migration 005) |
| `production_items` | **Üretim panosu satırları** — proje × tip (migration 014) |
| `suppliers` | Tedarikçiler/vendor'lar (kod, ülke, kategori) |
| `assembly_links` | PF "ASSEMBLY" ilişkileri — hangi item hangisine monte olur (migration 019) |
| `qc_checklists` | Kalite kontrol formları (JSONB sections + imzalar) |
| `stage_transitions` | Aşama geçiş kaydı (override dahil) |
| `audit_log` | Denetim kaydı (actor, action, resource, old/new value) |
| `notifications` | Uygulama içi bildirimler |
| `project_notes` | Proje notları (dahili/harici) |
| `role_definitions` | Roller (name, label, açıklama, renk, `permissions` JSONB) |
| `lead_intake` | **Satış CRM** — lead giriş kaydı (aşağıda §18) |
| `lead_tasks` | Lead subtask'ları (ClickUp tarzı) |
| `lead_watchers` | Lead takipçileri |
| `project_number_counter` | Tek satırlık global proje numarası sayacı (migration 035) |

### `projects` — anahtar sütunlar
- `code` (proje kodu, `TL-YYnnnn-X` eski format / yeni format `{ServiceShort}{RegionShort} {num}` ör. "STW 460")
- `name`, `client_id` / `client_company_id`
- `categories[]` (M1-I3), üretilmiş sütunlar `has_millwork_shelving` / `has_ceiling_image` / `is_mixed_scope` (Postgres GENERATED columns)
- `current_stage`, `current_phase`
- `deal_value` + `currency` (USD/EUR/TRY), `category_values` (tip başına değer JSONB — migration 024), `margin_target_pct`
- Tarihler: `closed_deal_date`, `est_finalization_date`, `est_production_start`, `est_delivery_date`, `actual_delivery_date`, `hard_deadline`
- Atananlar: `ops_manager_id`, `trustlines_pm_id`, `tlines_pm_id`, `prod_pm_ms_id`, `prod_pm_ci_id`, `qc_inspector_id`, `pm_supervisor_id`
- Dış referanslar: `dropbox_root_path`, `clickup_task_id`, `quickbooks_ref`
- Satış/intake: `region`, `service_line`, `is_draft`, `delivered_to_trust_at`
- Soft-delete: `deleted_at`, `is_archived`

### Kategori sistemi
12 kategori kodu → 2 ana grup:
- **Millwork** (M1-M3) + **Shelving** (S1-S3) → "millwork-ish" grup, imza: `pm_millwork`. Bu grup Dropbox'ta **Proposal adımına sahiptir**.
- **Ceiling** (C1-C3) + **Image** (I1-I3) → "ceiling-ish" grup, imza: `pm_ceiling`. Proposal adımı YOK.
- Ayrıca board tiplerinde **Furniture** ve **Decoration** de vardır.

`lib/workflow/steps.ts` → `getActiveCategoryGroups()` (hem M1-M3 kodlarını hem düz "Millwork" metnini destekler).

> **Migration'lar ELLE uygulanır** (Supabase Dashboard/CLI, sırayla). Otomatik runner yoktur. `auth.users` var olmadan seed çalışmaz. Postgres FK'leri otomatik indekslemez — sık filtrelenen sütuna manuel index eklenmelidir.

---

## 10. Bölge & Servis Hattı Sistemi

`lib/regions.ts` — Satış giriş/intake formundaki iki sabit liste:

**4 Bölge (Region)** — coğrafi T-Lines bölümü (müşteri DEĞİL):
| Kod | Etiket | Dropbox | Kod Kısaltma |
|---|---|---|---|
| `TLINES_NE` | T-Lines North East | NE | NE |
| `TLINES_SE` | T-Lines South East | SE | SE |
| `TLINES_NW` | T-Lines North West | NW | NW |
| `CVW` | CVW | CVW | W |

(Eski `TLINES_HQ` / `TLINES_TC` değerleri historik satırlar için geçerli kalır ama artık seçilemez.)

**3 Servis Hattı (Service Line):**
| Değer | Etiket | Dropbox Section | Kod Kısaltma |
|---|---|---|---|
| `store_maker` | Store Maker | 1-Store Maker | ST |
| `premium_store_fitout` | Premium Store Fitout | 2-Premium Store Fitout | PS |
| `design_build` | Design Build | 3-Design & Build | DS |

**Proje kodu** = `{ServiceShort}{RegionShort} {number}`. Örnek: `composeProjectCode('store_maker', 'CVW', 460)` → **"STW 460"**. Numara kısmı artık **global** tek sayaçtan gelir (migration 035); şirket+bölge sadece prefix'i oluşturur.

---

## 11. İş Akışı: Aşamalar, Fazlar, Adımlar

Sistem başta 18 aşamalıydı; migration 007 ile **5 aşama / 4 faza** sadeleştirildi.

### Aşamalar (`lib/workflow/machine.ts`)
`STAGE_ORDER`: `closed_deal → finalization → client_approval → production → delivered`

Aşama ilerletme **kullanıcı kontrollüdür** — sert kapı yok. `canAdvanceStage()` yalnız "son aşamada mısın?" kontrolü yapar. `ops_manager`/`general_manager` override edebilir. `POST /api/projects/[id]/advance-stage` → `stage_transitions` + `audit_log` yazar.

### Adımlar (`lib/workflow/steps.ts`) — asıl detaylı iş akışı
Gerçek detay **adımlar**dadır (`project_steps` tablosu). Her `StepDef` şu bayrakları taşır: `hasDocument`, `requiresApproval`, `requiresVersionSelect`, `isOptional`, `docType`. Adım kayıtları **on-demand** (ilk aksiyonda) oluşturulur.

**Phase 1 — Finalization:**
1. Closed Deal Date (dokümansız)
2. Plan Layout (doküman: `plan_layout`)
3. Design Proposal (doküman: `proposal`)
4. Client Approval (versiyon seçimi gerektirir)

**Phase 2 — Construction Documents:**
1. Construction Drawings (doküman: `construction_drawings`)

**Phase 3 — Production (her kategori grubu için AYRI tekrarlanır):**
1. Proposal (onay gerektirir; doküman: `proposal`)
2. Item Plan (`item_plan`)
3. Item List (`item_list`)
4. Item Price List (`price_list`)
5. Book (`book`)
6. Purchase Order / PO (`po_bo`)
7. Production Forms / PF (`pf`)
8. Production Starting (dokümansız)
9. Quality Control (`qc_checklist`)
10. Payment to Vendor (dokümansız)
11. Packing (`packing_list`)
12. Sent to T-Lines (`shipment_doc`)

**Delivery:**
1. Shipped (`shipment_doc`)
2. Received in USA Warehouse (dokümansız)
3. Transfer (opsiyonel, dokümansız)
4. Deliver to Job Site (dokümansız)

---

## 12. Doküman & Versiyon Sistemi

`documents` bir Dropbox PDF'ine işaret eder; **asla dosya içeriği tutmaz** (istisna: PF `form_data`/`pf_signatures` JSONB base64 imza/foto tutabilir).

> ⚠️ **PERFORMANS KURALI:** `documents` üzerinde ASLA `select('*')` yapma — `form_data`/`pf_signatures` on binlerce byte'lık base64 çekebilir. Listelerde açık hafif sütunlar seç; ağır alanları `GET /api/projects/[id]/documents/[docId]` ile tek doküman bazında çek.

### Canonical versiyonlama (migration 013, `lib/versions.ts`)
Üretim bundle'ları (item_plan/item_list/price_list/book/po_bo/pf) ve construction drawing bir **versiyon setine** (`document_versions`) bağlanır:
- **DRAFT**, Trust PM imzaladığında biter (`status: draft → signed`).
- **Yeni versiyon YALNIZCA Client PM reddettiğinde** açılır (`rejected` → V{n+1} + yeni Dropbox klasör ağacı).
- Yardımcılar: `versionScope()`, `getOrCreateOpenVersionSet()`, `markVersionSetSigned()`, `markVersionSetCompleted()`, `rejectVersionSetAndOpenNext()`, `attachDocumentToVersionSet()`.

**Dropbox auto-sync** (`/api/dropbox/auto-sync`) yalnız **PDF** import eder — kaynak dosyalar (jpg/xlsx/dwg/bak/tmp) Dropbox'ta kalır, tabloya girmez.

> **Tarihsel not:** `documents` tablosu bir keresinde ~8133 satıra şişmiş (Dropbox kaynak dosyaları junk olarak sync edilmiş + duplikeler). ~1122'ye temizlenmiş (yalnız PDF, deduped). Kök neden: auto-sync artık PDF-only filtreliyor. Tablo tekrar şişerse bu filtreyi kontrol et.

---

## 13. Onay & İmza Motoru (Sistemin Kalbi)

`app/api/projects/[id]/doc-approvals/route.ts` — çok adımlı imza/onay iş akışını yürütür. İki mod:

### `initiate` modu
Bir doküman için imza aşama satırlarını (`document_approvals`) oluşturur. Aşamalar `lib/approvals/stageConfig.ts` → `approvalStagesFor(docType, catGroup)` ile belirlenir:
- **plan_layout / proposal (finalization):** yalnız Client PM
- **construction_drawings:** Trust PM → Client PM
- **PO (po_bo):** Client PM → General Manager → Accountant (opsiyonel) → PM Supervisor (opsiyonel, "anytime" / sıra-bağımsız)
- **Production bundle (item_plan/item_list/price_list/book/proposal):** Production Manager → Trust PM → Client PM
- **PF:** özel **4-imzacı zinciri** — Production Manager → Project Manager (=Trust PM) → General Manager → Accountant (opsiyonel, anytime)

Assignee'ler `initiate` anında gerçek kullanıcıya çözülür. Satırlar `create_document_approval` RPC ile eklenir (PostgREST şema-cache'ini atlamak için).

### `approve` / `reject` modu
- **Yetki:** Yalnız atanan kişi VEYA aşamanın `sign.*` iznini taşıyan rol imzalayabilir. **`ops_manager` bile başkasının kutusunu imzalayamaz** — her kutu belirli bir imzacıyı adlandırır (`signPermForStage()`).
- **Ön koşul kapıları:** Paylaşılan bundle dokümanları (proposal/item_plan/item_list/price_list) hepsi mevcut olmadan imzalanamaz. PF ancak Plan Layout + Item List + Item Price List + Book + PO onaylıysa imzalanabilir.
- **İmza damgalama:** Onayda `applySignaturesToDocument()` (`lib/pdf/signPdf.ts`) PF/PO PDF'ine imza kutularını basar (10 sn timeout ile — onay asla asılmaz).
- **Versiyon geçişleri:** Trust PM imzası DRAFT'ı bitirir; Client PM onayı seti "completed" yapar; Client PM reddi V{n+1} açar.
- **Kademeli/paylaşımlı (lock-step) onay:** Bundle dokümanlarından biri onaylandığında aynı kategori+versiyondaki kardeşleri de aynı aşamada onaylanır.
- **E-posta + adım güncelleme:** Sonraki imzacıya (aboneyse) mail; tamamlanınca Trust PM'e mail; `project_steps` durumu güncellenir.

---

## 14. Dropbox Entegrasyonu

### Değişmezlik kuralları (`lib/dropbox/upload.ts` — ASLA ihlal etme)
1. Hiçbir dosya/klasör **silme**.
2. `overwrite` modu **kullanma** — hep `add`.
3. Mevcut dosyayı **taşıma/yeniden adlandırma**.
4. Var olan proje kökü üzerine klasör **oluşturma** — önce tespit et, `alreadyExists` döndür.

### Yol sistemi (`lib/dropbox/paths.ts`)
Trust-Supply ağ paylaşımını (`\\Trust-Supply\D-Projects\T LINES\...`) birebir aynalar. Proje kökü:
`/D-Projects/T LINES/{section}/{region}/{status}/{clientType}/{clientName?}/{projectNo} - {address}`

Doküman klasörleri `getDocFolder(docType, {version, prodType})` ile üretilir. **İki numaralandırma şeması:**
- **Millwork/Shelving** (Proposal var): `1-Proposal 2-Item Plan 3-Item List 4-Book 5-Purchase Order 6-Production Form`
- **Ceiling/Image/Furniture/Decoration** (Proposal yok): `1-Item Plan 2-Item List 3-Book 4-Purchase Order 5-Production Form`

`PROJECT_STRUCTURE_V2` proje oluşturulurken kurulacak tam klasör ağacını tanımlar. `createProjectFolders()` batch mkdir ile kurar (çakışmaları atlar). `ensureVersionFolder()` yeni V{n} klasörü açar. Yeni üretim tipi eklemek için sadece `PROD_TYPES` güncellenir — tüm yol üreticileri otomatik türetir.

### Client & upload (`lib/dropbox/client.ts`)
Refresh token ile Dropbox SDK istemcisi. `uploadToDropbox` (add, autorename), `uploadRevisionToDropbox` (update mode, rev conditional), `getDropboxTemporaryLink`.

### Dosya sunumu (API)
- `/api/files/view` ve `/api/files/proxy` → dökümanı `documentId` ile **RLS-kapsamlı** server istemcisi üzerinden çözer (tlines_pm PF'i otomatik bloke olur).
- `/api/files/view-by-path` → ham yol alır; güvenlik denetiminde `projectId` + proje-kökü doğrulaması eklendi (IDOR kapatıldı).

---

## 15. Üretim Panosu (Operational Board)

`production_items` (migration 014) = panonun kaynak satırları. Bir satır = proje × tip. Kategorilerden otomatik tohumlanan placeholder satırlar; vendor atanınca PF kodu üretilir.

### Durum zinciri & tarih otomasyonu (`lib/production/board.ts`)
`STATUS_CHAIN`:
`NOT_ORDERED → ORDERED → WAITING_PAYMENT → READY_TO_RECEIVE → RECEIVED → READY → SENT_TO_TLINES → PARTIAL_SENT → SENT`

Her durum bir tarih sütununu doldurur (`std, etd, rtd, rtr, rdy, ftd, snd`). `datesForStatusChange()` ileri-doldurur (hedefe kadar boş tarihleri bugünle), geri-temizler (hedeften sonrakileri null). Off-chain durumlar (`HOLD_T`, `HOLD_PM`, `ASSEMBLY`) tarihi değiştirmez.

Bölge bucket'ı Dropbox kökünden türetilir (`bucketFromPath` → TLINES_NE/SE/NW/CVW/HQ/TC). Finansal alanlar: `pf_usd`, `pf_tl` (tedarikçi/PF fiyatı — **tlines_pm göremez**), `invoice`, `invoice_tl`, `expenses_*`. PF kodu `lib/production/pfCode.ts`, vendor kodu `lib/production/vendorCode.ts` (seed vendor'lar: YSM/GOS/BARLOK/ACI/DMR/PIXEL).

Tablo **Supabase Realtime** yayınına eklidir — pano canlı güncellenir.

---

## 16. PDF Üretimi & İmzalama

`lib/pdf/` — `@react-pdf/renderer` ile:
- `ProductionFormPdf.tsx` (PF), `PurchaseOrderPdf.tsx` (PO), `PriceListPdf.tsx`.
- `signPdf.ts` → `applySignaturesToDocument()`: `pdf-lib` ile imza kutularına base64 imza görselini basar; sonucu Dropbox'a yeni revizyon olarak yükler. İmza metadata'sı `documents.pf_signatures` + `pf_meta` (migration 015) içinde saklanır ki PF yeniden render edilebilsin.
- Kullanıcı imzaları `profiles.signature_base64` (migration 012) + `SignaturePad.tsx` bileşeni ile toplanır.

Üretim rotaları: `/api/projects/[id]/generate-pf`, `generate-po`, `generate-doc`, `pf-sign`.

---

## 17. AI Asistanı (Trust Lines AI)

Canlı veri üzerinde **salt-okunur** soru-cevap. `components/platform/ai/TrustLinesAI.tsx` — sağ-alt köşede yüzen sohbet widget'ı (`AppShell`'de bir kez mount edilir).

- **`app/api/ai/assistant/route.ts`** — Claude tool-use döngüsü (model `claude-sonnet-4-6`, max 8 tur). Oturum + rol doğrular, rol/bölge kapsamını sistem prompt'una geçer. `{ reply }` döner.
- **`lib/ai/assistantTools.ts`** — 14 salt-okunur araç: `list_projects`, `project_detail`, `production_board`, `directory`, `clients_and_services`, `vendors`, `payments_overview`, `pending_approvals`, `project_documents`, `document_items`, `deadlines`, `vendor_orders`, `recent_activity`, `overview_stats`. Her soru **taze sorgu** çalıştırır (snapshot/eğitim yok). Türkçe cevap verir, çıktı temiz (tablo yok).

**GÜVENLİK (service-role RLS bypass ettiği için kod içinde zorlanır):**
- `restricted = ctx.role === 'tlines_pm'` → `production_board` / `payments_overview` / `vendor_orders` / `vendors` araçları REDDEDİLİR; `margin_pct`, PF dokümanları (`doc_type='pf'`), item `margin` çıktıdan STRIP edilir.
- Rol çözülemezse route **fail-closed (403)** olur (eskiden `ops_manager`'a düşüyordu — kapatıldı).
- `tlines_pm` kapsamı **bölgeseldir** (`pm_client_id`) — RLS'in "kendi projesi" (`tlines_pm_id`) kapsamından farklı; bu **kasıtlıdır** (migration 023).
- Draft projeler tüm 8 proje sorgusunda `.eq('is_draft', false)` ile hariç tutulur.

- **`app/api/ai/parse-email/route.ts`** — e-postadan proje alanı çıkaran ayrıştırıcı (yeni-proje formunda). Oturum gerektirir.

**Roadmap:** v2 = doküman/PDF içeriği (semantik arama), v3 = onaylı aksiyonlar.

---

## 18. Satış / CRM Modülü (Leads)

`SYSTEM_ARCHITECTURE.md` yazıldıktan sonra (migration 025-044) eklenen büyük bir modül. **"Modifiye ClickUp"** felsefesiyle tasarlanmış bir satış/lead yönetim sistemi.

**Akış:** Satış giriş noktası "New Form" (`/leads/new`) → `lead_intake` kaydı oluşturur → Leads board'unda görünür. Board'un **List / Kanban(Board) / Calendar** görünümleri var.

**`lead_intake` alanları:** müşteri bilgileri (customer_name, brand, email, contact_person, phone, industry), ayrık adres (city/street/state → proje adı `{no} - {city} - {street} - {state}`), `opportunity_status` (new_opportunity vb.), `project_type` (New Construction/Small Remodel/Full Remodel/BID/ITEMS), CRM alanları (priority, assignee_id, deal_size, source, follow_up_date, next_action, tags[]), `checklist` (JSONB subtask'lar), `customer_address`.

**İlişkili tablolar/özellikler:**
- `lead_tasks` — ClickUp tarzı subtask'lar (title, status todo/in_progress/done, assignee, due_date). Her yeni lead'e otomatik "Collect Information" görevi eklenir. **Tasks sayfası** (`/sales-tasks`): herkesin subtask'ları, filtreler.
- `lead_activity` — per-lead aktivite feed'i + yorumlar (kind='change' otomatik / 'comment' manuel).
- `lead_watchers` — lead takibi; değişiklikte bildirim + follow-up hatırlatmaları (idempotent, Leads sayfası mount'ta tetiklenir).
- Soft-delete: `is_archived`, `deleted_at` + 30 günlük trash (`/leads/trash`).
- **LeadQuickView** — lead'e tıklayınca açılan pop-up (editable Fields grid + subtasks + activity). "Full form" → `/leads/[id]`.

**Güvenlik:** Satış-only RLS. Ama `/api/leads/[id]/*` route'ları service-role kullandığından gerçek enforcement `lib/sales/leadAccess.ts` → `assertLeadAccess()` (created_by OR assignee_id OR subtask atanmış OR sales_marketing_manager).

**Global proje numarası (migration 035):** Trust + Sales tüm projeler için TEK global sayaç (`project_number_counter` tek satır + atomik `reserve_global_number()` RPC). Admin, numaraları Sales Team → "Project number" ekranından yönetir.

---

## 19. E-posta & Bildirimler

`lib/email/send.ts` — `nodemailer` SMTP transport + HTML şablonları (`approvalRequestHtml`, `approvalRejectedHtml`, `approvalCompletedHtml`). SMTP kimlik bilgisi yoksa **sessizce atlar** (hata vermez). E-postalar yalnız alıcının rolü ilgili `notify.*` iznini taşıyorsa gönderilir (`userCan(admin, userId, 'notify.xxx')`).

Uygulama içi bildirimler `notifications` tablosunda. `/api/approvals/mine` bir kullanıcının bekleyen imzalarını (indeksli, limitli cross-project sorgu) döndürür.

---

## 20. Güvenlik Notları (2026-07-01 denetimi)

Uygulanmış düzeltmeler:
- **AI segregasyonu kod içinde zorlanıyor** — tlines_pm'e PF/marj/tedarikçi sızıntısı kapatıldı.
- **`/api/files/view-by-path`** artık `projectId` ister ve yolun çağıranın RLS ile görebildiği projenin `dropbox_root_path`'i altında olduğunu doğrular (`..` engelli). Eskiden 19 TB'lık Dropbox'ta herhangi bir yola erişilebiliyordu (IDOR açığı).
- **AI route fail-closed** — rol çözülemezse 403.
- **`.or()` filtre injection** — kullanıcı girdisi `likeSafe()` ile temizleniyor.
- `test-dropbox` debug route'u silindi; `parse-email` oturum kapısı aldı; `team/invite` debug sızıntısı kaldırıldı.
- Bağımlılıklar: 7 → 4 açık (0 high). Kalan 4 moderate (postcss/uuid) yalnız transitive.

**Kalıcı ilkeler:**
1. `createAdminClient()` kullanan her route kendi rol kontrolünü yapmalı (tercihen `requireRole()`).
2. `tlines_pm`'e ASLA PF/marj/tedarikçi fiyatı gösterme (kod + RLS iki katman).
3. Dropbox değişmezlik kurallarını asla bypass etme.

---

## 21. API Route Envanteri (Tam, ~75 route)

**AI:** `ai/assistant`, `ai/parse-email`
**Onaylar:** `approvals/mine`
**Denetim:** `audit`
**Auth:** `auth/signout`
**Katalog:** `catalog-items`
**Dropbox:** `dropbox/auto-sync`, `check-project-number`, `check-revisions`, `create-folders`, `create-project-structure`, `create-single-folder`, `link-file`, `list-folders`, `list-versions`, `save-path`, `scan-step-files`
**Dosyalar:** `files/[id]/status`, `files/proxy`, `files/proxy/[filename]`, `files/upload`, `files/view`, `files/view-by-path`
**Geo:** `geo/search` (Nominatim proxy)
**Leads (Satış):** `leads/[id]/activity`, `archive`, `deliver`, `intake`, `intake/upload`, `permanent-delete`, `restore`, `status`, `tasks`, `tasks/[taskId]`, `tracking`, `trash`, `update`, `watch`
**Üretim:** `production/board`, `production/items`, `production/items/[id]`, `production/vendors`, `production/vendors/[id]`
**Ürünler:** `products/upload-photo`
**Projeler:** `projects/[id]` (PATCH/DELETE), `advance-stage`, `assembly`, `doc-approvals`, `doc-versions`, `documents`, `documents/[docId]`, `documents/[docId]/approve`, `generate-doc`, `generate-pf`, `generate-po`, `permanent-delete`, `pf-sign`, `pf-status`, `po-hold`, `restore`, `steps`, `type-folders`; ayrıca `projects/generate-code`, `projects/lookup-dropbox-client`
**Roller:** `roles`, `roles/[name]`
**Satış:** `sales-team/assign-region`, `sales/next-number`, `sales/run-reminders`, `sales/sequences`
**Ekip:** `team/[id]`, `team/invite`
**Kullanıcı:** `user/signature`
**Admin:** `admin/backfill-closed-deal-steps`

**Rol-gate deseni:** `requireRole([...])` VEYA `requireUser()` + admin `select('role')`.

---

## 22. Frontend Bileşen Yapısı

`components/platform/`:
- **shell/** — `AppShell`, `Sidebar` (nav, `page.*` izinleriyle filtreli), `TopBar`
- **shared/** — StageBadge, PhaseRail, CategoryChip, Pill, Avatar, PermissionShield, Card, ViewToggle, Portal
- **projects/** — `ProjectDetailClient` (sekmeli iş akışı ekranı), `ProjectWorkflow`, `DocGeneratorModal`, `DocumentsTable`, `FileUploadZone`, PF/PO/PlanLayout sekmeleri, `NewProjectForm`, `AssemblyModal`, `ProjectsListClient`/`Table`, `TrashClient`, `WorkflowTimeline`, `ProjectTimeline`, `ProjectRail`, `DropboxProjectBrowser`, `AuditTrail`
- **production/** — `OperationalBoard`, `AddVendorModal`, `VendorSelect`
- **approvals/** — `ApprovalsPageClient`, `ApprovalActionBar`
- **ai/** — `TrustLinesAI`
- **leads/**, **sales/** — Satış CRM bileşenleri (LeadQuickView, LeadActivity vb.)
- **roles/**, **team/**, **clients/**, **audit/**, **dashboard/**, **dropbox/** (DropboxWizard)

Sayfalar server component'tir (`app/(platform)/.../page.tsx`) — `requirePage()` ile korunur, veriyi çeker, `*Client` bileşenine geçer.

---

## 23. Migration Geçmişi (44 Migration, 001→044)

Migration'lar **elle** ve **sırayla** uygulanır. Öne çıkanlar:
- **001** initial schema, **002** RLS policies, **004** seed data
- **005** project_steps, **007** aşama sadeleştirme (18→5), **009** soft-delete
- **011-013** doküman revizyon/imza/versiyon setleri, **014** production_items
- **015-016** PF imzaları + PF signer rolleri, **019** assembly_links
- **020** rol izinleri seed (6-kategori modeli), **021** performans indexleri (ölçek için MUTLAKA)
- **022** clients modeli düzleştirme (client_companies.client_id + franchise nullable)
- **023** bölgesel + supervisor PM, **024** category_values
- **025-026** satış rolleri, **028** projects region/service/draft, **031** draft RLS gizleme
- **029-044** Satış/CRM modülü (lead_intake, tasks, activity, watchers, checklist, soft-delete, RLS align, opportunity status)
- **035** global proje numarası (027'yi supersede eder)

> **"MUTLAKA ÇALIŞTIR" işaretli olanlar:** 021, 022, 023, 028, 031, 032, 035. Bir özellik "kolon/tablo yok" hatası verirse muhtemelen ilgili migration çalıştırılmamıştır.

---

## 24. Mevcut Durum & Bilinen Kısıtlar

- **Test yok (yeni ekleniyor):** Uzun süre `npm run build` tek güvenlik ağıydı. `vitest` + `tests/` klasörü yeni eklenmiş, birim test altyapısı kuruluş aşamasında.
- **Migration'lar manuel:** Otomatik runner yok; her migration Supabase SQL editöründe elle çalıştırılıyor. Kod çoğu yerde migration uygulanmamışsa **graceful fallback** yapar.
- **AI asistanı:** Gerçek `ANTHROPIC_API_KEY` + ~$5 kredi eklenmiş (2026-06-24), `claude-sonnet-4-6` çalışıyor. Placeholder key varsa route 503 döner.
- **Deprecation uyarısı:** Next.js `middleware` → `proxy` deprecate (uyarı verir, çalışır).
- **Desktop'ta ek dosyalar:** `Trust-Lines Production Platform (standalone).html` (muhtemelen erken prototip/tek-dosya sürüm) ve `Trust_Lines-DSB-Black_...png` (logo).
- **Supabase proje ID belirsizliği:** Hafıza notlarında iki farklı proje ref görünmüş (`cgkznastqbegwsjziptr` vs `dasjizfrqjnzuwhybjdi`) — migration çalıştırmadan önce hangisinin canlı olduğu doğrulanmalı.

**Bağlanmamış ama alanı hazır entegrasyonlar:** ClickUp (`projects.clickup_task_id`), QuickBooks (`quickbooks_ref`). **Planlı:** Slack/WhatsApp bildirimleri, AI v2/v3.

---

## 25. Yeni Özellik Eklerken Kontrol Listesi

1. **Veri katmanı:** Yeni `supabase/migrations/0xx_name.sql` (en yüksek +1 → şu an 044, yeni **045**). RLS'i ENABLE et + en az bir SELECT policy. Sık filtrelenen sütuna index. Realtime gerekiyorsa publication'a ekle. `types/database.ts`'e interface ekle (elle). Migration'ı Supabase'de elle uygula.
2. **Backend:** `app/api/<feature>/route.ts`. RLS aşman gerekiyorsa `createAdminClient()` + `requireRole([...])`. Yazmada `logAudit()`.
3. **Yetki:** `catalog.ts`'e `page.*`/`edit.*`/`view.*`/`sign.*`/`notify.*` anahtarı; `PAGE_ROUTES` + `DEFAULT_PERMISSIONS` güncelle; seed migration.
4. **Frontend:** `app/(platform)/<feature>/page.tsx` (server, `requirePage`) + `components/platform/<feature>/<Feature>Client.tsx`. Sidebar'a nav.
5. **İş akışına bağlanıyorsa:** Yeni doküman tipi → `types/database.ts` `DocType` + `paths.ts` + `steps.ts` + `stageConfig.ts`. Yeni üretim tipi → `paths.ts` `PROD_TYPES` + `board.ts` `categoryToType`.
6. **Güvenlik:** `tlines_pm` bu veriyi görmeli mi? Görmemeliyse RLS + AI araçları (`assistantTools.ts`) + field seviyesi. Dropbox'a dokunuyorsa değişmezlik kuralları.
7. **Doğrulama:** `npm run build` + manuel davranış testi.

---

## HIZLI REFERANS — Ana Dosya Haritası

| Konu | Ana dosya(lar) |
|---|---|
| Kimlik/oturum | `middleware.ts`, `lib/supabase/{server,client,admin}.ts` |
| İzinler | `lib/permissions/{catalog,server,can,requirePage,requireApi}.ts` |
| RLS | `supabase/migrations/002_rls_policies.sql` |
| Şema | `supabase/migrations/001_*.sql` + 005/013/014/020/022/023/024, `types/database.ts` |
| İş akışı | `lib/workflow/{machine,steps}.ts` |
| Onay/imza | `app/api/projects/[id]/doc-approvals/route.ts`, `lib/approvals/stageConfig.ts`, `lib/versions.ts` |
| Dropbox | `lib/dropbox/{paths,client,upload}.ts` |
| Üretim panosu | `lib/production/board.ts`, `app/api/production/*` |
| PDF | `lib/pdf/*` |
| AI | `app/api/ai/assistant/route.ts`, `lib/ai/assistantTools.ts` |
| Satış/CRM | `app/api/leads/*`, `lib/sales/*`, `components/platform/{leads,sales}/*` |
| Bölge/servis | `lib/regions.ts` |
| E-posta | `lib/email/send.ts` |
| Denetim | `lib/audit/log.ts` |

---

*Bu özet, kod tabanının güncel hali (2026-07-10) incelenerek üretilmiştir. Belirli bir modülün daha derin analizi gerekirse ilgili dosyalar yukarıdaki haritadan bulunabilir.*
