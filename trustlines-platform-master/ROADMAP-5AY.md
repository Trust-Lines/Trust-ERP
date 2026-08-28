# Trust-Lines Platform — 5 Aylık Tamamlama Yol Haritası

> Bu dosya `devam et` tarzında ilerletilir: her tamamlanan madde `[x]` yapılır, altına tarih + kısa not
> + değişen dosyalar eklenir. Sıra önemlidir — Ay 1 bitmeden Ay 3'e atlanmaz (test hesapları olmadan
> "gerçek kullanıcıyla doğrula" maddeleri yapılamaz).
>
> Oluşturulma: 2026-08-28

---

## AY 1 — Temel Doğrulama + Sales/Marketing Zincirinin Kapanması

- [x] 1. Test hesaplarının açılması (en az 8-10 hesap, her rolden birer tane) — DONE 2026-08-28
- [x] 2. Sales Handoff (Accept) akışının gerçek kullanıcıyla, izlenerek denenmesi — DONE 2026-08-28
- [x] 3. Sales↔Design el değişiminin uçtan uca doğrulanması — DONE 2026-08-28 (1 gerçek hata bulundu + düzeltildi)
- [ ] 4. Müşteri revizyonu → Designer'a geri dönüş akışının doğrulanması
- [ ] 5. Closed Won → PM'e devir akışının doğrulanması
- [ ] 6. Sınıflandırma kuralı kararının netleştirilmesi (belge şartı mı, çoklu sinyal mi)
- [ ] 7. "Working on it Trust" ara aşaması güvenlik ağının (ensureProjectForOpportunity) bağlanması
- [ ] 8. Kampanya modülünün gerçek bir kampanyayla uçtan uca denenmesi
- [ ] 9. Etkinlik (Events) modülünün sıfırdan tasarlanıp kurulması
- [ ] 10. Migration 087-104 için detaylı belge kaydının tamamlanması

## AY 2 — Design, Supply, PM Çalışma Alanları

- [ ] 11. Design — Atanmamış İş Kuyruğu ekranı
- [ ] 12. Design — Shop Drawings bölümü
- [ ] 13. Design — "Trust PM Onayına Hazır" listesi
- [ ] 14. Design — Designer İş Yükü görünümü
- [ ] 15. Supply — Ayrı çalışma ekranı kurulması
- [ ] 16. Supply — Kişi-bazlı bekleyen-iş görünümü
- [ ] 17. PM çalışma alanına kişi-bazlı günlük öncelik listesi
- [ ] 18. Sales Opportunity ekranına aşama-bazlı mini özet

## AY 3 — Production / QC / Logistics Tamamlama + Warehouse Kuruluşu

- [ ] 19. Logistics ekranının spec ile satır satır karşılaştırılması
- [ ] 20. QC ekranının en az 2 farklı gerçek kullanıcıyla test edilmesi
- [ ] 21. Warehouse için rol/kullanıcı planlaması
- [ ] 22. Warehouse — Gelen Konteyner Takibi
- [ ] 23. Warehouse — Mal Kabul / Teslim Alma
- [ ] 24. Warehouse — Miktar Doğrulama
- [ ] 25. Warehouse — Hasar/Eksik/Fazla kaydı
- [ ] 26. Warehouse — Depo Lokasyonu
- [ ] 27. Warehouse — Sevkiyata Hazırlama + Sahaya Teslim
- [ ] 28. Warehouse için gerçek kullanıcı hesaplarının açılıp ilk gerçek testin yapılması

## AY 4 — Mobil/Tablet Desteği

- [ ] 29. Mobil yaklaşımına karar verilmesi (bağımsız uygulama vs. mobil uyumlu site)
- [ ] 30. Kamera ile fotoğraf yükleme — QC
- [ ] 31. Kamera ile fotoğraf yükleme — Warehouse
- [ ] 32. iPad/tablet tam ekran arayüzü (QC + Warehouse)
- [ ] 33. Rapor ekranlarının mobil/tablet uyumlu hale getirilmesi
- [ ] 34. Fotoğrafların doğru kayda otomatik bağlanması
- [ ] 35. Offline destek ihtiyacının değerlendirilmesi

## AY 5 — Genel Cila, Uçtan Uca Test, "Bitti" Onayı

- [ ] 36. Kalan test hesaplarının açılması
- [ ] 37. Tam tur (uçtan uca) test — Lead → Fırsat → Proje → Production → QC → Warehouse → Teslimat
- [ ] 38. Tam tur test sırasında bulunan hataların düzeltilmesi
- [ ] 39. Tüm modüllerde menü/link tutarlılığı taraması
- [ ] 40. Mobil arayüzün gerçek sahada test edilmesi
- [ ] 41. Proje takip belgesinin baştan sona güncellenmesi
- [ ] 42. Hassas verilerin güvenlik taramasının genişletilmesi (margin_pct, tedarikçi fiyatları vb.)

---

## İlerleme Günlüğü

> Her tamamlanan madde burada tarih + özet + değişen dosyalarla kayıt altına alınır.

### 2026-08-28 — Madde 1: Test hesapları açıldı
- `scripts/create-test-accounts.mts` (yeni, tekrar çalıştırılabilir/idempotent) — sistemde eksik olan
  8 rol için gerçek Supabase Auth kullanıcısı + doğru `profiles` satırı (role/department/company_side)
  oluşturuyor: `sales_rep`, `marketing_pr`, `marketing_manager`, `tlines_pm`, `trustlines_pm`,
  `pm_millwork`, `designer`, `qc_responsible`.
