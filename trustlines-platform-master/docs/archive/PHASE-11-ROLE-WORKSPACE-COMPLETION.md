# PHASE 11 — ROLE, ASSIGNMENT & WORKSPACE COMPLETION

> Bu faz mobil uygulama geliştirmez. Amaç, web platformunu yaklaşık 40 gerçek kullanıcıyla uçtan uca çalışır hale getirmektir.
>
> Okuma sırası: `CLAUDE.md` → `PROJECT-MASTER-PLAN.md` → `PHASE 10` → bu dosya → `AGENTS.md` → `SYSTEM_ARCHITECTURE.md` → `CURRENT_SYSTEM_STATE.md`.

## 1. Ana hedef

Her kullanıcı giriş yaptığında şunları net görmelidir:

- Bana atanmış işler
- Bekleyen onaylar
- Revizyonlar
- Geciken görevler
- Benden sonra işin kime gideceği
- Hangi proje/type/dokümandan sorumlu olduğum
- Hangi alanları görebildiğim ve değiştirebildiğim

Aynı iş için ayrı proje kayıtları açılmaz. Sales, PM, Supply, Production, QC, Warehouse ve Delivery aynı `Project ID` üzerinde çalışır.

## 2. Nihai rol grupları

### Yönetim
- `general_manager`: sistem genelinde tam yetki; eski `executive` rolünün yerini alır.
- `ops_manager`: Trust Lines operasyon tarafında tam yetki.

### Sales
- `sales_marketing_manager`
- `sales_rep`

### Design
- `design_lead`
- `graphic_designer`
- `shop_drawer`
- `millwork_designer`
- `shelving_designer`
- `ceiling_designer`
- `image_designer`

Kullanıcılar birden fazla skill taşıyabilir. Atama ofise değil gerçek kişiye yapılır. Ofis yalnız metadata olur.

### PM
- `tlines_pm`
- `trustlines_pm`
- `luxury_pm`
- `pm_supervisor`

### Supply / Production
- `supply_manager`
- `supply_user`
- `production_manager`
- `production_user`

### QC / Warehouse / Logistics
- `qc_responsible`
- `warehouse_manager`
- `warehouse_user`
- `logistics`

### Finance
- `accounting`
- `accountant`

## 3. Profil metadata modeli

Yaklaşık 40 kullanıcı için yalnız `role` yetmez. Profilde aşağıdakiler olmalıdır:

```text
company_side = trust_lines | t_lines
office = turkey | syria | usa | other
department = sales | design | pm | supply | production | qc | warehouse | logistics | accounting | management
skills[] = millwork | shelving | ceiling | image | graphic | shop_drawing | furniture | decoration
manager_id
region_ids[]
service_line_ids[]
is_active
```

## 4. Workspace'ler

### My Day
- Assigned to me
- Waiting on me
- Waiting on others
- Overdue
- Revisions
- Approvals
- Blocked
- Follow-ups

### Sales Workspace
- Leads
- Customers
- Contacts
- Meetings
- Follow-ups
- Sales Design
- Customer Presentations
- Closed Won / Lost
- PM Handover

### Design Workspace
- My Design Jobs
- Unassigned Queue
- Sales Design
- Shop Drawings
- Revisions
- Ready for Sales Review
- Ready for Trust PM Review
- Designer workload

### PM Workspace
- Handover
- Finalization
- Customer Communications
- Change Requests
- Site Readiness
- Approvals
- Delivery Planning
- Build Planning

### Supply Workspace
- Project Types
- Type Assignment
- Item Plan
- Item List
- Book
- Technical Drawings
- Proposal
- PF
- PO
- Vendor / Pricing

### Production Workspace
- Production Board
- Vendor Assignment
- Production Dates
- Hold Reasons
- QC Readiness
- Packing Readiness

### QC Workspace
- Ready for QC
- My Inspections
- Failed Inspections
- Rework / Re-inspection
- Completed Inspections
- Checklist + photo evidence

### Warehouse Workspace
- Incoming Containers
- Receiving
- Quantity Verification
- Damage / Missing / Extra
- Warehouse Location
- Ready for Dispatch
- Job Site Dispatch

