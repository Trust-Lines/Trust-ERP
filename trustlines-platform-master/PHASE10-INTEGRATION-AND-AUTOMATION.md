# PHASE 10 — INTEGRATION, AUTOMATION & PROJECT COCKPIT ("Sinir Sistemi" Fazı)

> **Bu dosya `PROJECT-MASTER-PLAN.md`'nin devamıdır ve Phase 10'un tek kaynağıdır.**
> Okuma sırası: `CLAUDE.md` → `PROJECT-MASTER-PLAN.md` → bu dosya → `AGENTS.md` → `SYSTEM_ARCHITECTURE.md` → `CURRENT_SYSTEM_STATE.md`.
>
> Tarih: 2026-07-14 · Ön koşul: Phase 0–9 tamam (repo'da işaretli). Bu faz YENİ modül eklemez;
> mevcut modülleri birbirine bağlar, otomatikleştirir ve tek proje kokpitinde birleştirir.

---

## 0. PROBLEM TANIMI (neden bu faz var)

Phase 0–9 sonunda tüm parçalar mevcut: Customers, Sales Design, Handover, Finalization, Types,
Review Link, Containers, Delivery, Finance. **Ama sistem bir organizma gibi davranmıyor:**

1. Modüller ayrı sayfalar halinde yaşıyor (header linkleriyle gezilen adalar). Projeyi açan biri
   "şu an neredeyiz, sırada ne var, kim neyi bekliyor" sorusuna tek bakışta cevap alamıyor.
2. Master plan §3'teki 8 aşamalı ana zincir hiçbir ekranda canlı bir omurga olarak görünmüyor.
   DB'deki 5 aşamalı `current_stage` ile kağıttaki 8 faz eşlenmemiş.
3. Otomasyon noktasal: birkaç geçiş otomatik (design approved → Supply; container → SENT;
   delivery complete → delivered) ama zincirin çoğu halkası insan hafızasına bağlı.
4. Bir modüldeki olay diğer modülde iş üretmiyor (bildirim yok, görev yok, sonraki adım açılmıyor).
5. Rol bazlı "bugün ne yapmalıyım" ekranı yok; dashboard yeni zinciri yansıtmıyor.

**Phase 10 hedefi:** Mevcut çalışan hiçbir akışı yeniden yazmadan; olay → etki zinciri,
türetilmiş yaşam döngüsü, proje kokpiti ve rol bazlı "My Day" katmanını eklemek.

## 0.1 Değişmez kurallar (bu fazda da geçerli)

- Çalışan akışları YENİDEN YAZMA. Bu faz sadece bağ dokusu ekler (additive).
- `tlines_pm` hiçbir yeni yüzeyde (kokpit, next actions, event payload, bildirim, e-posta,
  My Day) PF / vendor fiyatı / iç maliyet / margin GÖREMEZ. Her yeni okuma yolu için bu ayrıca test edilir.
- Service-role kullanan her yeni route `requireRole()` taşır; rol çözülemezse fail-closed.
- Dropbox değişmezlik kuralları aynen geçerli.
- Yeni migration numarası: repo'daki gerçek en yüksek numarayı KONTROL ET.
  ✅ DOĞRULANDI (2026-07-14): repo'daki en yüksek migration **062** (`062_supply_types_and_logistics.sql`)
  → Phase 10'un ilk yeni migration'ı **063**.
- ⚠️ CANLI DB REPO'NUN GERİSİNDE (2026-07-14 read-only probe ile doğrulandı):
  - `delivery_plans` + `punch_list_items` canlı DB'de **YOK** → **migration 059 uygulanmamış**.
  - `customer_follow_ups.reminded_on` kolonu **YOK** → **migration 062 kısmen uygulanmış**.
  - Diğer her şey (001–062) canlıda mevcut; `system_events` yok (beklenen).
  - Etki: 10.1a saf fonksiyon olduğu için etkilenmez. 10.3 (`cockpitData`) ve 10.2b (A5 → delivery plan
    nudge) `delivery_plans` okur → o görevlerden ÖNCE 059 + 062'nin kalanı uygulanmalı.
- `documents` üzerinde `select('*')` yok; tüm yeni cross-project sorgular indeksli + limitli.
- Ağır hesapları her render'da yapma: kokpit/next-actions saf fonksiyon + tek toplu sorgu seti olmalı.

---

## 10.1 Project Lifecycle Engine (türetilmiş 8 aşama)

**Amaç:** Master plan §3'teki zinciri koda dökmek — ama `current_stage`'i bozmadan.

```text
LEAD → SALES_DESIGN → CLOSED_DEAL → PM_FINALIZATION → SUPPLY_DEVELOPMENT
→ APPROVALS (Proposal/PF/PO) → PRODUCTION_LOGISTICS → DELIVERY_BUILD → COMPLETED
```

- `lib/lifecycle/projectLifecycle.ts`: **saf fonksiyon** `deriveLifecycle(input) → { phase, perType, blockers }`.
  Yeni kolon YOK; mevcut veriden türetilir:
  - LEAD / SALES_DESIGN: `projects.is_draft = true` + bağlı `sales_design_jobs.status`
  - CLOSED_DEAL: deliver edilmiş + `project_handovers.status != completed`
  - PM_FINALIZATION: handover completed + (açık change_requests VEYA site_readiness != ready VEYA
    finalization tamamlanmadı işareti)
  - SUPPLY_DEVELOPMENT: production_items var ama PO/PF onay zinciri tamamlanmamış type'lar mevcut
  - APPROVALS: en az bir type'ın proposal/PF/PO onayı bekliyor
  - PRODUCTION_LOGISTICS: en az bir item ORDERED..SENT arası / container açık
  - DELIVERY_BUILD: tüm item'lar SENT + delivery_plan açık
  - COMPLETED: delivery plan completed / stage delivered
- Kesin eşleme kurallarını koda yazarken mevcut veriyle DOĞRULA (birkaç gerçek projede elle kontrol);
  çelişkide en geri aşamayı göster ve `blockers`'a nedenini yaz.
- Per-type alt durum: `production_items` (source='project') satırından okunur — Phase 4'teki karar korunur.
- Bu fonksiyon kokpit, dashboard, next-actions ve bildirim koşullarının TEK kaynağıdır.

## 10.2 Event & Automation Layer

**Amaç:** "Bir şey olduğunda sistem sonraki adımı kendisi açsın."

- Migration (yeni numara): `system_events` tablosu — `id, event_type, project_id?, lead_id?,
  entity_table, entity_id, actor_id?, payload jsonb (HASSAS ALAN YOK), created_at, processed_at?`.
  RLS açık (internal roller read; yazma yalnız service-role kod yolu). Indexler: project_id, event_type, created_at.
- `lib/events/bus.ts`: `emitEvent()` (yazma anında, transaction sonrası best-effort) +
  `handleEvent()` (senkron handler map'i; e-posta/notification best-effort, ana isteği asla bloklamaz).
  Cron/queue altyapısı KURMA — mevcut mimariye uygun şekilde route içi senkron + idempotent yaz.
- Her handler **idempotent** olmalı (aynı event iki kez işlense ikinci sefer no-op).
- `audit_log` bu iş için kullanılmaz (o insan-denetim kaydı); events makine tüketimi içindir.

### Otomasyon kuralları (V1 — hepsi bu fazda bağlanacak)

| # | Tetik (event) | Etki |
|---|---|---|
| A1 | Lead → CLOSED_WON / deliver | Handover kaydı yoksa oluştur; T-Lines PM + Trust PM'e bildirim; ilk finalization meeting için `customer_follow_ups`'a otomatik kayıt |
| A2 | Handover: tüm auto item yeşil + manuel budget onaylı | PM'e "Finalization'a geç" nudge bildirimi (otomatik stage zorlaması YOK — kullanıcı kontrolü korunur) |
| A3 | Site readiness → `ready` | Trust PM + logistics'e bildirim; delivery planning kartında "site ready" rozeti |
| A4 | PO zinciri tamamlandı (son imza) | İlgili type'ın production_items satırı vendorsüzse `production_manager`'a "vendor ata" bildirimi + My Day görevi; vendorluysa bilgi bildirimi |
| A5 | Bir projenin TÜM production item'ları `SENT` | T-Lines PM'e **"Items are ready"** bildirimi + e-posta (master plan §4.8'in birebir karşılığı); delivery plan yoksa oluşturma nudge'ı |
| A6 | Container → `WAREHOUSE` veya `ARRIVED_PORT` | Proje PM'lerine bildirim; delivery sayfasında durum rozeti |
| A7 | Change request → `approved` | Trust PM + Supply'a bildirim; CR'ın budget_impact'i proje Finance sayfasında "approved CR delta" satırı olarak görünür (yeni tablo yok, change_requests'ten oku) |
| A8 | Review link: müşteri kararı | (mevcut) + kararın proje communication timeline'ına event olarak düşmesi |
| A9 | Approval satırı 3+ gündür `pending` | Atanan imzacıya hatırlatma bildirimi (günde en fazla 1; `system_events` ile dedupe) |
| A10 | Design version `submitted` / job `revision_requested` | (mevcut bildirimler) + designer/sales My Day listelerine yansıma |

Her kural için: bildirim `notify.*` izin filtresinden geçer; `tlines_pm`'e giden payload'larda
fiyat/PF alanı bulunamaz; her etki `logAudit` ile kaydedilir.

## 10.3 Project Cockpit (`/projects/[id]` overview yenilemesi)

**Amaç:** Projenin nabzını tek ekranda göstermek. Mevcut alt sayfalar (handover, finalization,
types, delivery, finance) DURUR; kokpit onlara açılan canlı özet olur.

- **Lifecycle rail:** 8 aşamalı zincir, `deriveLifecycle` çıktısıyla; aktif aşama vurgulu,
  blocker'lar aşamanın altında kısa satır ("2 açık change request", "site not ready").
- **Type grid:** her type için owner / alt-status / vendor / hedef tarih (rol-güvenli: PF/budget
  yalnız yetkili rollere).
- **Next actions paneli:** `lib/lifecycle/nextActions.ts` — saf fonksiyon; proje verisinden
  `{ action, ownerRole/ownerId, href }[]` üretir. Örnek: "PO imzası bekleniyor → GM",
  "Vendor atanmalı → production_manager", "Delivery plan oluşturulmalı → T-Lines PM".
- **Timeline:** finalization sayfasındaki birleşik feed'i (meetings + follow-ups + CR + stage
  transitions + system_events) kokpite taşı/paylaştır — aynı veri iki kez sorgulanmasın, ortak lib fonksiyonu.
- **Bekleyenler şeridi:** açık approvals, açık CR, vadesi geçen follow-up sayıları (tek toplu sorgu).
- Header'daki link yığını sadeleşir: kokpit kartlarından alt sayfalara geçilir.
- Performans: tüm kokpit verisi TEK server-side toplama fonksiyonu (`lib/lifecycle/cockpitData.ts`),
  sınırlı kolonlar, N+1 yok.

## 10.4 Role Home — "My Day"

**Amaç:** Her kullanıcı girdiğinde "bugün benden ne bekleniyor" listesini görsün.

- `/dashboard` yeniden yapılır (mevcut dashboard'un çalışan widget'ları korunur, altına değil üstüne):
  rol bazlı bölümler tek toplama endpoint'inden (`/api/my-day`, requireUser + rol içi filtre):
  - Herkes: bekleyen imzalarım (`approvals/mine` reuse), okunmamış bildirimler
  - T-Lines PM: vadesi geçen follow-up'lar, site not-ready projeler, "Items are ready" projeleri, açık CR'lar
  - Trust PM / Supply: onay bekleyen type'lar, vendor bekleyen item'lar
  - production_manager: A4 görevleri, HOLD'daki item'lar
  - logistics: açık container'lar + ETA yaklaşanlar
  - designer: atandığım job'lar (assigned/working/revision) — mevcut /design sorgusu reuse
  - sales: mevcut lead reminder'ları buraya da yansır
  - accounting: unpaid supplier invoices, WAITING_PAYMENT item'lar
- Her satır tıklanınca ilgili sayfaya götürür. Boş/loading/error state zorunlu.
- `tlines_pm` My Day'inde fiyat içeren hiçbir satır yok (vendor bekleyen item'lar bile gösterilmez).

