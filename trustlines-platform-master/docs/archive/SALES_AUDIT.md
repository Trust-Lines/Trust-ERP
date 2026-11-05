# SALES_AUDIT.md — Sales / CRM Dashboard Teşhis Raporu

> **Kapsam:** Salt-okunur denetim. Hiçbir dosya değiştirilmedi, hiçbir migration/script çalıştırılmadı,
> canlı DB'ye yalnızca SELECT sorguları atıldı (Supabase service-role client, throwaway `.mts` scriptleri
> ile — rapor sonunda silindi, `git status` temiz).
>
> **Tarih:** 2026-08-20 · **Repo:** `c:\Users\Trust\Desktop\Trust\trustlines-platform`
>
> **Kritik ön-bulgu:** `PROJECT-MASTER-PLAN.md`'nin CHANGE LOG'u **2026-08-11 / migration 086**'da
> bitiyor. Ama repodaki gerçek en yüksek migration **104**'tür (`104_opportunity_potential_external_project_code.sql`,
> 2026-08-20). Migration **087–104** (ClickUp import'un tamamı dahil) `PROJECT-MASTER-PLAN.md`'de
> **hiç belgelenmemiş** — ne CURRENT STATUS'ta ne CHANGE LOG'da. Bu, kullanıcı hafıza notlarındaki
> "highest migration 086" bilgisinin neden yanlış olduğunu da açıklıyor. Bu denetimin bulgularının
> çoğunun kök nedeni budur: **ClickUp import'u, bu projenin standart "audit → migration → RLS → tip →
> UI → changelog" iş akışının tamamen dışında, script'ler üzerinden ilerlemiş bir seri** ve dashboard'lar
> hiç güncellenmemiş.

---

# 1. ROUTE ENVANTERİ

## 1.1 `app/(platform)/...` altındaki tüm Sales/CRM sayfaları

```
app/(platform)/leads/page.tsx                          → /leads              (CRM Board — birleşik)
app/(platform)/leads/new/page.tsx                       → /leads/new          (Quick Deal)
app/(platform)/leads/[id]/page.tsx                      → /leads/[id]         (lead detay)
app/(platform)/leads/trash/page.tsx                     → /leads/trash
app/(platform)/sales-dashboard/page.tsx                 → /sales-dashboard
app/(platform)/sales-tasks/page.tsx                     → /sales-tasks
app/(platform)/sales-projects/page.tsx                  → /sales-projects     (Handoffs)
app/(platform)/sales-team/page.tsx                      → /sales-team
app/(platform)/marketing/page.tsx                       → /marketing
app/(platform)/marketing/prospects/page.tsx              → /marketing/prospects        (Lead Cloud)
app/(platform)/marketing/prospects/new/page.tsx          → /marketing/prospects/new
app/(platform)/marketing/prospects/[id]/page.tsx          → /marketing/prospects/[id]
app/(platform)/marketing/opportunities/page.tsx           → /marketing/opportunities    (gerçek birleşik board)
app/(platform)/marketing/potentials/page.tsx               → /marketing/potentials       (→ REDIRECT /marketing/opportunities)
app/(platform)/marketing/campaigns/page.tsx                 → /marketing/campaigns
app/(platform)/marketing/campaigns/new/page.tsx              → /marketing/campaigns/new
app/(platform)/marketing/campaigns/[id]/page.tsx              → /marketing/campaigns/[id]
app/(platform)/marketing/campaigns/[id]/edit/page.tsx          → /marketing/campaigns/[id]/edit
app/(demo)/live-dashboard-demo/...                       → /live-dashboard-demo         (izole, DB yok)
app/(demo)/production-dashboard-demo/...                  → /production-dashboard-demo   (izole, DB yok)
app/(demo)/pipeline-dashboard-demo/...                      → /pipeline-dashboard-demo     (izole, DB yok)
```

## 1.2 Sidebar (`components/platform/shell/Sidebar.tsx`) nav tablosu

| Label | Href | Sayfa var mı | Rol gate | Gerçek veri mi / stub mu |
|---|---|---|---|---|
| CRM Board | `/leads` | ✅ (`app/(platform)/leads/page.tsx`) | `perm: page.leads` ama bu key **catalog.ts'te YOK** → `bypassPerm` ile render edilir; gerçek erişim kontrolü sayfa içinde `BOARD_ALLOWED_ROLES = LEADS_ALLOWED_ROLES + MARKETING_ROLES` (satır 14-19) | Gerçek veri — `lead_intake` (Sales) + `opportunities`/`prospect_potentials` (Marketing, `lib/marketing/opportunityRows.ts` + `potentialRows.ts` ile birleştirilir) |
| Quick Deal (Sales) | `/leads/new` | ✅ | `page.leads` (bypassPerm ile) | Gerçek yazma — proje numarası rezerve eder, Dropbox klasörü açar |
| Tasks | `/sales-tasks` | ✅ | `page.leads` | Gerçek veri (`lead_tasks`) |
| Handoffs | `/sales-projects` | ✅ | `page.leads` (sayfa içi `SALES_HANDOFF_ROLES`) | Gerçek veri — `opportunities` tablosundan `sales_handoff/sales_accepted/...` aşamalarını okur |
| Dashboard (Sales) | `/sales-dashboard` | ✅ | `page.sales_dashboard` (yalnız `isSalesAdmin`'e görünür) | **Gerçek ama YANLIŞ tablo** — yalnız `lead_intake`'i okur (bkz. §4) |
| Sales Team | `/sales-team` | ✅ | `page.sales_team` | Gerçek veri |
| Trash | `/leads/trash` | ✅ | `page.leads` | Gerçek veri (`lead_intake` soft-delete, 30 gün) |
| Lead Cloud (Capture new) | `/marketing/prospects` | ✅ | `page.marketing` | Gerçek veri (`prospects`, 1000 satır) |
| Potentials | `/marketing/potentials` | ✅ ama **redirect stub** | `page.marketing` | Sayfanın kendisi 8 satırlık bir `redirect('/marketing/opportunities')` — kod isteyerek böyle bırakılmış (bkz. dosyanın kendi yorumu), ölü link değil ama **nav etiketi ile hedef sayfa içeriği uyuşmuyor** (tıklayan "Potentials" bekler, "Opportunities" board'una düşer) |
| Campaigns & Surveys | `/marketing/campaigns` | ✅ | `page.marketing_campaigns` | Gerçek veri AMA **migration 086 canlıya UYGULANMAMIŞ** olsaydı 500 verirdi — canlı DB'de tablo VAR (aşağıda doğrulandı), yani bu artık uygulanmış durumda |
| Demo Dashboards (grup) | `/live-dashboard-demo`, `/production-dashboard-demo`, `/pipeline-dashboard-demo` | ✅ (üçü de var) | `isFullAuthority` (yalnız ops_manager/general_manager), `bypassPerm` | **Sahte veri** — `app/(demo)/*` route grubu; her sayfanın kendi başlığında "ISOLATED DEMO ROUTE ... mock/frontend-only, no DB, no API" yazıyor. `components/demo/LiveDashboard.tsx` DB'ye hiç dokunmaz. **Bu üçü PF/vendor-cost/margin GÖRÜNÜMLÜ ama sahte veri gösteriyor** — gerçek sistemle karıştırılma riski var (isimleri "Sales Dashboard", "Production Dashboard", "Full Pipeline" — gerçek sayfalarla neredeyse aynı isimler). |

## 1.3 Ölü link / 404 / boş stub

- **Yok** — Sidebar'ın kendi kod yorumu (satır 64-66) "her href gerçek bir sayfaya çözülmeli" kuralını
  koyuyor ve `/qc` için geçmişte yaşanan 404'ü örnek veriyor; bu denetimde incelenen tüm CRM/Sales href'leri
  gerçek bir `page.tsx`'e çözülüyor.
- **Yarı-stub:** `/marketing/potentials` — sayfa var ama içeriği yok, sadece redirect (yukarıda not edildi).
  Fonksiyonel olarak 404 değil ama kullanıcı deneyimi açısından "Potentials'a tıkladım, farklı bir board'a
  düştüm" şaşkınlığı yaratabilir.
- **Kavramsal çakışma değil ama isim çakışması riski:** Demo Dashboards grubundaki "Sales Dashboard" /
  "Production Dashboard" / "Full Pipeline" isimleri gerçek `/sales-dashboard` sayfasıyla neredeyse aynı;
  ops_manager/general_manager için ikisi de sidebar'da yan yana durur.

---

# 2. VERİ MODELİ GERÇEĞİ

## 2.1 Kavram → tablo eşlemesi

| Kavram | Tek gerçek kaynak tablo | Not |
|---|---|---|
| **Lead** (Marketing'in ilk yakaladığı ham kayıt) | `prospects` (+ `prospect_contacts`, `prospect_locations`) — migration 072 | UI'da "Prospect" kelimesi hiç geçmez; "Lead Cloud / Lead / Potential / Opportunity" dili kullanılır (migration 073) |
| **Prospect** (teknik ad) | `prospects` | Yukarıdakiyle aynı tablo — "Lead" ve "Prospect" AYNI şeyin iki adı, iki farklı tablo DEĞİL |
| **Need** (bir prospect'in somut bir ihtiyacı/sitesi) | `prospect_needs` — migration 076 | Bir prospect'in birden fazla need'i olabilir |
| **Potential** (henüz olgunlaşmamış need) | `prospect_potentials` — migration 076 | `need_id` + `prospect_id` FK'leri var; `converted_opportunity_id` ile Opportunity'ye dönüşür |
| **Opportunity** (olgun, satılabilir fırsat) | `opportunities` — migration 075 | `prospect_id` + `need_id` FK'leri var |
| **Lead (Sales'in ClickUp-tarzı kaydı)** | `lead_intake` — migration 029+ | **Marketing'in Prospect/Opportunity'sinden TAMAMEN AYRI bir tablo.** `SYSTEM_ARCHITECTURE.md` §18'in tarif ettiği eski "Satış CRM" burasıdır. Canlıda yalnız **4 satır** var (bkz. §3). |
| **Customer / End Customer** | `customers` (+ `customer_contacts`, `customer_addresses`) — migration 045 | `clients`/`client_companies` DEĞİL (onlar Region/Service Line) |
| **Project** | `projects` | Merkez tablo; `customer_id`, `client_id` (region), `client_company_id` (service) FK'leri var |

**FK zinciri (gerçek satış-tarafı akış):**
`prospects` → `prospect_needs` → (`prospect_potentials` VEYA `opportunities`) → [Sales Handoff, `opportunities.stage`] → `projects` (via `opportunities.project_id`, migration 079 "sales handoff" köprüsü) → `customers` (via `projects.customer_id`, migration 048).

`lead_intake` bu zincirin **dışında**, kendi ayrı akışına sahip: `lead_intake` → `deliver()` (`lib/sales/deliver.ts`) → `projects` (doğrudan, `opportunities` tablosuna hiç uğramadan).

## 2.2 Örtüşen / rekabet eden tablolar

**Evet — iki paralel "Lead/Opportunity" sistemi canlı olarak bir arada duruyor:**

1. **Eski sistem (2026 Temmuz öncesi, "Satış CRM"):** `lead_intake` + `lead_tasks` + `lead_activity` +
   `lead_watchers`. Sidebar'da "Quick Deal (Sales)" / "Tasks" / "Handoffs (kısmen)" / "Trash" bu tabloyu
   besler. **Canlıda yalnız 4 satır.**
2. **Yeni sistem (Phase 00, migration 072+, ve şimdi ClickUp import'la 2026-08-12→20 arası devasa
   büyütülmüş):** `prospects` (1000) → `prospect_needs` → `opportunities` (561) / `prospect_potentials` (117).

Bu iki sistem **kasıtlı olarak bağlı** — CRM Board (`/leads`) `lib/marketing/opportunityRows.ts` ve
`potentialRows.ts` ile ikisini tek listede birleştiriyor, kod bunu açıkça yorumluyor (Sidebar.tsx satır
102-110: *"what was two separate top-level sections is now ONE 'CRM' group"*). Yani **CRM Board'un kendisi
artık birleşik** — asıl kopukluk board'da değil, **dashboard'larda**: `/sales-dashboard` hâlâ yalnızca eski
`lead_intake` tablosunu okuyor ve yeni 561+117 satırlık gerçek veriyi hiç görmüyor (bkz. §4).

`client_franchises` "Legacy — artık UI'da kullanılmıyor" olarak işaretli (`CURRENT_SYSTEM_STATE.md` §9) —
başka bir eski/terk edilmiş tablo, ama Sales/CRM'e özgü değil.

## 2.3 En yüksek migration ve canlı DB durumu

**Repodaki en yüksek migration: `104_opportunity_potential_external_project_code.sql`** (103 dosya toplam,
001→104; bazı numaralar — 027, 032 gibi — supersede edilmiş/atlanmış olabilir, gerçek dosya sayısı 103).

Canlı DB'ye karşı gerçek şema probu (SELECT ile, dosya varlığına GÜVENMEDEN):

| Migration | İçerik | Canlı durum |
|---|---|---|
| 088 | `prospects.external_ref` | ✅ UYGULANMIŞ |
| 089 | `campaign_interactions.interaction_type` | ✅ UYGULANMIŞ |
| 090 | `prospect_needs.external_ref` | ✅ UYGULANMIŞ |
| 091 | `prospect_potentials` tablosu | ✅ UYGULANMIŞ |
| **092** | `prospect_contacts.checklist` | 🔴 **UYGULANMAMIŞ** — canlı hata: `column prospect_contacts.checklist does not exist` |
| **093** | `prospect_contacts.order_index` (numeric) | 🔴 **UYGULANMAMIŞ** — canlı hata: `column prospect_contacts.order_index does not exist` |
| 094 | `opportunities.external_stage_label` | ✅ UYGULANMIŞ |
| 095 | `prospect_files` tablosu | ✅ UYGULANMIŞ |
| 096 | `prospects.tags` | ✅ UYGULANMIŞ |
| 097 | `prospects.external_created_at` | ✅ UYGULANMIŞ |
| 098 | `prospect_contacts.external_ref` | ✅ UYGULANMIŞ |
| 099 | `opportunities.source_description_raw` | ✅ UYGULANMIŞ |
| 100 | `opportunities.auto_managed` | ✅ UYGULANMIŞ |
| 101 | `lead_tasks.potential_id` | ✅ UYGULANMIŞ |
| 086 | `marketing_campaigns`, `survey_submissions` | ✅ UYGULANMIŞ (kullanıcı hafızasındaki "unapplied" notu **artık GÜNCEL DEĞİL**) |
| 103 | `opportunities.stage = 'working_on_it_trust'` | ✅ UYGULANMIŞ (13 satır bu stage'de canlı bulundu) |
| 104 | `external_project_code` (opportunities + potentials) | ✅ UYGULANMIŞ |

**Sonuç: repo 104'te, canlı DB de 104'e neredeyse tam paralel — yalnız 092 ve 093 (prospect_contacts'a
checklist/order_index ekleyen küçük migration'lar) canlıda eksik.** Bu, "checklist" veya sıralama özelliğini
kullanan herhangi bir UI kodu varsa orada 400/500 hatası riski demektir (bu denetim UI kodunu bu spesifik
noktada test etmedi — kod muhtemelen mevcut kolonlara graceful-fallback yapıyor, ama doğrulanmadı → BİLİNMİYOR).

**PROJECT-MASTER-PLAN.md'nin CURRENT STATUS'u "Highest migration: 064" diyor ve "live DB is behind the
repo (059, 062 eksik)" diyor — bu bilgi 2026-07-14 tarihli ve şu an 40 migration geride, tamamen bayat.**
CHANGE LOG'un son girdisi 086/2026-08-11. **87-104 arası (ClickUp import'un TAMAMI) hiçbir CHANGE LOG
girdisine sahip değil.**

---

# 3. CLICKUP IMPORT TEARDOWN

## 3.1 Import script/route dosyaları (tam yol)

Doğrudan ClickUp API'sine bağlanan, **yalnızca GET/okuma** yapan istemci: `lib/clickup/client.ts`.

| Dosya | Rol |
|---|---|
| `scripts/clickup-discover.mts` | Keşif — liste/görünüm ID'lerini bulur |
| `scripts/clickup-import-dry-run.mts` | Contacts import kuru-çalıştırma |
| `scripts/clickup-import-write.mts` | **Contacts → `prospects`/`prospect_contacts`/`prospect_locations` GERÇEK yazma** (migration 088/089/098 şart koşuyor) |
| `scripts/clickup-import-opportunities.mts` | **Opportunities/Potentials → `prospect_needs`/`opportunities`/`prospect_potentials` GERÇEK yazma** (`--write` bayrağı olmadan dry-run) |
| `scripts/clickup-import-contact-details.mts` | Ek contact alanı backfill |
| `scripts/clickup-inspect-opportunities.mts` | Tanı/inceleme |
| `scripts/backfill-clickup-field-parity.mts` | Alan eşleme tamamlama (migration 094 sonrası) |
| `lib/clickup/importMapping.ts` | Contact task → `ProspectCandidate` eşleme fonksiyonu |
| `lib/clickup/importOpportunitiesMapping.ts` | Opportunity task → `OpportunityCandidate` eşleme fonksiyonu |

Bir API route değil — **tamamen elle, terminalden `npx tsx scripts/clickup-import-*.mts` ile çalıştırılan,
tek seferlik script'ler.** `npm run clickup:import` / `npm run clickup:import-opportunities` (package.json'da
tanımlı olmalı — bu denetim bunu doğrulamadı, BİLİNMİYOR).

## 3.2 ClickUp alan → DB kolon eşlemesi (script'lerden)

**Contacts import (`clickup-import-write.mts` + `lib/clickup/importMapping.ts`):**

| ClickUp alanı | DB kolonu | Tablo |
|---|---|---|
| task adı / entity type | `organization_name` / `person_name` | `prospects` |
| website | `website` | `prospects` |
| email | `main_email` + `prospect_contacts.email` | her ikisi |
| phone | `main_phone` + `prospect_contacts.phone` | her ikisi |
| business type(s) | `business_types` | `prospects` |
| "13-SOURCE" custom field | `source_label`/`source_raw_label`/`campaign_id` (kampanyaya sınıflanırsa) | `prospects` |
| X-Note | `x_note` | `prospects` |
| tags | `tags` | `prospects` |
| created tarihi | `external_created_at` | `prospects` |
| task.id | `external_ref` (idempotency anahtarı) | `prospects`, `prospect_contacts` |
| title/job title | `title` | `prospect_contacts` |
| LinkedIn | `linkedin_url` | `prospect_contacts` |
| WhatsApp | `whatsapp` | `prospect_contacts` |
| ikincil telefon | `company2_phone` | `prospect_contacts` |
| state/adres/lat-lng/mailing address | `state`/`address_line_1`/`latitude`/`longitude`/`mailing_address` | `prospect_locations` |
| "shows attended" | `campaign_interactions` satırları (her biri ayrı kampanya) | `campaign_interactions` |

**Opportunities import (`clickup-import-opportunities.mts` + `importOpportunitiesMapping.ts`):**

| ClickUp alanı | DB kolonu | Tablo |
|---|---|---|
| Status OP | `stage` (opportunities) / `status` (potentials) + ham değer `external_stage_label` | `opportunities`/`prospect_potentials` |
| site/deal adı | `title` | her ikisi |
| Deal Size | `estimated_value` | her ikisi |
| Due Date | `deadline`(opp) / `due_date`(pot) | her ikisi |
| Date Done | yalnız potentials'ta `date_done`; opportunities'te closed ise `closed_at` | — |
| Deposit / Payment | `deposit`, `payment_raw` | her ikisi |
| Targeted | `targeted` | her ikisi |
| ClickUp Project # | `external_project_code` | her ikisi (migration 104) |
| Contact (relation field) | `primary_contact_id` (`prospects`/`prospect_contacts` üzerinden çözülür) | her ikisi |
| yorumlar (comments) | `need_notes` (author_name, body, link_url/title/thumbnail) | `need_notes` |
| Request / To Do / Direct Contact | `request_raw`/`to_do_raw`/`direct_contact_raw` | her ikisi |
| Industry / Project Type (ham) | `industry_raw`/`project_type_raw` | her ikisi |

## 3.3 Eşlenmemiş / kaybolan ClickUp alanları

Script yorumlarından ve kod okumasından tespit edilenler:

- **Assignee (ClickUp'taki gerçek atanan kişi) hiç okunmuyor** — her satır script'i çalıştıran tek bir
  "actor" hesabına (`batool@trust-lines.com`, koddaki varsayılan) atfediliyor (`marketing_owner_id`/
  `owner_id`/`assigned_to` = actorId). Yani **gerçek ClickUp sahiplik bilgisi kaybolmuş**, herkes aynı
  kişiye atanmış görünüyor.
- **Checklist alt-görevleri** (Opportunities SE/NW/W listelerindeki "Collect Information", "Initial
  meeting" gibi 196+162+... adet boş-Status-OP subtask) **kasıtlı olarak atlanıyor** (`excludeSubtasksAndBlank`)
  — bilinçli bir filtre, veri kaybı değil, ama gerçek ClickUp'taki iş listesi/checklist detayı hiç taşınmıyor.
- **`clickup_task_id` (`projects.clickup_task_id`)** — bu kolon `projects` tablosunda **var** (eski
  entegrasyon alanı, `SYSTEM_ARCHITECTURE.md` §24'te "bağlanmamış ama alanı hazır" diye not edilmiş) ama
  ClickUp import script'leri bu kolonu **hiç yazmıyor** — import edilen 561 opportunity'den hiçbiri
  `projects` tablosuna gerçek bir proje olarak düşürülmüyor, dolayısıyla bu FK hâlâ boş.
- **Native ClickUp status (to-do/complete)** bir kez atlanıyor gibi görünse de script'in kendi yorumu bunu
  düzeltiyor (2026-08-20 W import notu): "sidebar badge" yalnız native "to do" sayıyor, gerçek sayı Status
  OP alanından — bu düzeltilmiş, veri kaybı değil.

## 3.4 Canlı DB sorgu sonuçları (birebir)

**a) İmport edilen kayıt sayısı ve source dağılımı:**
```
prospects.external_source distribution:      { clickup: 990, null: 10 }
opportunities.external_source distribution:   { null: 1, clickup: 560 }
prospect_potentials.external_source distribution: { clickup: 107, null: 10 }
TOTAL prospects=1000  opportunities=561  potentials=117
```

**b) `opportunities.stage` GROUP BY:**
```
{
  new: 1,
  closed_lost: 235,
  on_hold: 102,
  proposal: 30,
  negotiation: 9,
  sales_accepted: 20,
  working_on_it_trust: 13,
  closed_won: 151
}
```

**`lead_intake.opportunity_status` GROUP BY (eski Sales tablosu, karşılaştırma için):**
```
{ new_opportunity: 4 }
```
→ **`lead_intake`'te toplam yalnızca 4 satır var, hepsi tek durumda ("new_opportunity").** Bu tablo canlı
kullanımda fiilen terk edilmiş durumda; asıl CRM hacmi (1000/561/117) tamamen `prospects`/`opportunities`/
`prospect_potentials` şemasında yaşıyor.

**c) NULL oranları (gerçek kolon adları doğrulanarak):**

`prospects` (toplam 1000):
```
organization_name NULL/blank: 171/1000 (17.1%)
main_email NULL/blank:        265/1000 (26.5%)
owner_id NULL:                0/1000 (0.0%)
assigned_marketing_user_id NULL: 2/1000 (0.2%)
region NULL:                  10/1000 (1.0%)
```

`opportunities` (toplam 561) — "customer_name" karşılığı yok (bkz. not), en yakın alanlar:
```
prospect_id NULL:             0/561 (0.0%)
marketing_owner_id NULL:      0/561 (0.0%)
estimated_value (deal_size) NULL: 268/561 (47.8%)
deadline (follow_up_date karşılığı) NULL: 501/561 (89.3%)
project_id NULL:               560/561 (99.8%)
external_project_code NULL:    9/561 (1.6%)
primary_contact_id NULL:       209/561 (37.3%)
brand NULL:                    250/561 (44.6%)
```

`prospect_potentials` (toplam 117):
```
assigned_to NULL:              1/117 (0.9%)
estimated_value NULL:          113/117 (96.6%)
converted_opportunity_id (Opportunity'ye dönüşmüş) dolu: yalnızca 1/117
```

`lead_intake` (toplam 4):
```
customer_name NULL: 4/4 (100%)
assignee_id NULL:   4/4 (100%)
deal_size NULL:     4/4 (100%)
follow_up_date NULL:4/4 (100%)
customer_id NULL:   4/4 (100%)
project_id NULL:    4/4 (100%)
```

> Not: `opportunities`/`prospects` şemasında "customer_id" veya "assignee_id" adında birebir kolon yok;
> en yakın karşılıkları yukarıda kullanıldı (`marketing_owner_id`, `prospect_id`). Soru metnindeki
> `customer_id`/`assignee_id`/`project_id`/`created_at` sütun adları **`lead_intake`'e özgü** — orada
> doğrudan sorgulandı (yukarıda).

**d) Opportunity/lead ↔ project eşleşmemişlik:**
```
opportunities içinde project_id SET olan:    1 / 561
opportunities içinde project_id NULL (proje YOK): 560 / 561  (%99.8)
canlı projects toplamı:                       18 (silinmiş dahil) / 10 (silinmemiş & arşivlenmemiş)
projects'ten hiçbir opportunity.project_id'nin işaret etmediği projeler: 17 / 18
```
→ **151 "closed_won" opportunity var ama bunların neredeyse hiçbiri gerçek bir `projects` satırına
bağlanmamış.** Sales Handoff köprüsü (migration 079, `lib/marketing/salesHandoff.ts` → `closeWon()`) kodda
var ve çalışıyor olmalı ama ClickUp'tan toplu import edilen "closed_won" kayıtlar bu köprüden **hiç
geçmemiş** — import script'i doğrudan `opportunities` tablosuna INSERT yapıyor, `closeWon()`'u hiç çağırmıyor,
dolayısıyla proje oluşturma/customer bağlama/audit zinciri devreye girmiyor. Bu **beklenen** bir davranış
(script'in amacı zaten "geçmiş ClickUp verisini pasif olarak kopyalamak", yeni proje açmak değil) ama
dashboard'ların bu farkı hiç yansıtmaması aşağıda §4'te ayrı bir sorun.

**e) `customer_id` IS NULL (müşteriye bağlı olmayan) sayısı:**
```
projects.customer_id NULL: 17 / 18 (%94.4)
```
(`opportunities`/`prospects` şemasında `customer_id` kolonu yok — End Customer bağlantısı yalnızca
`projects.customer_id` üzerinden var, migration 048.)

---

# 4. DASHBOARD DİSKONNEKT'LERİ

## 4.1 "Pipeline by stage" neden tek aşamada toplanıyor?

**Dosya:** `app/(platform)/dashboard/page.tsx` (satır 13-19, 148-162) — ana `/dashboard` sayfası (Sales
Dashboard değil, genel Trust-Lines dashboard'u).

Aşama etiketleme fonksiyonu (birebir):
```ts
const STAGE_LABELS: Record<string, string> = {
  closed_deal:    'Finalization',
  finalization:   'Finalization',
  client_approval:'Construction Documents',
  production:     'Production',
  delivered:      'Delivery',
};
...
const STAGE_ORDER = ['closed_deal', 'finalization', 'client_approval', 'production'];
const pipeline: PipelineStage[] = STAGE_ORDER
  .filter(s => (stageCounts[s] ?? 0) > 0)
  .map(s => ({ stage: s, label: STAGE_LABELS[s] ?? s, count: stageCounts[s] ?? 0, color: STAGE_COLORS[s] ?? '#6b7280' }));
```

**Kök neden — iki katmanlı:**
1. **Etiket çakışması:** `closed_deal` VE `finalization` iki farklı `current_stage` değeri, ama **ikisi de
   "Finalization" etiketiyle gösteriliyor** — bilinçli bir tasarım (workflow'daki ilk iki alt-aşamayı tek
   UI kutusunda toplamak), ama iki gerçek stage'i tek bara indirger.
2. **Gerçek veri:** Canlı DB'de sorgulandı — **"active" (silinmemiş, arşivlenmemiş, delivered olmayan)
   10 projenin TAMAMI `current_stage = 'closed_deal'`.** Hiçbiri henüz `finalization`/`client_approval`/
   `production`'a ilerlememiş; üstelik **bu 10 projenin 10'u da `is_draft = true`** (yani hiçbiri
   tamamlanmış/gerçek bir proje değil, taslak). Sonuç: `pipeline` dizisi tek elemanlı — %100 "Finalization"
   barı, sıfır varyasyon.

Bu, kodun "yanlış hesapladığı" bir bug değil — **gerçek verinin bu kadar az ve bu kadar erken aşamada
olduğu** bir durum; ama STAGE_LABELS'ın closed_deal/finalization'ı aynı etikette birleştirmesi, sorunu
kullanıcı gözünde daha da "her şey tek yerde" gibi gösteriyor.

**Ek kaynak — Sales Dashboard'un kendi "piled into one stage" görünümü:** `/sales-dashboard`
(`app/(platform)/sales-dashboard/page.tsx` satır 22, 44-47) **yalnızca `lead_intake` tablosunu** okuyor:
```ts
const { data: rows } = await adm.from('lead_intake').select('*').limit(2000);
...
const byStatus = STATUS_ORDER.map(s => {
  const rows = leads.filter(l => (l.opportunity_status ?? 'new_opportunity') === s.key);
  ...
});
```
Canlıda `lead_intake`'te **4 satırın 4'ü de `new_opportunity`** durumunda — bu dashboard'un "Leads by
status" grafiği de tek barda toplanır. Ve bu sayfa, 561 gerçek opportunity + 117 potential'ı **hiç
görmez** — `opportunities`/`prospect_potentials` tablolarına bu dosyada tek bir referans yok.

## 4.2 Aktivite akışı neden ham UUID / "bulk_imported_clickup" gösteriyor?

**Dosya:** `components/platform/dashboard/DashboardClient.tsx` satır 99-117.

```ts
const ACTION_ICONS: Record<string, React.ReactNode> = {
  'approval.approve':   <CheckCircle2 .../>,
  'approval.reject':    <XCircle .../>,
  'approval.initiated': <Clock .../>,
  'document.upload':    <Upload .../>,
  'stage.auto_advanced':<ArrowUpRight .../>,
};

function actionSentence(action: string, resource: string | null): string {
  const r = resource ?? '';
  switch (action) {
    case 'approval.approve':   return `approved ${r}`;
    case 'approval.reject':    return `rejected ${r}`;
    case 'approval.initiated': return `initiated approval for ${r}`;
    case 'document.upload':    return `uploaded ${r}`;
    case 'stage.auto_advanced':return `project advanced to ${r}`;
    default:                   return `${action.replace('.', ' ')} ${r}`.trim();
  }
}
```

Veri kaynağı `app/(platform)/dashboard/page.tsx` satır 164-202: son 24 saatteki **tüm** `audit_log`
satırlarını (proje filtresi YOK) çekiyor.

**Kök neden:** `actionSentence()` yalnızca eski Trust-projesi eylemlerini (approval/document/stage) tanıyor.
CRM/Marketing tarafının `logAudit()` çağırdığı eylemler (`opportunity.updated`, `opportunity.negotiation`,
`prospect.bulk_imported_clickup`, `opportunity.bulk_imported_clickup`, vb. — `lib/marketing/salesHandoff.ts`,
`app/api/marketing/opportunities/[id]/route.ts` ve ClickUp import script'leri) **default branch'e
düşüyor** ve `resource` alanı ham `"tip:UUID"` formatında olduğu için **olduğu gibi ekrana basılıyor.**

Canlı DB'de birebir doğrulandı:
```json
{
  "action": "opportunity.updated",
  "resource": "opportunity:7e2202b0-efab-49ad-a33e-4a8b1b515861",
  "project_id": null,
  "created_at": "2026-08-20T08:02:50.355617+00:00"
}
```
→ Ekranda: **"{Aktör Adı} opportunity updated opportunity:7e2202b0-efab-49ad-a33e-4a8b1b515861"** olarak
görünür — kullanıcının gördüğü tam olarak bu.

`prospect.bulk_imported_clickup` / `opportunity.bulk_imported_clickup` satırları için (`scripts/clickup-
import-write.mts` satır 312-315, `clickup-import-opportunities.mts` satır 332-335) `resource` hiç
gönderilmiyor (`null`) — default branch `action.replace('.', ' ')` çağırdığında **yalnızca ilk `.`'yı**
değiştiriyor: `"prospect.bulk_imported_clickup"` → `"prospect bulk_imported_clickup"`. Canlıda 2026-08-12
ile 2026-08-20 arası **16 ayrı** bulk-import audit satırı bulundu (yaklaşık her ClickUp import script
koşusunda bir tane) — "son 24 saat" penceresinde bunlardan birkaçı her gün Dashboard'un Activity kartına
düşüyor.

**Kök sorun özeti:** `audit_log` tek, paylaşılan bir tablo; Dashboard'un aktivite kartı yalnızca eski Trust
iş akışı eylemleri için insan-okur cümle üretiyor, CRM/Marketing/ClickUp eylemleri için hiçbir case
eklenmemiş — bu iki sistem aynı tabloyu paylaştığı andan (Phase 00, Temmuz 2026) itibaren teknik borç
olarak birikmiş ve ClickUp toplu import'uyla (Ağustos 2026, 1600+ yeni satır) görünür hale gelmiş.

## 4.3 "Margin (avg)" neden hep "—" gösteriyor?

**Dosya:** `app/(platform)/dashboard/page.tsx` satır 68-69:
```ts
const marginsAll  = active.map(p => p.margin_target_pct).filter((m): m is number => m !== null);
const marginAvg   = marginsAll.length > 0 ? marginsAll.reduce((a, b) => a + b, 0) / marginsAll.length : null;
```
Kaynak kolon: **`projects.margin_target_pct`** (üretim/proje marjı — CRM'in "margin"iyle ilgisi yok,
tamamen ayrı bir kavram; CRM tarafında (`opportunities`/`prospect_potentials`) zaten hiçbir margin/kâr
kolonu bulunmuyor).

Canlı doğrulama: **aktif 10 projenin 0'ında `margin_target_pct` dolu.** (`margin_target_pct populated: 0/10`)
→ `marginsAll.length === 0` → `marginAvg = null` → UI'da `stats.marginAvg !== null ? ... : '—'`
(`DashboardClient.tsx` satır 174) her zaman `'—'` dalına düşer.

Kök neden: Bu proje-seviyesi alan hiçbir Sales/CRM akışında (Quick Deal formu, ClickUp import, Sales
Handoff `closeWon()`) doldurulmuyor — yalnızca elle proje düzenleme ekranından girilebiliyor gibi görünüyor
ve canlıda kimse girmemiş. **ClickUp import bunun nedeni değil** — 10 projenin hiçbiri zaten ClickUp
kaynaklı değil (`clickup_task_id` 10/10 boş).

## 4.4 "Active projects: 10" vs sidebar "Projects: 3" neden farklı?

Bu ikisi **birbirine hiç bağlı olmayan iki farklı sayı:**

- **"Active projects" (Dashboard stat kartı):** `app/(platform)/dashboard/page.tsx` satır 60-63 — gerçek
  `projects` tablosu sorgusu (`deleted_at IS NULL AND is_archived != true AND current_stage != 'delivered'`).
  Canlı değer: **10.**
- **Sidebar'daki "3" bir VERİ SAYACI DEĞİL.** `components/platform/shell/Sidebar.tsx` satır 233:
  ```tsx
  <span style={{ fontSize: 10, opacity: 0.55, marginRight: 2 }}>{visible.length}</span>
  ```
  Bu, `NavGroup` bileşeninin **kendi alt-nav-linklerinin sayısını** gösteriyor — "Projects" grubunun
  içinde üç link var (`PM`, `Supply`, `Approvals` — `PROJECTS_NAV`, satır 75-79), rol izinlerine göre
  kaçı görünürse o sayı basılıyor. **Veritabanındaki proje sayısıyla hiçbir ilgisi yok** — "Projects" grup
  başlığının yanında rastlantısal olarak proje-sayısıymış gibi okunan bir UI etiketi.

Bu bir **UI adlandırma/algı sorunu**, veri tutarsızlığı değil: iki farklı "3" ve "10" aynı şeyi ölçmüyor,
biri gerçek proje sayısı, diğeri o menü grubundaki tıklanabilir link sayısı.

## 4.5 "New project delivered: 193" bildirimi neden isimsiz?

**Dosya:** `lib/sales/deliver.ts` satır 104-119:
```ts
const { data: project } = await admin.from('projects').select('code, name').eq('id', row.project_id).single();
const proj = (project as { code: string; name: string } | null) ?? { code: '', name: '' };
...
await admin.from('notifications').insert({
  user_id: r.id, project_id: row.project_id, type: 'project.delivered',
  title: `New project delivered: ${proj.code}`,
  body: `${proj.name} was delivered to Trust-Lines.`, link,
});
```

**İki ayrı kök neden:**
1. **Tasarım gereği isim yok:** Bildirim `title`'ı **her zaman** yalnızca `proj.code` kullanır, `proj.name`
   yalnızca `body`'de var. Bu, kod her zaman böyle davranıyor — ClickUp'la ilgisi yok, template'in kendi
   tasarımı. Normal koşullarda `code` "STW 460" gibi okunur bir proje koduysa sorun daha az fark edilir.
2. **Bu spesifik proje gerçekten anormal:** Canlıda `code = "193"` olan proje sorgulandı:
   ```json
   {
     "code": "193",
     "name": "193 - Mobile - Silahtarağa caddesi sakarya mahallesi 159/01 eyüp istanbul - İstanbul",
     "is_draft": false, "deleted_at": "2026-08-18T07:43:43+00",
     "current_stage": "finalization", "created_at": "2026-07-03T08:54:03+00"
   }
   ```
   `code` alanı **`{ServiceShort}{RegionShort} {number}` formatında değil, çıplak bir sayı.** `client_id`/
   `client_company_id` de NULL — yani region/service line hiç seçilmeden oluşturulmuş bir proje. Canlı
   `notifications` tablosunda bu tipte **tek bir `project.delivered` bildirimi** var (2026-07-03), ve o da
   tam olarak bu "193" projesine ait. Ayrıca bu proje şu an **silinmiş** (`deleted_at` dolu, 2026-08-18) —
   muhtemelen sonradan hatalı/test kaydı olduğu fark edilip temizlenmiş.
   Aynı grup içinde 191/192/193 (üçü de aynı adres, saniyeler arayla, 2026-07-03 08:53-08:54) ve 190
   ("Old Military Road") — tipik bir **tekrarlanan form gönderimi / test verisi** izlek deseni; ClickUp
   import'la değil, muhtemelen erken bir Quick Deal / deliver akışı testiyle ilgili.

Sonuç: bildirim şablonunun "her zaman sadece kod, asla isim" tasarımı genel bir UX eksikliği; ama "193"
özelinde görülen isimsizlik, altında yatan projenin zaten bozuk/test verisi olmasından kaynaklanıyor.

---

# 5. TARAYICI TESTİ

**BİLİNMİYOR / test edilmedi (ortamda interaktif tarayıcı yok).** Bu ortamda canlı bir Next.js oturumu
açıp sayfaları gezinme imkânı yoktu; yukarıdaki tüm bulgular kaynak kod okuması + salt-okunur Supabase
sorgularıyla elde edildi. Ekran görüntüsü / gerçek render doğrulaması yapılmamıştır.

---

# 6. ÖNCELİKLENDİRİLMİŞ BULGULAR

```
[P0] Belirti: Sales Dashboard (/sales-dashboard) "Leads by status" tamamen tek durumda toplanıyor ve
     gerçek CRM hacminin (561 opportunity + 117 potential + 990 prospect) %0'ını gösteriyor.
     Kök neden: app/(platform)/sales-dashboard/page.tsx yalnızca `lead_intake` tablosunu okuyor (satır 22);
     Phase 00'dan beri var olan `opportunities`/`prospect_potentials`/`prospects` şemasına hiç bakmıyor.
     Etkilenen dosyalar: app/(platform)/sales-dashboard/page.tsx, components/platform/sales/SalesDashboard.tsx.
     Önerilen düzeltme: Sales Dashboard'u `opportunities`+`prospect_potentials` (+ isteğe bağlı `lead_intake`)
     üzerinden yeniden inşa et, tek kaynağa dayanan istatistikler yerine CRM Board'un zaten kullandığı
     `opportunityRows.ts`/`potentialRows.ts` birleştirme mantığını yeniden kullan.

[P0] Belirti: Dashboard Activity kartında satırlar "System opportunity updated opportunity:UUID" /
     "... bulk_imported_clickup" gibi ham, okunaksız metinler gösteriyor.
     Kök neden: components/platform/dashboard/DashboardClient.tsx'teki actionSentence() (satır 107-116)
     yalnızca eski Trust-proje eylemlerini tanıyor; CRM/Marketing/ClickUp-import audit_log eylemleri
     (opportunity.*, prospect.*, *.bulk_imported_clickup) default branch'e düşüp ham action+resource basıyor.
     Etkilenen dosyalar: components/platform/dashboard/DashboardClient.tsx, app/(platform)/dashboard/page.tsx,
     lib/marketing/salesHandoff.ts, app/api/marketing/**/route.ts, scripts/clickup-import-*.mts.
     Önerilen düzeltme: actionSentence()'a CRM/Marketing eylem ailesi için insan-okur case'ler ekle (ilgili
     prospect/opportunity adını resource UUID'sinden çözerek), ve/veya toplu-import audit satırlarını
     Dashboard'un "son 24 saat" akışından filtrele (ayrı bir "system/bulk" kategorisi olarak göster).

[P1] Belirti: 151 adet "closed_won" opportunity var ama bunların yalnızca 1 tanesi bir `projects` satırına
     bağlı (project_id NULL oranı %99.8).
     Kök neden: ClickUp import script'i (scripts/clickup-import-opportunities.mts) geçmiş veriyi doğrudan
     `opportunities` tablosuna yazıyor, `lib/marketing/salesHandoff.ts`'in closeWon()/proje-açma köprüsünü
     hiç çağırmıyor (bilinçli — geçmiş veri, yeni proje açmak amaçlanmamış) ama hiçbir dashboard veya UI
     satırı bu "tarihsel/pasif" ile "gerçek/aktif" opportunity ayrımını göstermiyor.
     Etkilenen dosyalar: scripts/clickup-import-opportunities.mts, lib/marketing/salesHandoff.ts,
     app/(platform)/marketing/opportunities/page.tsx.
     Önerilen düzeltme: import edilen (external_source='clickup') "closed_won" kayıtlarını UI'da açıkça
     "historical import" olarak etiketle, canlı pipeline istatistiklerinden varsayılan olarak hariç tut.

[P1] Belirti: Migration 092/093 canlıda uygulanmamış (prospect_contacts.checklist / order_index yok);
     bu kolonları kullanan herhangi bir UI akışı hata verebilir.
     Kök neden: Migration'lar elle uygulanıyor (bu repo'nun tasarımı) ve 092/093 uygulama listesinde
     atlanmış — PROJECT-MASTER-PLAN.md'nin 087+ migration'ları hiç belgelememesi bu atlamanın fark
     edilmemesine katkıda bulunmuş olabilir.
     Etkilenen dosyalar: supabase/migrations/092_prospect_contact_checklist_notes.sql,
     supabase/migrations/093_checklist_order_index_numeric.sql.
     Önerilen düzeltme: 092 ve 093'ü canlı DB'ye uygula, ardından PROJECT-MASTER-PLAN.md CURRENT
     STATUS'u 087-104 aralığını kapsayacak şekilde güncelle.

[P1] Belirti: PROJECT-MASTER-PLAN.md CURRENT STATUS + CHANGE LOG, migration 087-104'ü (ClickUp import'un
     tamamı dahil) hiç belgelemiyor; "Highest migration: 064" gibi 40 migration bayat bir sayı taşıyor.
     Kök neden: ClickUp import işi, projenin standart "devam et" iş akışının (audit → migration → RLS →
     tip → UI → PROJECT-MASTER-PLAN.md güncelle) dışında, doğrudan terminal script'leriyle ilerletilmiş.
     Etkilenen dosyalar: PROJECT-MASTER-PLAN.md (§15 CURRENT STATUS, §17 CHANGE LOG).
     Önerilen düzeltme: 087-104 için tek bir özet CHANGE LOG girdisi ekle, CURRENT STATUS'taki migration
     numarasını ve "live DB is behind" notlarını güncelle.

[P2] Belirti: "Pipeline by stage" (ana Dashboard) tüm aktif projeleri tek "Finalization" barında gösteriyor.
     Kök neden: (a) STAGE_LABELS closed_deal VE finalization'ı aynı etikette birleştiriyor (bilinçli
     tasarım), (b) canlıdaki 10 aktif projenin 10'u da is_draft=true ve current_stage='closed_deal' —
     gerçek veri henüz bu kadar erken/az.
     Etkilenen dosyalar: app/(platform)/dashboard/page.tsx (satır 13-19, 148-162).
     Önerilen düzeltme: draft projeleri "active" sayımından/pipeline'dan ayrı göster (veya en azından ayrı
     say), closed_deal/finalization etiket birleşimini iki ayrı bar olarak da gösterme seçeneği ekle.

[P2] Belirti: Sidebar "Projects" grup rozetinde görünen "3" rakamı, kullanıcı tarafından proje sayısı
     sanılabiliyor; gerçekte o grubun altındaki nav-link sayısı (PM/Supply/Approvals = 3).
     Kök neden: NavGroup bileşeni her grup için `visible.length` (alt-link sayısı) gösteriyor
     (components/platform/shell/Sidebar.tsx satır 233); "Projects" grup adı ile bu rozet yan yana durunca
     yanlış okunuyor.
     Etkilenen dosyalar: components/platform/shell/Sidebar.tsx.
     Önerilen düzeltme: Grup rozetini yalnızca "kaç link var" anlamına gelecek şekilde görsel olarak
     ayrıştır (örn. farklı stil) veya kaldır; gerçek proje sayısı gösterilecekse ayrı, açıkça etiketli bir
     rozet ekle.

[P2] Belirti: "New project delivered: 193" bildirimi hiçbir zaman proje adı taşımıyor, yalnızca kod.
     Kök neden: lib/sales/deliver.ts satır 114'teki bildirim title şablonu tasarım gereği yalnızca
     `proj.code` kullanıyor; bu örnekte ayrıca altındaki proje `code="193"` gibi çıplak/bozuk bir koda
     sahip (client_id/client_company_id NULL, muhtemelen test verisi, zaten silinmiş).
     Etkilenen dosyalar: lib/sales/deliver.ts (satır 104-119).
     Önerilen düzeltme: Bildirim title'ına `proj.name`'i de ekle (örn. "New project delivered: {code} — {name}");
     ayrıca region/service_line seçilmeden proje kodu üretilebilmesini önleyecek bir form-doğrulama ekle.

[P3] Belirti: Sidebar "CRM Board" nav item'ı `perm: 'page.leads'` taşıyor ama bu izin anahtarı
     lib/permissions/catalog.ts'te tanımlı DEĞİL; erişim kontrolü bunun yerine sayfa içi sabit rol
     dizileriyle (`bypassPerm`) yapılıyor.
     Kök neden: Kod kendi TODO yorumunda bunu zaten işaretlemiş ("page.leads permission does NOT exist yet").
     Etkilenen dosyalar: components/platform/shell/Sidebar.tsx (satır 102-113), lib/permissions/catalog.ts.
     Önerilen düzeltme: `page.leads` anahtarını catalog.ts'e ekleyip ilgili rollere seed'le, ardından
     bypassPerm'i kaldır — güvenlik açığı değil (roller sayfa içinde zaten doğrulanıyor) ama izin
     modelinin tek-kaynak tutarlılığını bozuyor.

[P3] Belirti: "Potentials" sidebar linki tıklanınca kullanıcı farklı isimli bir board'a ("Opportunities")
     yönlendiriliyor.
     Kök neden: app/(platform)/marketing/potentials/page.tsx bilinçli olarak yalnızca
     redirect('/marketing/opportunities') yapan bir stub — Potential/Opportunity'nin tek birleşik board'a
     taşınmasının artığı.
     Etkilenen dosyalar: app/(platform)/marketing/potentials/page.tsx,
     components/platform/shell/Sidebar.tsx (MARKETING_TOOLS_NAV).
     Önerilen düzeltme: Sidebar'daki "Potentials" linkini doğrudan `/marketing/opportunities`'e (uygun bir
     filtre/anchor ile) işaret edecek şekilde güncelle, ya da linki kaldırıp tek "Opportunities" girişi bırak.
```
