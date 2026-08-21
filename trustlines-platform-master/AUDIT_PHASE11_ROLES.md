# AUDIT — PHASE 11.0 (Role, Profile, Assignment & Permission Model)

> Faz 11'in ilk görevi. Amaç: **hiçbir tablo/kolon oluşturmadan veya yeniden adlandırmadan**, mevcut rol,
> profil metadata, assignment ve permission modelinin gerçek durumunu çıkarmak.
>
> Tarih: **2026-07-16** · Yöntem: repo taraması + **canlı DB read-only probe** (service-role, yalnız SELECT).
> Kaynak: `PHASE-11-ROLE-WORKSPACE-COMPLETION.md` §8 → 11.0.
>
> ⚠️ Bu dosyadaki "canlı" ifadelerinin tamamı **varsayım değil, probe sonucudur.** Probe script'leri geçiciydi
> ve temizlendi; sonuçlar aşağıda birebir raporlanmıştır.

---

## 0. Yönetici özeti

| 11.0 görevi | Sonuç |
|---|---|
| Aktif roller ve `role_definitions` çıkarılsın | ✅ 15 `role_definitions` satırı; 10 profilde 9 farklı rol |
| Aktif `executive` kullanımı sıfırlansın | ✅ **Zaten sıfır** — 0 profil, 0 role_definition (046 uygulanmış) |
| `general_manager` full authority doğrulansın | ✅ Canlıda `{"all": true}` |
| Mevcut profile metadata alanları çıkarılsın | ⚠️ 6 hedef alandan **5'i yok**; `office` var ama **10/10 NULL** |
| Tüm assignment alanları çıkarılsın | ⚠️ Proje düzeyinde 7 alan var; **type/design/supply/warehouse düzeyi yok** |
| Duplicate task/assignment yapıları belirlensin | ⚠️ 4 paralel "görev" kaynağı; **duplicate assignment yok**, duplicate **task surface** var |

**Faz 11 için en kritik 3 bulgu:**

1. **`tlines_pm` canlıda `view.pf` + `view.prices` + `view.po` iznini TAŞIYOR** — CLAUDE.md'nin değişmez
   kuralına ve Phase 11 §7'ye aykırı. Bugün veri sızdırmıyor (RLS ayrı katman olarak PF'i bloklar) ama
   permission katmanı yanlış tarafta duruyor. → 11.1'in "Permission seed / forward migration" işi.
2. **Docs'taki `customer_follow_ups.reminded_on` uyarısı ARTIK GEÇERSİZ** — kolon canlıda **var**.
   Master plan bunu "PROVEN broken in production" diye taşıyordu; bu artık yanlış.
3. **Assignment gerçekte kullanılmıyor:** 6 `sales_design_jobs` satırının **6'sında da**
   `assigned_designer_id = NULL`; 20 `production_items` satırının yalnız **1'inde** `assigned_to` dolu.
   Yani "atama gerçek kişiye yapılır" hedefi şu anda veri düzeyinde **boş**.

---

## 1. Roller

### 1.1 Kod (`types/database.ts` → `UserRole`) — 15 rol

```text
ops_manager · pm_millwork · pm_ceiling · trustlines_pm · tlines_pm · qc_responsible
logistics · accounting · production_manager · project_manager · general_manager
accountant · sales_marketing_manager · sales_rep · designer
```