### Logistics Workspace
- Containers
- Shipments
- ETA
- Customs
- Warehouse / Job Site route
- Partial Delivery

### Management Workspace
- Company blockers
- Workload
- Pending approvals
- Project health
- Type health
- Production delays
- Communication gaps

## 5. Tam handoff zinciri

```text
Lead
→ Working on it - Trust
→ Sales Design Job
→ Designer Assignment
→ Sales Review
→ Customer Presentation
→ Revision Loop
→ Closed Won
→ PM Handover
→ PM Finalization
→ Type Assignment
→ Designer / Shop Drawer / Supply
→ Technical Review
→ Proposal / PF / PO
→ Production
→ QC
→ Packing
→ Container / Shipment
→ Warehouse
→ Delivery / Build
→ Punch List
→ Completion
```

## 6. Kritik otomasyonlar

### Sales → Design
Lead status `working_on_it_trust` olduğunda bir Sales Design job oluşturulur. Duplicate oluşturulmaz. İş gerçek designer'a atanır.

### Design → Sales Review
Designer versiyon yükleyip `ready_for_sales_review` yapınca Sales Rep'e görev düşer.

### Customer Revision → Designer
Müşteri feedback'i revision job olarak aynı designer'a geri döner. Eski versiyon korunur.

### Closed Won → PM
T-Lines PM + Trust PM atanır; handover checklist ve meeting oluşturulur.

### PM → Type Teams
Her type için ayrı owner, designer, shop drawer ve supply responsible atanır.

### PO Approved → Production
Production item aktifleşir; vendor yoksa Production Manager'a görev düşer.

### Production Ready → QC
QC görevi oluşur. FAIL sonucu rework'e, PASS sonucu packing'e gider.

### Packing → Logistics
Shipment/container assignment açılır.

### Shipment → Warehouse
Receiving görevi oluşur. Quantity/damage/missing/extra kontrol edilir.

### Warehouse → Delivery
T-Lines PM delivery planı kesinleştirir; dispatch ve build akışı başlar.

## 7. Permission sınırları

### T-Lines PM göremez
- PF
- Vendor purchase price
- Internal cost
- Margin
- Private vendor notes

### Designer göremez
- PF
- Vendor price
- Margin
- Unassigned projects

### Sales göremez
- PF
- Vendor internal price
- Trust Lines margin

### QC / Warehouse göremez
- Margin
- Customer private communication
- Sales pipeline

## 8. Uygulama sırası

### 11.0 Audit — ✅ TAMAMLANDI (2026-07-16) → **`AUDIT_PHASE11_ROLES.md`**
- [x] Aktif roller ve `role_definitions` çıkarılsın — 15 role_definition; 10 profilde 9 rol
- [x] Aktif `executive` kullanımı sıfırlansın — **zaten 0** (0 profil, 0 role_definition; 046 uygulanmış)
- [x] `general_manager` full authority doğrulansın — canlıda `{"all":true}` ✅
- [x] Mevcut profile metadata alanları çıkarılsın — 6 hedef alandan 5'i yok; `office` var ama 10/10 NULL
- [x] Tüm assignment alanları çıkarılsın — proje düzeyi 7 alan; type/supply/warehouse düzeyi yok
- [x] Duplicate task/assignment yapıları belirlensin — duplicate assignment yok; 4 paralel task kaynağı var

**11.0'ın 11.1'e bıraktığı kritik bulgular:**
- 🔴 `tlines_pm` canlıda `view.pf` + `view.prices` + `view.po` iznini **taşıyor** (§7 ihlali). Bugün RLS
  sızıntıyı engelliyor ama permission katmanı yanlış tarafta. Kök neden hem canlı seed'de hem
  `catalog.ts` `VIEW_ALL_TABS` default'unda.
- 🔴 `effectivePermissions()` stored map'i **merge etmez, ezer** → yeni izin için kod default'u yetmez,
  **forward seed migration şart**.