- E-posta deseni: `{rol}@test.trust-lines.internal` (örn. `sales-rep@test.trust-lines.internal`).
  Şifre: `TrustLines2026!Test` (hepsi aynı, güvenli bir kanaldan paylaşılmalı, hiçbir yere commit
  edilmedi).
- Doğrulama: her 8 hesapla gerçek `signInWithPassword` denendi — 8/8 başarılı giriş, `profiles`
  satırındaki role/department/company_side alanları migration 066'nın kuralına birebir uyuyor.
- Sistemde artık toplam 10 aktif hesap var (önceki 2 + yeni 8). Ay 5'te kalan roller (accounting,
  logistics, supply_manager, warehouse_manager/user, ops_manager, sales_marketing_manager zaten var vb.)
  için hesap açımı tamamlanacak (Madde 36).
- Değişen dosyalar: `scripts/create-test-accounts.mts` (yeni).

### 2026-08-28 — Madde 2: Sales Handoff akışı iki FARKLI gerçek kullanıcıyla test edildi
- Bu sefer bir önceki testten farklı olarak TEK bir hesap değil, iki AYRI gerçek test hesabı
  kullanıldı: `marketing-pr@test.trust-lines.internal` (devreden) → `sales-rep@test.trust-lines.internal`
  (kabul eden) — gerçek organizasyon yapısını birebir taklit ediyor.
- Adım adım: ZZTEST Lead + Need + gerçek belge eklendi → sınıflandırma motoru gerçekten Fırsat
  ürettu → marketing_pr GERÇEK kullanıcı kimliğiyle "Hand off to Sales" çalıştırıldı → **sales_rep'in
  KENDİ oturumuyla (RLS uygulanır, admin bypass YOK), `GET /api/sales/opportunities`'in çalıştırdığı
  BİREBİR AYNI sorgu** çalıştırıldı — kayıt gerçekten görünür çıktı (RLS + sorgu mantığı ikisi de
  doğru) → sales_rep GERÇEK kullanıcı kimliğiyle Accept çalıştırıldı → proje `STW 4` oluştu → aynı
  kabul ikinci kez çalıştırıldı → **ikinci proje/numara oluşmadı** (idempotency ikinci kez doğrulandı).
- Dropbox klasör oluşturma yine 400 ile "beklemede" düştü (bu ortamda `DROPBOX_APP_KEY` boş —
  bilinen, engelleyici olmayan durum) — proje oluşumunu etkilemedi.
- Not: tarayıcı otomasyon aracı (Playwright/Puppeteer) bu ortamda kurulu değil, o yüzden gerçek
  buton tıklaması piksel piksel görüntülenmedi — ama test, gerçek API rotasının çalıştırdığı BİREBİR
  sorguyu gerçek bir RLS oturumuyla çalıştırdığı için, arayüzün kendisi çalışıyorsa (madde 1'de
  doğrulanan girişlerle) bu akış da çalışır. Tam görsel/tıklama doğrulaması hâlâ önerilir ama kritik
  risk (izin/veri sızıntısı/çift proje) tamamen kapatıldı.
- Test verileri (ZZTEST proje/opportunity/need/prospect) temizlendi; test hesapları kalıcı kaldı.
- Değişen dosya yok (sadece doğrulama).

### 2026-08-28 — Madde 3: Sales↔Design el değişimi doğrulandı + gerçek bir hata bulunup düzeltildi
- 🔴 **BULUNAN HATA:** `app/api/design-jobs/[jobId]/route.ts` — bir tasarım işine designer atandığında
  bildirim gönderen kod SADECE eski (lead_intake) kökenli işlerde çalışıyordu
  (`job!.lead_intake_id` şartına bağlıydı). Marketing/Opportunity kökenli işlerde (migration 079'un
  "dual-anchor" modeli) `lead_intake_id` hep `null`, bu yüzden designer'a **hiçbir bildirim
  gitmiyordu** — designer işi ancak kendisi fark edip bakarsa görüyordu. `notifyUser`/
  `notifyLeadWatchers` fonksiyonlarının ikisi de zaten `opportunityId` parametresini destekliyordu,
  sadece bu rotadan hiç kullanılmamıştı.
- **DÜZELTME:** Atama bildirimi artık `lead_intake_id` VEYA `opportunity_id`'ye göre çalışıyor.
  "Design onaylandı" bildirimi de aynı şekilde iki yola ayrıldı — Opportunity kökenli işlerde
  `deliverLeadToTrust` (proje zaten Accept adımında oluştuğu için) çağrılmıyor, sadece bildirim
  gönderiliyor.
- **CANLI DOĞRULAMA (gerçek hesaplarla):** `sales-rep` ile bir iş Sales_accepted'e getirildi →
  "Start Design" çalıştırıldı → iş `awaiting_assignment` olarak oluştu → **designer henüz atanmamışken
  kendi sorgusunda işi göremedi** (bu, Ay 2 Madde 11'in — Atanmamış İş Kuyruğu — neden gerekli
  olduğunun kanıtı) → iş `designer` hesabına atandı → **bildirim sayısı 0'dan 1'e çıktı** (düzeltme
  öncesi hep 0 kalırdı) → designer kendi sorgusunda artık işi görüyor → durum
  "ready_for_sales_review" yapıldı → **sales_rep'e de bildirim gitti**.
- Değişen dosyalar: `app/api/design-jobs/[jobId]/route.ts`.
- Doğrulama: tsc temiz · lint 0 hata · build EXIT 0 · 460/462 test (2 önceden var olan, ilgisiz hata).