`executive` union'da **yok** (046 ile kaldırılmış). Kodda `executive` yalnız şu yerlerde geçer ve hepsi
meşrudur: tarihsel migration'lar (001/002/004/020 — uygulanmış geçmiş), 046'nın kendisi (migration'ın konusu),
doküman satırları ve `tests/requestUser.test.ts` (rolün **yokluğunu** pinleyen negatif test).
→ **Aktif kod kullanımı: 0.**

### 1.2 Canlı `role_definitions` — 15 satır

| name | label | permissions |
|---|---|---|
| `ops_manager` | Ops Manager | `{all:true}` |
| `general_manager` | General Manager | **`{all:true}`** ✅ |
| `trustlines_pm` | TL Project Manager | 34 anahtar |
| `tlines_pm` | T-Lines PM | 27 anahtar |
| `project_manager` | Project Manager | 26 anahtar |
| `production_manager` | Production Manager | 22 anahtar |
| `pm_ceiling` | PM · Ceiling | 19 anahtar |
| `pm_millwork` | PM · Millwork | 18 anahtar |
| `accountant` | Accountant | 16 anahtar |
| `logistics` | Logistics | 11 anahtar |
| `qc_responsible` | QC Responsible | 11 anahtar |
| `designer` | Designer | 4 anahtar |
| `sales_rep` | Sales Representative | 4 anahtar |
| `sales_marketing_manager` | Sales & Marketing Manager | 4 anahtar |
| **`pm__image`** | PM - Image | 30 anahtar — **AŞAĞIYA BAK** |

### 1.3 Canlı profil dağılımı (10 kullanıcı)

```text
tlines_pm 2 · qc_responsible 1 · pm_millwork 1 · trustlines_pm 1 · accountant 1
ops_manager 1 · sales_marketing_manager 1 · general_manager 1 · designer 1
```

Hedef ~40 kullanıcı; bugün **10**. Tüm profiller `is_active = true`.

### 1.4 Tespit edilen rol anomalileri

**A. `pm__image` — çift alt çizgili yetim rol.**
`role_definitions`'ta var, **`UserRole` union'ında YOK**, 0 profil kullanıyor. 30 izin taşıyor ve izin
anahtarları **eski nesil şemadan** (`nav.projects`, `docs.view_pf`, `proj_tab.image`, `team.edit`,
`clients.manage`) — yani 020 öncesi/paralel bir sözlük. Muhtemelen Roles UI'ından elle yaratılmış bir yazım
hatası (`pm_image` yerine `pm__image`). Ölü kayıt; 11.1'de temizlenmeli (0 referans → güvenli).

**B. `accounting` rolünün `role_definitions` satırı YOK.**
`UserRole` union'ında var, `DEFAULT_PERMISSIONS['accounting']` kodda tanımlı (catalog.ts:186), dolayısıyla
`effectivePermissions()` fallback'i çalışır ve **yetki kaybı olmaz**. Ancak Roles ekranı DB'den okuduğu için
bu rol **yönetim arayüzünde görünmez/düzenlenemez**. 11.1'de seed edilmeli.

**C. `permissions` merge edilmez — stored map DEFAULT'u tamamen ezer.**

```ts
// lib/permissions/catalog.ts:197
export function effectivePermissions(roleName: string, stored: PermMap | null | undefined): PermMap {
  if (stored && Object.keys(stored).length) return stored;   // ← per-key merge YOK
  return DEFAULT_PERMISSIONS[roleName] ?? {};
}
```

**Sonucu Faz 11 için kritiktir:** kodda `DEFAULT_PERMISSIONS`'a yeni bir anahtar eklemek, DB'de stored map'i
olan bir role **hiçbir şey kazandırmaz**. Yeni her izin için **forward seed migration şart**. (11.1'in
"Permission seed / forward migration" maddesi tam olarak bu yüzden var.)

---

## 2. Permission sınırı ihlali — `tlines_pm` (EN KRİTİK BULGU)

Canlı `role_definitions` üzerindeki hassas izinler:

| rol | view.pf | view.prices | view.po | view.production_board |
|---|---|---|---|---|
| **`tlines_pm`** | **YES** ❌ | **YES** ❌ | **YES** ❌ | **YES** ❌ |
| `trustlines_pm` | YES | YES | YES | YES |
| `project_manager` | YES | YES | YES | YES |
| `accountant` | YES | YES | YES | YES |
| `pm_millwork` / `pm_ceiling` | YES | – | YES | YES |
| `production_manager` | YES | – | YES | YES |
| `logistics` / `qc_responsible` | – | – | – | YES |
| `designer` / `sales_rep` / `sales_marketing_manager` | – | – | – | – |
| `ops_manager` / `general_manager` | ALL (bypass) | | | |

**Kaynak kök nedeni kod:** `catalog.ts:133` `VIEW_ALL_TABS` dizisi `view.pf` + `view.po`'yu **içeriyor**, ve
`tlines_pm` default'u `on(...VIEW_ALL_TABS, 'view.prices', ...)` diyor (catalog.ts:153-155). Yani hata hem
canlı seed'de hem kodun default'unda **aynı anda** var — biri diğerini düzeltmiyor.

**Bugün gerçek bir sızıntı mı?** Hayır, ama nedeni bu izin değil:
- `view.pf`'in **tek tüketicisi** `components/platform/projects/CategoryTab.tsx:51` — PF alt-sekmesini
  gösterip gizliyor. `tlines_pm` izni taşıdığı için **PF alt-sekmesi tlines_pm'e RENDER EDİLİYOR**.
- Sekmenin içeriği ise `documents` RLS'i (`tlines_no_pf`, migration 002) ve route/AI kod kontrolleriyle
  bloklanıyor → sekme **boş** görünür, PF **sızmaz**.
- `view.prices` için kodda **hiç tüketici bulunamadı** (yalnız catalog tanımı + docs). Yani şu an ölü anahtar;
  ama ileride "fiyat göster" kapısı olarak kullanılırsa `tlines_pm` **anında** geçer.

> ⚠️ Not: RLS'in PF'i bloklaması bu pass'te **canlı olarak yeniden probe EDİLMEDİ** — migration 002 +
> mevcut dokümantasyona dayanıyor. 11.1'de gerçek bir `tlines_pm` oturumuyla doğrulanmalı.

**Sonuç:** AGENTS.md "Hiding a UI element is not authorization" der; bunun simetriği de geçerli — bir UI
elemanını göstermek tek başına sızıntı değildir. Ama Phase 11 §7 ve CLAUDE.md "değişmez kural" düzeyinde
`tlines_pm`'in PF'i **hiç görmemesini** ister. Permission katmanı bugün yanlış tarafta ve savunma
derinliğinin bir katmanı fiilen kapalı. **11.1'de düzeltilecek** (kod default'u + forward seed migration
birlikte; yalnız biri yetmez — bkz. §1.4-C).