## 10.5 Bildirim matrisi konsolidasyonu

- `lib/notify/matrix.ts`: `event_type → { roles, notifyPermKey, emailTemplate? }` tek harita.
  Dağınık notify çağrıları (leads, approvals, design, review) kademeli olarak buradan geçirilir —
  davranış değişmeden (regresyon riski varsa mevcut çağrı yerinde bırakılır, sadece yeni A1–A10 buradan akar).
- E-posta yine `notify.*` izniyle ve best-effort.

## 10.6 Veri sürekliliği düzeltmeleri (küçük ama his'i yapan işler)

- **Deliver kapısı (soft):** lead deliver edilirken `customer_id` boşsa uyarı + tek tık
  "create customer from lead" (mevcut link-customer API reuse). Hard block YOK (mevcut akışı kırmaz).
- **Sales design → project documents:** onaylanan design versiyonunun dosyaları projeye
  `documents` metadata satırı olarak da bağlanır (doc_type: `sales_design`; Dropbox'ta dosya
  TAŞINMAZ, sadece pointer). Types sayfasındaki kart korunur; kokpitte de görünür.
- **Meetings/follow-ups proje yüzeyi:** customer_meetings/follow_ups zaten project_id taşıyor —
  kokpit timeline'ında ve My Day'de görünür olması yeterli (yeni tablo yok).