- 🟡 `pm__image` = yetim role_definition (0 kullanıcı, union'da yok) → silinmeli.
- 🟡 `accounting` rolünün `role_definitions` satırı yok (kod fallback'i çalışıyor ama Roles UI'da görünmez).
- 🟡 Açık kararlar: designer skill modeli (7 rol mü, `skills[]` mi), `pm_supervisor` (rol mü bayrak mı),
  `luxury_pm` scope'u tanımsız, `pm_millwork`/`pm_ceiling`/`project_manager` §2 listesinde yok ama canlıda
  imza zincirinde kullanılıyor.

### 11.1 Role Catalog

> **MODEL KARARLARI (kullanıcı onayı, 2026-07-16) — §2'nin rol listesi bu kararlarla ezilir:**
>
> 1. **Designer = TEK `designer` rolü + `skills[]` metadata.** §2'deki 7 ayrı designer rolü UYGULANMAZ
>    (çoklu-skill'i ifade edemiyor + rol patlaması). `millwork | shelving | ceiling | image | graphic |
>    shop_drawing` birer **skill**'dir (kolon 11.2'de gelir). **`design_lead` ve `shop_drawer` ayrı ROL**
>    olarak kalır — bunlar farklı *yetki*, farklı skill değil.
> 2. **`pm_millwork` / `pm_ceiling` / `project_manager` KORUNUR.** §2 listesi bunları atlıyor ama üçü de
>    canlıda ve **PF/PO imza zincirinde**. Silmek imzayı kırar → §2 listesi eksik kabul edilir.
> 3. **`pm_supervisor` ROL OLARAK EKLENMEZ.** Mevcut `profiles.is_pm_supervisor` bayrağı +
>    `projects.pm_supervisor_id` korunur (PO supervisor imza kutusu bayrağı okuyor). Additive-only.
> 4. **`luxury_pm` ERTELENDİ.** Scope'u tanımsız; tanımsız rol seed edilmez (over-grant riski).
>    Kullanıcı neyin PM'i olduğunu tanımlayınca eklenecek.

- [x] Nihai roller standardize edilsin (yukarıdaki 4 karara göre) — 7 yeni rol: `design_lead`, `shop_drawer`,
      `supply_manager`, `supply_user`, `production_user`, `warehouse_manager`, `warehouse_user`
- [x] Designer skill modeli: tek rol + `design_lead`/`shop_drawer` ayrı rol (skills[] kolonu → 11.2)
- [x] Luxury PM scope doğrulansın → **ERTELENDİ** (scope tanımsız, seed edilmiyor)
- [x] Permission seed / forward migration **065_phase11_role_catalog.sql** (idempotent)
- [x] `tlines_pm`'den `view.pf` + `view.prices` + `view.production_board` kaldırıldı — **`view.po` KASITLI
      OLARAK KALDI**: master plan §4.6 "T-Lines'a gönderilen PO"yu görünür sayıyor ve tlines_pm PO'nun
      Client PM imza kutusunu imzalıyor; kaldırmak PO onay akışını kırardı (CategoryTab `view.po` ile gate'li)
- [x] `pm__image` yetim rolü silinsin · `accounting` seed edilsin (ikisi de 065'te, guarded)
- [x] Types ve testler — `tests/roleCatalog.test.ts` (23 test): sınır ihlali + ters yön (iç roller PF'i
      görmeye devam ediyor) + merge-etmeyen `effectivePermissions` davranışı pinlendi
- [x] **BONUS (test'in bulduğu):** `sales_rep` / `sales_marketing_manager` `DEFAULT_PERMISSIONS`'ta HİÇ YOKTU —
      yalnız canlı stored map sayesinde çalışıyorlardı; temiz bir DB'de `{}` alıp kilitlenirlerdi. Eklendi
      (canlıyı birebir yansıtıyor → prod davranışı değişmiyor).

> ⚠️ **065 canlıya UYGULANMALI.** Uygulanana kadar `tlines_pm` canlıda `view.pf`/`view.prices`'ı TAŞIMAYA
> DEVAM EDER (stored map default'u ezer — kod düzeltmesi tek başına canlıda hiçbir şey değiştirmez).

### 11.2 Profile Metadata — ✅ TAMAMLANDI (2026-07-16) · migration **066_profile_metadata.sql** (canlıda doğrulandı)
- [x] company_side — `trust_lines | t_lines` + CHECK. **Backfill: 10/10 dolu** (tlines_pm/sales → `t_lines`,
      geri kalan → `trust_lines`; §7 duvarıyla aynı sınır)
- [x] office — 051'in **serbest metni** sabit kümeye normalize edildi (`turkey|syria|usa|other`) + CHECK.
      Canlıda 10/10 NULL olduğu için taşınacak veri yoktu; yine de migration eski metinleri (ILIKE `%turk%`,
      `%syri%`…) haritalar — boş DB varsayımına güvenilmedi
- [x] department — 10 değer + CHECK. **Backfill: 10/10 dolu** (rolden türetildi)
- [x] skills — `TEXT[] NOT NULL DEFAULT '{}'` + eleman CHECK'i + GIN index. **Tek `designer` rolü + çoklu
      skill** kararının veri karşılığı (11.1)
- [x] manager_id — FK `profiles(id) ON DELETE SET NULL` + **kendi kendinin yöneticisi olamaz** CHECK'i
- [x] region/service-line scope — `region_ids[]` + `service_line_ids[]` (GIN). **Additive**: mevcut tekil
      `pm_client_id` / `sales_region_id` / `is_pm_supervisor` **ELLENMEDİ** (PO imza zinciri + AI kapsamı onları okuyor)
- [x] Admin edit UI — Team → Edit içinde "Organisation" bölümü (company_side/office/department/manager
      select'leri + skills/regions/service-lines çoklu seçim). 066 uygulanmamışsa `metadataReady=false` ile
      **gizlenir**, sayfa bozulmaz
- [x] API — `PATCH /api/team/[id]` metadata'yı doğruluyor (geçersiz değer → **400**, ham 23514 değil) + artık
      `logAudit` yazıyor (AGENTS.md §7). `POST /api/team/invite` yeni üyeye company_side/department tohumluyor
- [x] Testler — `tests/profileMetadata.test.ts` (18 test). Kritik olan: **katalogdaki HER rolün** department +
      company_side eşlemesi var (yeni rol eklenip unutulursa ~40 kullanıcı filtrelerden düşerdi)

**Canlı doğrulama (kontrollü test, satır geri yüklendi):** `office="Syria Office"` · `department="not_a_dept"` ·
`company_side="nope"` · `skills=["nope"]` · kendi kendine manager → **hepsi 23514 ile reddedildi**;
geçerli değer (`office=syria`, `skills=[millwork,ceiling]`) **kabul edildi**.

> ⚠️ **051 → 066 kırılma riski kapatıldı:** designer davet formu `office`'e "e.g. Syria Office" gibi serbest
> metin yazıyordu. 066'nın CHECK'i bunu artık reddeder → invite route + Team edit UI **kod tarafında** sabit
> kümeye çevrildi. Aksi hâlde davet akışı 23514 ile kırılırdı.

### 11.3 Assignment Model — ⛔ GERİ ALINDI / DEĞİŞTİRİLDİ (2026-07-20, kullanıcı kararı) → **otomatik türetilen Team**

> 🔴 **Manuel atama modeli (067) KALDIRILDI (migration 069).** Kullanıcı manuel per-type atama gridini
> "çok kötü bir fikir" buldu: atama **seçilmemeli, otomatik olmalı**. Yeni model (11.4b):
> - `project_assignments` tablosu + API + grid + lib/assignments **tamamen silindi** (migration 069 tabloyu düşürdü).
> - "Kim bu projede?" artık **TÜRETİLİYOR** (`lib/team/derive.ts`): sabit PM kolonları + kişinin `skills[]`'i
>   (11.2) projenin tiplerine karşı eşleştirilir. Skill girilmemişse **departman** fallback'i devreye girer
>   (canlıda skill'ler boş olduğu için bugün departmanla dolar, skill girildikçe keskinleşir).
> - Sağ raydaki **Team** paneli (`ProjectRail`) bu türetilmiş listeyi gösterir; her kişinin yanında **neden**
>   orada olduğu (sabit rol etiketi + eşleşen tip adları) rozet olarak görünür. Ana koldaki tekrar eden
>   PeopleCard kaldırıldı.
> - My Day'in `assigned_to_me`'si de skill-tabanlı türetmeye çevrildi: "skill'ime uyan tipi olan projeler".
> - **Ekstra bug düzeltmesi (069):** `general_manager` proje OLUŞTURAMIYORDU — 002'nin `ops_create` INSERT
>   policy'si sadece `ops_manager`'a izin veriyordu (046 SELECT/UPDATE'i düzeltmiş ama INSERT'i atlamış).
>   "new row violates row-level security policy" hatası. 069 policy'yi `ops_manager + general_manager`'a açtı;
>   /projects "+ New project" düğmesi ve /projects/new sayfa kapısı da GM'e açıldı. **Canlı doğrulandı:** GM
>   artık ops ile birebir aynı noktaya kadar geçiyor (eskiden 42501 RLS, şimdi sadece form verisi eksikse 23502).
>
> Testler: `tests/teamDerive.test.ts` (skill match, departman fallback, dedup, sıralama). Grid/067 testleri silindi.
> Canlı: proje 193 sağ Team panelinde `manager` → "Production PM · Millwork & Shelving" + "Millwork/Shelving/Image".

---

#### (TARİHSEL — 067 modeli, artık geçersiz)

> **TASARIM KARARI — tek ev kuralı.** 11.0 audit'i "duplicate assignment yok" buldu; bu doğru kalmalı.
> `project_assignments` SADECE evi olmayan slot'ları modeller. Aşağıdakiler **kasıtlı olarak dışarıda**:
> `production_items.assigned_to` (production responsible) · `projects.*_id` (PM kolonları — PO imza zinciri
> okuyor) · `projects.qc_inspector_id` (proje düzeyi QC) · `sales_design_jobs.assigned_designer_id`.
> **Project team saklanmıyor, TÜRETİLİYOR** (`lib/assignments/team.ts`) — ikinci ev = kayma demek.

- [x] Sales Design assignee — **zaten vardı** (`sales_design_jobs.assigned_designer_id`); team türetmesine bağlandı
- [x] Project team — `assembleTeam()` (saf) + `loadTeam()` (IO). Tüm kaynakları birleştirir, **kişiyi
      tekilleştirir** (bir insan birden çok şapka takar → tek satır, çok rol)
- [x] Type owner · [x] Type designer · [x] Shop drawer · [x] Supply responsible — 067 slot'ları (type başına)
- [x] Production responsible — **yeniden modellenmedi**; `production_items.assigned_to` kaldı
- [x] QC responsible — type başına slot eklendi (`projects.qc_inspector_id` proje düzeyi varsayılan olarak kalır)
- [x] Warehouse responsible — proje düzeyi slot
- [x] **Handoff audit + duplicate protection** — `logAudit` (`assignment.set` / `assignment.cleared`) +
      **iki partial unique index**. Kritik: Postgres NULL'ları DISTINCT sayar, düz `UNIQUE(project_id, type,
      slot)` proje düzeyi (type NULL) duplicate'ini **engellemezdi** → ayrı `WHERE type IS NULL` index'i.
      API ayrıca idempotent: aynı atama tekrar gönderilirse `unchanged: true` döner, boşuna audit yazmaz.

**Ek korumalar:** atanan kişi **gerçek + aktif + rolü o slot'u tutabilen** biri olmalı (API 400 döner; office
asla assignee olamaz — §9). Skill uyumsuzluğu **uyarı, engel değil** (boş skills = uyumsuz sayılmaz, yoksa
11.2 sonrası her atama uyarı gösterirdi).

- [x] Types · API (`GET`/`PUT /api/projects/[id]/assignments`) · UI (`AssignmentPanel`, kokpitin altında,
      additive) · testler (`tests/assignments.test.ts`, 23 test)

**Canlı doğrulama (2026-07-16, test satırları temizlendi — 0 kaldı):**

| Test | Sonuç |
|---|---|
| Aynı (proje, type, slot) ikinci kez | ✅ **23505 reddedildi** — unique index çalışıyor |
| Farklı type (Ceiling), aynı slot | ✅ izin verildi — type başına ayrı owner mümkün |
| **NULL type duplicate** (Postgres NULL≠NULL tuzağı) | ✅ **reddedildi** — partial index deliği kapalı |
| Geçersiz slot / geçersiz type | ✅ **23514 reddedildi** |
| anon SELECT / anon INSERT (RLS) | ✅ **engellendi** (boş / 42501) |

### 11.4 Workspace Completion

> **Canlı route denetimi (2026-07-16, gerçek uygulama sürülerek):** `/dashboard` `/customers` `/design`
> `/projects` `/approvals` `/notifications` `/clients` `/production` `/logistics` `/suppliers` `/expenses`
> `/team` `/roles` `/audit` `/settings` → **200**. `/qc` → **404** (🔴 sidebar'da vardı!). `/pm`,
> `/warehouse`, `/management` → yok.

- [x] Design — `/design` zaten var (migration 052)
- [x] **PM — ✅ TAMAMLANDI (2026-07-17) · `/pm`** (migration gerekmedi)
- [x] Supply — sidebar'daki "Supply" `/projects`'e alias; proje alt sayfaları kapsıyor
- [x] Production — `/production` zaten var
- [x] **QC — ✅ TAMAMLANDI (2026-07-16) · migration 068_qc_workspace.sql (canlıda doğrulandı)**
- [ ] Warehouse — `/warehouse` yok (⚠️ canlıda **0 warehouse kullanıcısı** var; rol ve kişi olmadan
      inşa etmek kimseye hizmet etmez — 11.7 test hesaplarıyla birlikte ele alınmalı)
- [ ] Logistics — `/logistics` var (Phase 11 §4 bölümleri gözden geçirilmeli)
- [x] **Management — ✅ TAMAMLANDI (2026-07-17) · `/management`** (migration gerekmedi)

#### PM + Management Workspace (migration YOK)

**Farkındalık:** PM'in §4 bölümlerinin (Handover, Finalization, Change Requests, Site Readiness, Approvals,
Delivery Planning) **hepsi zaten vardı** — ama sadece **proje bazında**. Eksik olan projeler arası görünümdü:
20 projesi olan PM, nerede beklendiğini görmek için hepsini tek tek açmak zorundaydı.

PM ile Management **aynı türetme, farklı kapsam**: ikisi de Phase 10'un lifecycle motorunu (`deriveLifecycle`
+ `nextActions` + `redactLifecycleForRole`) yeniden kullanır. Yeni tablo, yeni durum, yeni kural yok.

- [x] `lib/workspace/portfolio.ts` — `assemblePortfolio` (saf) + `loadPortfolio` (IO)
- [x] 🔴 **N+1 önlendi:** `loadCockpit` proje başına ~10 sorgu atıyor; döngüde çağırmak 20 projede 200 sorgu
      demekti (AGENTS.md §5.7 yasağı). Bunun yerine tablo başına **tek** `.in('project_id', ids)` + bellekte
      gruplama → proje sayısı ne olursa olsun **~10 sorgu**
- [x] `isMyAction` — bir iş "benim" ise ya **rolüm** eşleşiyordur ya da o projede **beni** adlandıran PM
      slot'udur. Sadece role bakmak, her T-Lines PM'e diğer PM'lerin işini gösterirdi
- [x] `blockerRollup` — blocker başına **proje** sayar (satır değil); `workload` — kişiyi proje başına **bir
      kez** sayar (bir insan hem PM hem supervisor olabilir; iki kez saymak yükü şişirirdi)
- [x] `page.management` kataloğa eklendi — **sadece `{all:true}` rolleri** alır, seed migration gerekmez
- [x] 18 test (`tests/portfolio.test.ts`)

> 🔴 **`page.management` tek kapı DEĞİL.** `loadPortfolio` service-role ile okur, **RLS'i bypass eder**. Roles
> UI'ından bir `tlines_pm`'e bu izin verilse tüm şirketin projelerini görürdü — RLS kurtarmazdı. O yüzden
> sayfa rolü **ayrıca, fail-closed** kontrol ediyor (AGENTS.md §3).

**Canlı doğrulama (3 gerçek rolle oturum açılarak):**

| Kullanıcı | Sonuç |
|---|---|
| Taissier (`general_manager`) | `/pm` + `/management` ✅ · 2 proje, blocker rollup, PM workload gerçek veriyle |
| **Luna (`tlines_pm`)** | `/pm` → **sadece kendi projesi (343)**; GM'in gördüğü 193 YOK · vendor/PF/margin **hiç yok** ✅ |
| **Luna (`tlines_pm`)** | `/management` → **`/dashboard`'a yönlendirildi** ✅ (kapı tuttu) |
| hamza (`trustlines_pm`) | `/pm` ✅ |

🐛 **Sadece uygulamayı sürerek yakalandı:** `toRows` bir `'use client'` dosyasından export edilip sunucudan
çağrılıyordu → Next.js reddediyor, **her iki sayfa da "This page couldn't load" veriyordu**. tsc, lint, build
ve 285 testin hepsi geçmesine rağmen. `lib/workspace/rows.ts`'e taşındı.

#### QC Workspace (068)

🔴 **Kapatılan canlı hata:** `/qc` sidebar'da `page.qc` iznine bağlı görünüyordu ama **sayfa yoktu** —
`qc_responsible` (Cansu) tıklayınca **404** alıyordu. Asıl işi bu olan kullanıcı duvara çarpıyordu.

- [x] Ready for QC · My Inspections · Failed · Rework/Re-inspection · Completed — **hepsi TÜRETİLİYOR**
- [x] Checklist + photo evidence — `photos` JSONB (Dropbox dosya ref'leri; base64 blob değil)
- [x] `qc_checklists` **genişletildi, ikinci ev açılmadı**: `production_item_id` (type bağı — QC artık type
      başına), `rework_of_id` (fail→rework zinciri), `photos`, `notes`, `deleted_at`
- [x] **Durum kolonu YOK (kasıtlı)** — bölümler `overall_result` + `production_items.status` + `rework_of_id`
      üzerinden türetiliyor. Saklanan bir status, board'da item taşınır taşınmaz bayatlardı
- [x] `qc_result` enum'una **dokunulmadı** — canlıda gerçekten var (`pass|fail|pending`), zaten yeterli
- [x] Duplicate koruması: `uq_qc_open_per_item` — item başına tek AÇIK denetim
- [x] API (`POST`/`PATCH /api/qc/inspections`) + `logAudit` + sayfa + 21 test

**Önemli nüans:** `qc_result` **canlıda gerçek bir enum** (geçersiz değer → 22P02). `user_role`'ün aksine.
Yani CLAUDE.md'nin "enum yok" kuralı **sadece `user_role`'e** özgü, genel değil.

**Canlı doğrulama (test verisi temizlendi — 0 satır, item status geri alındı):**

| Test | Sonuç |
|---|---|
| Aynı item'a ikinci **açık** denetim | ✅ 23505 reddedildi |
| fail → **rework aç** → pass | ✅ döngü çalışıyor, en yeni verdict kazanıyor |
| `rework_of_id` = kendisi | ✅ 23514 reddedildi |
| anon SELECT / INSERT (RLS) | ✅ boş / 42501 |

> ⚠️ `is_internal_role()` (046) 11.1'in yeni rollerini **içermiyor** → `production_manager` QC slot'unu
> tutabiliyor ama RLS'te checklist okuyamıyordu. `is_internal_role()` başka tabloları da `FOR ALL` ile
> koruduğu için **genişletilmedi** (yan etkisi yazma yetkisi açmak olurdu); 068 QC'ye özel policy ekledi.

### 11.5 My Day Completion — ✅ TAMAMLANDI (2026-07-17) · migration YOK (mevcut altyapıya bağlandı)

Phase 10.4'ün `buildMyDay`'i sağlamdı ama **9 rolün My Day'i yoktu**: 11.1'in yeni rolleri (design_lead,
shop_drawer, supply_manager, supply_user, production_user, warehouse_manager, warehouse_user) + qc_responsible
+ project_manager — hepsi `SECTIONS_FOR_ROLE`'de eksikti, yani **sadece imza+bildirim** görüyorlardı. Oysa
11.3 ile hepsinin gerçek atanmış işi var.

- [x] **Her rol için gerçek görev kaynağı** — iki yeni bölüm:
  - `assigned_to_me` → yazıldığı tarihte 11.3'ün `project_assignments` tablosundan **bana atanmış** per-type
    slotları okuyordu (type owner / designer / shop drawer / supply / QC / warehouse). ⚠️ **GÜNCELLEME
    (2026-07-20, migration 069):** `project_assignments` kullanıcı kararıyla tamamen KALDIRILDI ("çok kötü bir
    fikir" — manuel atama yerine ekip tamamen türetilmeli). `assigned_to_me` artık `lib/team/derive.ts`'in
    skill-bazlı türetilmiş takım modelini kullanıyor — davranış (bana atanmış işler görünür) aynı, veri
    kaynağı farklı. Bkz. PROJECT-MASTER-PLAN.md 2026-07-20 CHANGE LOG girdisi ve
    [[trustlines-assignment-model]] (memory).
  - `qc_queue` → qc_responsible için: denetime hazır sayısı + benim açık denetimlerim + rework. `/qc`
    workspace'i ile **aynı `buildQcQueue` türetmesini** kullanır → ikisi asla çelişmez.
- [x] 9 eksik rol `SECTIONS_FOR_ROLE`'e bağlandı
- [x] Deep links — her satır `/projects/[id]`, `/qc`, `/approvals`'a gider
- [x] **Role-safe payload** — iki yeni bölüm de PRICEY DEĞİL (slot+type+proje kodu; para/vendor/margin yok).
  Mevcut price-safety testi korunuyor; yeni testler ekledim (`tests/myDay.test.ts`, 5 yeni)

**Canlı doğrulama:** hamza (`trustlines_pm`), Millwork type_owner + supply_responsible atanmış → dashboard'ında
My Day "Assigned to me" kartı ikisini de proje kodu (193) + deep link ile gösteriyor. 0 console hatası, para
sızıntısı yok.

> 📌 Assigned/Approval/Overdue/Follow-up/Revision bölümleri zaten vardı (signatures, overdue_followups,
> my_design_jobs, open_crs, notifications). 11.5'in kattığı: **"assigned to me"** (11.3'ün ürünü) + **QC** ve
> daha önce boş kalan rolleri gerçek işe bağlamak.

### 11.6 End-to-End Handoffs
- [ ] Sales → Design
- [ ] Design → Sales
- [ ] Revision → Designer
- [ ] Closed Won → PM
- [ ] PM → Type teams
- [ ] Supply → Approval
- [ ] PO → Production
- [ ] Production → QC
- [ ] QC Fail → Rework
- [ ] QC Pass → Packing
- [ ] Packing → Logistics
- [ ] Shipment → Warehouse
- [ ] Warehouse → Delivery
- [ ] Delivery → Completion

### 11.7 Test Accounts
Yaklaşık 40 kullanıcı için test matrisi hazırlanır:

```text
Login
Sidebar
Page access
Project visibility
Type visibility
Document visibility
Financial visibility
Assignment
Status change
Notification
My Day
Approval
Sign
Audit
```

## 9. Done definition

- Aktif `executive` kalmaz.
- General Manager full authority test edilir.
- Ops Manager Trust Lines operations full authority test edilir.
- Office string'i assignee olarak kullanılmaz.
- Tüm atamalar gerçek kullanıcıya yapılır.
- Her rolün My Day ekranı gerçek iş üretir.
- Her handoff sonraki kullanıcıya görev/bildirim üretir.
- QC fail/rework/pass web üzerinde çalışır.
- Warehouse receiving/dispatch web üzerinde çalışır.
- T-Lines PM yeni hiçbir yüzeyde PF/vendor price/margin görmez.
- Yaklaşık 40 hesapla rol test matrisi uygulanabilir.
- Typecheck, build ve ilgili testler geçer.
- Master plan ve current system state yalnız gerçek değişikliklerle güncellenir.

## 10. Claude protokolü

Kullanıcı `devam et` dediğinde bu dosyadaki ilk tamamlanmamış işi seç. Önce mevcut kodu audit et. Çalışan modülleri yeniden yazma. Migration, RLS, types, API, UI, audit ve test zincirini tamamla. Her görev sonunda değişen dosyaları, migration uygulama durumunu, test sonucunu ve sıradaki işi raporla.