---

## 3. Profil metadata

### 3.1 Canlı `profiles` kolonları (probe)

```text
id · full_name · email · role · office · avatar_url · category_scope · is_active
is_pm_supervisor · pm_client_id · sales_region_id · signature_base64 · created_at · updated_at
```

### 3.2 Phase 11 §3 hedefi ile karşılaştırma

| Hedef alan | Canlı durum | Not |
|---|---|---|
| `company_side` | ❌ **YOK** | trust_lines / t_lines ayrımı bugün **hiçbir yerde veri değil** |
| `office` | ⚠️ **VAR ama 10/10 NULL** | TEXT serbest metin (051). Hedef: turkey/syria/usa/other. Mevcut değer yok → **çakışmasız normalize edilebilir** |
| `department` | ❌ **YOK** | |
| `skills[]` | ❌ **YOK** | Designer çoklu-skill modeli için gerekli |
| `manager_id` | ❌ **YOK** | |
| `region_ids[]` | ⚠️ **Kısmen** | `pm_client_id` (tekil) + `sales_region_id` (tekil) var; **çoklu** yok |
| `service_line_ids[]` | ❌ **YOK** | |
| `is_active` | ✅ **VAR** | 10/10 `true` |

**Önemli:** `office` **tamamen NULL** olduğu için 11.2'de normalize etmek **veri taşıma riski taşımaz** —
backfill edilecek satır yok. Ancak 051'in yorumu `'Trust Lines Türkiye' | 'Syria Office'` gibi serbest metin
öngörüyor; hedef enum (`turkey|syria|usa|other`) ile **farklı bir eksen**. 11.2 bu ikisini uzlaştırmalı.

**Fazladan alanlar (hedefte yok, canlıda var):** `category_scope`, `is_pm_supervisor`, `pm_client_id`,
`sales_region_id`, `signature_base64`, `avatar_url`. Bunların hiçbiri Faz 11'de **silinmemeli** —
`is_pm_supervisor` PO imza zincirinde, `pm_client_id` tlines_pm/AI kapsamında, `signature_base64` imza
motorunda **canlı olarak kullanılıyor**.

> `pm_supervisor` Phase 11 §2'de **rol** olarak listelenmiş; canlıda ise **boolean bayrak**
> (`profiles.is_pm_supervisor`) + `projects.pm_supervisor_id`. Bu bir çelişki — 11.1 karar vermeli:
> rol mü, bayrak mı, ikisi mi? **Bayrağı rol lehine kaldırmak PO imza zincirini kırar** → additive yaklaş.

---

## 4. Assignment modeli

### 4.1 Canlı assignment alanları

**`projects` (7 alan):**

| alan | dolu / 13 proje |
|---|---|
| `ops_manager_id` | 2/13 |
| `trustlines_pm_id` | 2/13 |
| `tlines_pm_id` | 2/13 |
| `prod_pm_ms_id` | 2/13 |
| `prod_pm_ci_id` | **0/13** |
| `qc_inspector_id` | 1/13 |
| `pm_supervisor_id` | 2/13 |