---

## UYGULAMA SIRASI (görevler — Claude bu sırayla, her biri ayrı tamamlanmış iş)

```text
[x] 10.1a lib/lifecycle/projectLifecycle.ts + birim testleri (gerçek veri kombinasyonlarıyla)
[x] 10.1b Per-type alt durum + blockers türetimi + testler
[x] 10.2a Migration 063_system_events.sql (RLS + indexler) + types + emitEvent/handleEvent iskeleti
[x] 10.2b A1, A2, A5 (en yüksek his etkisi: handover otomasyonu + "Items are ready")
[x] 10.2c A3, A4, A6, A7
[x] 10.2d A8, A9, A10 + notify matrix (10.5) — A9 dedupe testi zorunlu
[x] 10.3a cockpitData.ts + nextActions.ts (saf fonksiyonlar + testler)
[x] 10.3b Kokpit UI (lifecycle rail + type grid + next actions + bekleyenler + timeline)
[x] 10.4  /api/my-day + dashboard My Day bölümleri (rol rol; önce PM'ler, sonra ops/design/sales/accounting)
[x] 10.6  Deliver soft-gate + sales_design doc pointer + kokpit/My Day yüzeyleri
[x] Smoke test senaryosu: bir lead'i uçtan uca yürüt (lead → deliver → handover →
    finalization → types → site → CR → SENT → "Items are ready" → delivery → complete) ve her
    adımda beklenen event/bildirim/next-action'ın oluştuğunu doğrula. tlines_pm hesabıyla aynı projeyi
    aç: PF/margin/vendor fiyatı HİÇBİR yeni yüzeyde görünmemeli.
    → tests/phase10Smoke.test.ts (SMOKE=1 ile canlı DB'ye karşı; normal suite'te atlanır). 10/10 geçti;
      her adımda phase + event + notification doğrulandı, A1/A5 idempotency kanıtlandı, tlines_pm sızıntısı
      YOK, oluşturulan her satır temizlendi (0 artık).
```

## DONE DEFINITION (Phase 10'a özel ekler)

Master plan §18'e ek olarak:

- `deriveLifecycle` ve `nextActions` için vitest birim testleri var ve geçiyor.
- A1–A10 kurallarının her biri idempotent (çift tetik testi) ve audit log'lu.
- Kokpit + My Day, `tlines_pm` ve `designer` hesabıyla manuel doğrulandı (hassas alan sızıntısı yok).
- Yeni cross-project sorguların tamamı indeksli + limitli; kokpit tek toplama fonksiyonundan besleniyor.
- `PROJECT-MASTER-PLAN.md` CURRENT STATUS / NEXT TASKS / CHANGE LOG güncellendi ve bu dosyadaki
  görev kutuları işaretlendi.

## CLAUDE PROTOKOLÜ

- "devam et" → bu dosyadaki ilk işaretlenmemiş göreve başla; master plan protokolü aynen geçerli.
- Belirsizlikte: otomatik STAGE ZORLAMA yerine bildirim/nudge tercih et (aşama ilerletme kullanıcı
  kontrolünde kalır — mevcut felsefe).
- Bu fazda hiçbir tablo/kolon rename edilmez; her şey additive.
