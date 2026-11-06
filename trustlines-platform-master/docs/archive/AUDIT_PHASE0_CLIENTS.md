# Phase 0 Audit — `clients` / `client_companies` Usage & Safe Rename Map

> **Amaç / Purpose:** `PROJECT-MASTER-PLAN.md` bölüm 14, Phase 0 ("Audit ve isim haritası") çıktısı.
> Bu belge, `clients` ve `client_companies` tablolarının gerçek kullanımını kanıtlarıyla dökümanlar,
> hangi alanların **gerçekten rename** gerektirdiğini, hangilerinin **sadece UI label** olduğunu ayırır
> ve güvenli bir migration + backward-compatibility planı sunar.
>
> Tarih: 2026-07-10 · Yöntem: repo genelinde statik audit (node_modules hariç).
> **Bu bir audit belgesidir; hiçbir tablo/kolon rename edilmemiştir (CLAUDE.md kuralı: audit'ten önce rename yok).**

---

## 0. Yönetici Özeti (TL;DR)

1. **`clients` tablosu bir END CUSTOMER değildir.** Canlı sistemde bir **T-Lines bölgesi / business unit** olarak
   kullanılıyor. Kanıt: `profiles.pm_client_id` (bölgesel Client PM), `profiles.sales_region_id` (satış bölgesi),
   ve UI'da doğrudan **"Region"** olarak etiketlenmesi (NewProjectForm: *"A client row IS a region"*, `+ Add new region`).
2. **`client_companies` tablosu bir "Service / Service Line"dır** (ör. "Store Maker"). UI'da **"Service"** olarak
   etiketli, `margin_pct` taşır ve bir `service_line` değerine map edilir.
3. **UI-label düzeltmesi büyük ölçüde ZATEN YAPILMIŞ.** Kullanıcının gördüğü ekranlar "Region" / "Service" diyor.
   Geriye kalan `client*` isimleri **veritabanı tablo/kolon adları ve kod tanımlayıcıları** seviyesinde.
4. **İki paralel model var:** Legacy FK modeli (`clients` + `client_companies` + `projects.client_id/client_company_id`)
   ile migration 028'de eklenen düz metin modeli (`projects.region` + `projects.service_line`, kaynak `lib/regions.ts`).
   Yeni projeler her iki alanı da doldurur.
5. **`client_franchises` fiilen ölü** — UI'da kullanılmıyor, `projects.client_franchise_id` her yeni projede `null`.
6. **KARAR / RECOMMENDATION:** `clients` → `tlines_regions` gibi **fiziksel bir rename YAPMA**. Riski yüksek,
   faydası düşük (kullanıcı zaten "Region" görüyor). Bunun yerine:
   - Rename'i **read-only Postgres VIEW alias** (`tlines_regions`, `service_lines`) ile ADDITIVE yap (geriye dönük uyumlu).
   - **End Customer** ihtiyacını **yeni `customers` / `customer_contacts` tabloları** ile karşıla (Phase 1). Bu, `clients`
     ile çakışmaz ve terminoloji karışıklığını asıl çözen adımdır.
7. **Bu audit'in engellediği hata:** `clients`'ı end-customer sanıp rename/migrate etmek 6 tabloda FK,
   2 RLS-bağımlı alan, Dropbox path üretimi, PF/PO/doc generation ve satış intake'ini kırardı.

---

## 1. Tablolar — Gerçek Anlam ve Şema Durumu

| Tablo | Gerçek iş anlamı | Şema kaynağı | Not |
|---|---|---|---|
| `clients` | **T-Lines Region / Business Unit** (kod + isim) | `001_initial_schema.sql:48` | UI'da "Region". Seed: `004_seed_data.sql:18`. |
| `client_companies` | **Service / Service Line** (ör. Store Maker), `margin_pct` taşır | ⚠️ **CREATE TABLE repo'da YOK** — sadece `022`/`017` ALTER'ları var | Migration 022 `client_id` ekleyip franchise'ı nullable yaptı. |
| `client_franchises` | **Legacy** franchise tier — fiilen ölü | ⚠️ **CREATE TABLE repo'da YOK** — sadece `017` FK ALTER'ı var | UI'da kullanılmıyor. |

> **Şema boşluğu (gap):** `client_companies` ve `client_franchises` tablolarının `CREATE TABLE` ifadeleri
> repo migration klasöründe **bulunmuyor** (migration 003 numarası atlanmış). Bu tablolar canlı DB'de var ama
> repo'dan sıfırdan kurulamaz. Rename/migration planı bunu hesaba katmalı: **önce bu iki tablonun canlı DDL'i
> `pg_dump` ile çıkarılıp bir "baseline" migration olarak repo'ya eklenmeli.**

### `clients`'ın "Region" olduğunun kanıtları
- `supabase/migrations/023_regional_and_supervisor_pm.sql:8` → `profiles.pm_client_id → clients(id)` = **bölgesel Client PM** ataması.
- `supabase/migrations/025_sales_marketing_roles.sql:44` → `profiles.sales_region_id → clients(id)` = **satış bölgesi**.
- `components/platform/projects/NewProjectForm.tsx:81` → yorum: *"A client row IS a region (see migration 025)"*.
- `NewProjectForm.tsx:883` → UI label **"Region"**, `NewProjectForm.tsx:909` → **"+ Add new region"**.
- `regionCodeForClient()` (NewProjectForm.tsx:84) client kodunu sabit REGION koduna (`NE`/`CVW`/`W`) map ediyor.

### `client_companies`'ın "Service" olduğunun kanıtları
- `NewProjectForm.tsx:70-71` → yorum: *"The existing 'Service' (client_company) name → a service_line value"*.
- `NewProjectForm.tsx:941` → UI label **"Company (service) — hangs under the region"**.
- `app/(platform)/clients/page.tsx:24` → yorum: *"Services (client_companies) hang directly under the client now"*.
- `margin_pct` alanı burada → **hassas alan**, `tlines_pm` görmemeli.

---

## 2. Kullanım Envanteri (nerede, ne için)

Toplam: `\bclients\b` 112 eşleşme / 38 dosya; `client_companies` 28 / 14; `client_id|client_company_id|client_franchise|pm_client_id` 165 / 33 (belgeler dahil).
Aşağıda **kod** kullanımları katmanlara göre gruplandı (belgeler hariç).

### 2.1 Veritabanı (migrations) — FK ve DDL bağımlılıkları
| Yer | Referans | Tür |
|---|---|---|
| `001_initial_schema.sql:48,61` | `CREATE TABLE clients`, `projects.client_id → clients(id)` | Tablo + FK |
| `004_seed_data.sql:18` | `INSERT INTO clients` | Seed |
| `017_profile_fk_set_null.sql:54` | `client_franchises.pm_id` FK | ALTER |
| `022_company_under_client.sql` | `client_companies.client_id → clients(id)` + index | ALTER |
| `023_regional_and_supervisor_pm.sql:8` | `profiles.pm_client_id → clients(id)` | FK (region PM) |
| `025_sales_marketing_roles.sql:44` | `profiles.sales_region_id → clients(id)` | FK (sales region) |
| `029_lead_intake.sql:23` | `lead_intake.client_id → clients(id)` | FK |
| `031_projects_draft_rls.sql:11` | yorumda "admin clients" (Supabase client, ilgisiz) | Yorum |

> **RLS notu:** `002_rls_policies.sql` **`clients`'a hiç dokunmuyor**. `projects` RLS'i `client_id`'ye değil,
> assignee id'lerine (`tlines_pm_id` vb.) ve `doc_type`'a dayanıyor. Yani `clients` rename'i **projects RLS'ini kırmaz**.
> Ancak `clients`/`client_companies` tablolarının kendi RLS durumu repo'da görünmüyor (muhtemelen kapalı) —
> yeni `customers` tablolarında RLS **açık** olmalı.

### 2.2 Tipler
- `types/database.ts` → `Client` (86), `ClientFranchise` (95), `ClientCompany` (106) interface'leri;
  `Project.client_id/client_franchise_id/client_company_id` (120-122); `Database` map (337-339); `lead_intake.client_id` (269).

### 2.3 API route'ları (server)
| Route | Kullanım |
|---|---|
| `app/api/projects/[id]/generate-pf/route.ts:59` | `clients.select('name')` → PF başlığındaki **region adı** (hassas değil) |
| `app/api/projects/[id]/generate-po/route.ts` | aynı: region adı PO'da |
| `app/api/projects/[id]/generate-doc/route.ts` | aynı |
| `lib/pdf/signPdf.ts` | client (region) adını PDF'e basar |
| `app/api/projects/lookup-dropbox-client/route.ts` | Dropbox path'inden client(region)+company(service) eşleştirme |
| `app/api/team/[id]/route.ts`, `team/invite/route.ts` | `pm_client_id` (region) atama |
| `app/api/ai/assistant/route.ts` + `lib/ai/assistantTools.ts` | `clients_and_services` aracı → region+service listeler |

### 2.4 UI / sayfalar
| Yer | Kullanım |
|---|---|
| `app/(platform)/clients/page.tsx` + `components/platform/clients/ClientsPageClient.tsx` | Region+Service yönetim ekranı (nav: "Clients") |
| `components/platform/projects/NewProjectForm.tsx` | Region seç / Service seç / yeni region ekle (en yüksek kuplaj: 27 ref) |
| `app/(platform)/projects/[id]/page.tsx`, `.../edit/page.tsx`, `projects/page.tsx` | Proje join'leri client_id/company_id |
| `app/(platform)/team/page.tsx` + `TeamPageClient.tsx` | Region PM atama (`pm_client_id`) |
| `components/platform/shell/Sidebar.tsx` | Nav item "Clients" |
| `lib/permissions/catalog.ts` | `page.clients`, `edit.clients` izin anahtarları |
| `lib/regionLogo.ts`, `components/platform/dropbox/DropboxWizard.tsx` | Region logosu / Dropbox sihirbazı |

---

## 3. Rename-Gerekli mi? — Alan Alan Ayrım

| Öğe | Sınıf | Karar |
|---|---|---|
| UI etiketleri ("Client" → "Region"/"Service") | **Sadece label** | ✅ Büyük ölçüde **zaten yapılmış**. Kalan tek yer: Sidebar nav "Clients" + `page.clients` başlığı → "Regions & Services" olarak label değişebilir (DB'ye dokunmadan). |
| `clients` tablo adı | Fiziksel isim | ⛔ **Rename etme.** VIEW alias `tlines_regions` ile additive expose et. |
| `client_companies` tablo adı | Fiziksel isim | ⛔ **Rename etme.** VIEW alias `service_lines`. |
| `client_franchises` | Ölü tablo | 🟡 Dokunma; ileride ayrı bir "deprecate" migration'ında ele alınır. |
| `projects.client_id` | FK kolon | ⛔ Rename etme (6+ dosya, PF/PO/Dropbox). Anlamı "region_id". Gerekirse generated/alias kolon. |
| `projects.client_company_id` | FK kolon | ⛔ Rename etme. Anlamı "service_id". |
| `projects.client_franchise_id` | Ölü kolon | 🟡 Bırak (hep null). |
| `profiles.pm_client_id` | FK kolon | ⛔ Rename etme. Anlamı "pm_region_id". |
| `profiles.sales_region_id` | FK kolon | ✅ Zaten doğru adlandırılmış (region). |
| `lead_intake.client_id` | FK kolon | ⛔ Rename etme. |
| `client_companies.margin_pct` | Hassas alan | 🔒 Rename ile ilgisiz; `tlines_pm`'e sızmamalı (mevcut kural korunur). |
| **End Customer kavramı** | **Eksik model** | ➕ **Yeni tablolar** (`customers`, `customer_contacts`, ...) — Phase 1. Bu asıl çözüm. |

---

## 4. Güvenli Migration & Backward-Compatibility Planı

**İlke:** Additive (ekleyici), non-breaking, rollback'lenebilir. Fiziksel rename YOK.

### Adım A — Baseline (önce boşluğu kapat)
`client_companies` ve `client_franchises` için canlı DB'den `pg_dump --schema-only -t` ile DDL çıkar,
`045_baseline_client_companies.sql` olarak repo'ya ekle (yalnızca `CREATE TABLE IF NOT EXISTS`). Bu, repo'nun
sıfırdan kurulabilirliğini geri kazandırır. *(Uygulama gerektirmez; repo bütünlüğü için.)*

### Adım B — Terminoloji alias'ları (read-only, opsiyonel)
```sql
-- 046_terminology_aliases.sql (ADDITIVE, geri alınabilir)
CREATE OR REPLACE VIEW tlines_regions AS SELECT * FROM clients;
CREATE OR REPLACE VIEW service_lines  AS SELECT * FROM client_companies;
```
Kod tabanı bunları kullanmak zorunda değil; yeni kod okunabilirlik için tercih edebilir. `clients` yazma yolu
değişmeden çalışmaya devam eder. Rollback = `DROP VIEW`.

### Adım C — End Customer modeli (Phase 1'in migration'ı, bu audit'in DIŞINDA)
`customers`, `customer_contacts`, `customer_addresses`, `project_customer_contacts` **yeni** tablolar (RLS açık).
`clients` ile çakışmaz. Lead intake'teki serbest metin `customer_name/brand/contact_person` → yapısal `customers`'a
bağlanır. Bu, "clients ≠ customer" karışıklığını **isim değiştirmeden** çözer.

### Yapılmayacaklar (CLAUDE.md yasakları)
- `clients`/`client_companies` fiziksel rename **YOK** (audit sonucu: gereksiz + riskli).
- Uygulanmış migration'ları düzenleme **YOK** — hep yeni forward migration.
- `user_role` enum'a migration **YOK** (rol TEXT).
- Yeni migration numarası: repo'daki gerçek en yüksek = **044** → sıradaki **045**.

---

## 5. Diğer Phase 0 İnceleme Kalemleri

### 5.1 Lead → Project dönüşümü
`app/api/leads/[id]/deliver/route.ts` incelendi. Bulgular:
- Draft `projects` kaydı intake **Block 1**'de erkenden oluşuyor (`lead_intake.project_id` set). "Deliver" bunu
  `is_draft=false` yapıp `region`/`service_line`/`site_location`/`categories`'i projeye yazıyor.
- Plan/layout dosyaları `documents`'a **metadata olarak** bağlanıyor (Dropbox'ta dosya taşınmıyor — kural korunmuş).
- Phase-1 adımları (`closed_deal`, `plan_layout`) done işaretleniyor; sonraki stage `getNextStage` ile **dinamik**.
- **Tek Project ID ilkesi korunuyor** — ayrı Sales/PM proje kaydı açılmıyor. ✅
- **Boşluk:** Dönüşüm bir **End Customer** kaydı oluşturmuyor; müşteri bilgisi `lead_intake`'te serbest metin
  kalıyor. Phase 1 (customers) tam da bunu bağlayacak.

### 5.2 Document approval flow
`app/api/projects/[id]/doc-approvals/route.ts` + `lib/approvals/stageConfig.ts` + `lib/versions.ts` (SYSTEM_ARCHITECTURE §13).
- İki mod: `initiate` (imza satırları) / `approve|reject`. Assignee'ler `initiate` anında çözülüyor.
- Zincirler doc tipine göre: plan_layout/proposal=ClientPM; construction=TrustPM→ClientPM;
  PO=ClientPM→GM→Accountant(ops)→PMSupervisor(anytime); bundle=ProdMgr→TrustPM→ClientPM; PF=4 imzacı.
- Versiyon: TrustPM imzası DRAFT'ı bitirir; ClientPM red → V{n+1} + yeni Dropbox klasörü.
- **Korunacak** — Phase 4/5/6 type-level proposal/approval eklenirken bu motor **genişletilmeli**, yeniden yazılmamalı.
  Yeni "approval route" (T-LINES_PM_ONLY / END_CUSTOMER_DIRECT / BOTH) bu yapının üstüne eklenmeli.

### 5.3 Production type modeli
`production_items` (migration 014) + `lib/production/board.ts` + `lib/dropbox/paths.ts` `PROD_TYPES` (SYSTEM_ARCHITECTURE §15).
- Bir satır = proje × tip. Tipler: Millwork/Shelving/Ceiling/Image/Furniture/Decoration.
- STATUS_CHAIN + tarih otomasyonu; `pf_usd`/`pf_tl` **hassas** (`tlines_pm` göremez).
- Master plan §4.5'teki "type-level owner/status/workflow" bu tabloyla **uyumlu**; Phase 4'te `project_types` /
  `project_type_assignments` eklenirken `production_items` bağlanmalı, kopyalanmamalı.

---

## 6. Sonraki Adım (Phase 1)
Bu audit, Phase 1 — **Customer Management V1**'i açar. Sıradaki iş:
`045_customers.sql` (customers + RLS + index) → types → API → Customer list + 360 detay → lead↔customer bağlama.
`clients` tablosuna DOKUNULMAZ.