(13 projenin 10'u draft. Ayrıca `created_by`, `customer_id`, `client_id`, `client_company_id`,
`client_franchise_id` var.)

**`sales_design_jobs`:** `assigned_designer_id` → **6/6 NULL** (kişi bazlı atama, ofis değil ✅ — ama boş).
**`production_items`:** `assigned_to` (062) → **1/20 dolu**; ayrıca `vendor_id`, `priority`, `start_date`, `target_date`.

### 4.2 Phase 11.3 hedefi ile karşılaştırma

| 11.3 hedefi | Canlı karşılığı |
|---|---|
| Sales Design assignee | ✅ `sales_design_jobs.assigned_designer_id` (var, kullanılmıyor) |
| Project team | ❌ **`project_team` tablosu YOK** (probe: PGRST205) |
| Type owner | ❌ yok |
| Type designer | ❌ yok |
| Shop drawer | ❌ yok |
| Supply responsible | ❌ yok |
| Production responsible | ⚠️ `production_items.assigned_to` (en yakın karşılık) |
| QC responsible | ⚠️ `projects.qc_inspector_id` (proje düzeyi; **type düzeyi değil**) |
| Warehouse responsible | ❌ yok |

**Yapısal boşluk:** Bugünkü model **proje düzeyinde sabit kolonlar**dır. Phase 11 ise **type düzeyinde çok
rollü** atama istiyor (her type için ayrı owner/designer/shop drawer/supply responsible). Mevcut sabit-kolon
deseni bunu **taşıyamaz** — 11.3 bir junction tablo gerektirecek. **Bu audit hiçbir tablo oluşturmadı;** karar
ve migration 11.3'e aittir.

### 4.3 "Type" bugün nerede yaşıyor?

`project_types` ve `supply_types` **tablo olarak YOK** (probe: PGRST205). Type bugün iki yerde:
`projects.categories[]` (M1–I3 kodları) ve **`production_items.type`** (satır = proje × tip).
→ 11.3'ün "type owner" kavramı için **doğal çapa `production_items`**, yeni bir type tablosu değil.
Karar vermeden önce `lib/production/board.ts` `categoryToType` eşlemesi okunmalı.

---

## 5. Duplicate task / assignment yapıları

**Duplicate *assignment* yok** — bir işin sahibi tek yerde tutuluyor, aynı atama iki tabloda tekrarlanmıyor.
Ancak **4 paralel "bana düşen iş" kaynağı** var:

| kaynak | satır (canlı) | rolü |
|---|---|---|
| `lead_tasks` | 1 | Sales subtask (ClickUp tarzı), `/sales-tasks` |
| `document_approvals` | 2 | İmza kutusu = fiilen bir görev |
| `notifications` | 2 | Bildirim (görev değil ama My Day'de görev gibi görünür) |
| `system_events` | 0 | Phase 10 event/otomasyon kaydı |
| `customer_follow_ups` | 0 | "şu tarihte dön" kuyruğu |

Phase 10'un `lib/dashboard/myDay.ts`'i bunları **okuyup birleştiriyor** (yeni tablo yaratmadan) — yani
My Day zaten "duplicate task tablosu açma" tuzağından kaçınmış durumda. **11.5 bu deseni sürdürmeli:
yeni bir `tasks` tablosu açmak yerine mevcut kaynakları türetmeye devam et.**

Tek gerçek çakışma riski: `lead_tasks` (Sales) ile `sales_design_jobs` (Design) **ikisi de** bir designer'a
iş düşürebilir. Bugün `assigned_designer_id` boş olduğu için bu çakışma **henüz gerçekleşmemiş**.

---

## 6. Canlı DB ↔ repo farkı (doğrulanmış)

Repo'daki en yüksek migration: **064**. → yeni migration **065**.

| İddia (master plan) | Probe sonucu (2026-07-16) |
|---|---|
| 059 (`delivery_plans` + `punch_list_items`) uygulandı | ✅ **Doğru** — ikisi de var (1'er satır) |
| 063 (`system_events`) uygulandı | ✅ **Doğru** — var (0 satır) |
| 064 enum değeri canlı | ✅ `sales_design_*` tabloları çalışıyor |
| **"062 yalnız kısmen uygulandı — `reminded_on` YOK, PM follow-up reminder canlıda kırık"** | ❌ **ARTIK YANLIŞ** — `customer_follow_ups.reminded_on` **VAR** |

**062 tam olarak uygulanmış durumda.** Probe ile doğrulanan tüm parçaları:
`production_items.assigned_to/priority/start_date/target_date` ✅, `containers.delivery_destination` ✅,
`containers.job_site_address` ✅, `container_documents` tablosu ✅, `customer_follow_ups.reminded_on` ✅.

> 📌 **Adlandırma tuzağı:** `062_supply_types_and_logistics.sql` **`supply_types` veya `shipments` tablosu
> OLUŞTURMAZ** — dosya adı yanıltıcıdır. Bu tabloların yokluğu "062 uygulanmadı" demek **değildir**.
> (Bu audit'in ilk probe'u da tam olarak bu yüzden yanlış pozitif verdi: `head:true` + `count` eksik tabloda
> hata döndürmeyip `null` count döndürüyor. **Tablo varlığını `select('*').limit(1)` ile doğrula.**)

**Kalan gerçek kullanıcı aksiyonu: YOK.** Master plan'ın "USER ACTION STILL REQUIRED" bloğu artık geçersiz.

---

## 7. 11.1'e devir — kararlar ve riskler

11.0 hiçbir şema değişikliği yapmadı (audit-only). 11.1'in çözmesi gereken açık kararlar:

1. **`tlines_pm`'den `view.pf` + `view.prices` + `view.production_board` kaldır** — `VIEW_ALL_TABS`'ı bölerek
   (`view.pf`/`view.po` bu spread'den çıkar, ihtiyacı olan rollere açıkça verilir) **+ forward seed
   migration 065**. Kod default'u tek başına yetmez (§1.4-C).
   > ⚠️ **`view.po` KALMALI.** Master plan §4.6 "T-Lines'a gönderilen PO"yu açıkça T-Lines PM'in
   > **görebileceği** bilgiler arasında sayar ve `stageConfig`'te PO imza zinciri **Client PM ile başlar**.
   > `CategoryTab.tsx:50` PO alt-sekmesini `view.po` ile gate'liyor → kaldırmak PO onay akışını **kırar**.
   > "T-Lines PM finansal hiçbir şey görmesin" diye toptan silmek, düzeltmeyi outage'a çevirir.
2. **`pm__image` sil** (0 referans) ve **`accounting` seed et** (satırı yok).
3. **Designer skill modeli:** Phase 11 §2, `designer`'ı 7 role bölüyor (`design_lead`, `graphic_designer`,
   `shop_drawer`, `millwork_designer`, `shelving_designer`, `ceiling_designer`, `image_designer`) ama §3
   aynı anda "kullanıcılar birden fazla skill taşıyabilir" diyor. **Bunlar iki farklı model.** Öneri:
   tek `designer` rolü + `skills[]` metadata (rol patlamasını önler, çoklu-skill'i doğal karşılar);
   `design_lead` ve `shop_drawer` ayrı **rol** olarak kalsın (farklı yetki, farklı skill değil).
   → Karar kullanıcıya sorulmalı; bu audit tek taraflı karar vermez.
4. **`pm_supervisor`:** rol mü, mevcut `is_pm_supervisor` bayrağı mı? Bayrağı kaldırmak PO imza zincirini
   kırar → additive git.
5. **`luxury_pm` scope'u tanımsız** — Phase 11 §2'de listeli, canlıda/kodda **hiç yok**. Neyin PM'i olduğu
   netleşmeden seed edilmemeli.
6. **`pm_millwork`/`pm_ceiling`/`project_manager`** Phase 11 §2 rol listesinde **yok** ama canlıda kullanımda
   (`pm_millwork` 1 profil) ve PF/PO imza zincirinde. **Silinemez** — Phase 11 listesi bunları kapsamıyorsa
   liste eksik demektir.

---

## 8. Değişen dosyalar

- `AUDIT_PHASE11_ROLES.md` (**yeni** — bu dosya)
- `PHASE-11-ROLE-WORKSPACE-COMPLETION.md` (11.0 kutuları işaretlendi)
- `PROJECT-MASTER-PLAN.md` (CURRENT STATUS + NEXT TASKS + CHANGE LOG; 062/`reminded_on` düzeltmesi)

**Migration:** yok (audit-only — tablo/kolon oluşturulmadı, yeniden adlandırılmadı).
**Uygulanacak migration:** yok.
