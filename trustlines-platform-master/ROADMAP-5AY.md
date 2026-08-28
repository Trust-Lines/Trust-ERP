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
- [x] 4. Müşteri revizyonu → Designer'a geri dönüş akışının doğrulanması — DONE 2026-08-28 (2 gerçek hata bulundu + düzeltildi)
- [x] 5. Closed Won → PM'e devir akışının doğrulanması — DONE 2026-08-28 (büyük bir yapısal boşluk bulundu, kısmen düzeltildi)
- [x] 6. Sınıflandırma kuralı kararının netleştirilmesi — KARAR VERİLDİ 2026-08-28: mevcut kural
      (sadece gerçek belge/link) KALIYOR — kod zaten doğru, sadece belge güncellendi
- [x] 7. "Working on it Trust" ara aşaması güvenlik ağının (ensureProjectForOpportunity) bağlanması — DONE 2026-08-28
- [x] 8. Kampanya modülünün gerçek bir kampanyayla uçtan uca denenmesi — DONE 2026-08-28 (hata bulunmadı, tamamen sağlam)
- [x] 9. Etkinlik (Events) modülünün sıfırdan tasarlanıp kurulması — DONE 2026-08-28 (yeni tablo GEREKMEDİĞİ ortaya çıktı, küçük bir form eksiği düzeltildi)
- [x] 10. Migration 087-104 için detaylı belge kaydının tamamlanması — DONE 2026-08-28

## AY 2 — Design, Supply, PM Çalışma Alanları

- [x] 11. Design — Atanmamış İş Kuyruğu ekranı — DONE 2026-08-28 (bulunan gerçek bug: atanmamış işler en görünmez bölümde kayboluyordu)
- [x] 12. Design — Shop Drawings bölümü — DONE 2026-08-28 (zaten mevcut onay motoruna bağlıymış, etiket düzeltildi + kritik RPC boşluğu bulunup kapatıldı)
- [x] 13. Design — "Trust PM Onayına Hazır" listesi — DONE 2026-08-28 (zaten mevcut `/approvals` gelen kutusu bunu yapıyormuş)
- [x] 14. Design — Designer İş Yükü görünümü — DONE 2026-08-28 (Madde 11 ile birlikte yapıldı)
- [x] 15. Supply — Ayrı çalışma ekranı kurulması — DONE 2026-08-28 (yeni `/supply` sayfası, `/projects`'e alias değil artık)
- [x] 16. Supply — Kişi-bazlı bekleyen-iş görünümü — DONE 2026-08-28 (bulunan gerçek bug: pm_millwork/pm_ceiling kendi projelerini hiç göremiyordu)
- [x] 17. PM çalışma alanına kişi-bazlı günlük öncelik listesi — DONE 2026-08-28 (gerçek öncelik verisi vardı ama kullanılmıyordu)
- [x] 18. Sales Opportunity ekranına aşama-bazlı mini özet — DONE 2026-08-28
- [ ] 18b. (YENİ — Madde 5'te bulundu) `clients` (Bölge) tablosunun doldurulması + bölgesel
      T-Lines PM otomatik atamasının Accept/Closed Won adımlarına güvenle bağlanması

## AY 3 — Production / QC / Logistics Tamamlama + Warehouse Kuruluşu

- [x] 19. Logistics ekranının spec ile satır satır karşılaştırılması — DONE 2026-08-28 (5/6 bölüm zaten tamdı, 1 gerçek eksik bulunup düzeltildi)
- [x] 20. QC ekranının en az 2 farklı gerçek kullanıcıyla test edilmesi — DONE 2026-08-28 (hata bulunmadı, tamamen sağlam)
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

### 2026-08-28 — AY 2 BAŞLADI. Madde 11 + 14: Atanmamış İş Kuyruğu + Designer İş Yükü
- Kullanıcı doğrudan şunu bildirdi: "Design workspace tamamen boş ekran" — designer test hesabıyla
  girildiğinde hiçbir şey görünmüyordu.
- 🔴 **BULUNAN GERÇEK HATA:** `awaiting_assignment` (yeni, henüz kimseye atanmamış) durumundaki
  işler `ACTIVE` kümesinde DEĞİLDİ, bu yüzden en az önemli bölüme ("Everything else") düşüyordu —
  tam da en çok dikkat gerektiren durumun, en görünmez yere gitmesi.
- **DÜZELTME:** Atanmamış işler artık kendi, İLK ve kırmızı vurgulu bölümünde ("Needs a designer
  assigned") gösteriliyor — her satırda doğrudan bir "Assign to…" seçici var, yöneticinin işi
  açıp kapatmasına gerek kalmadan tek tıkla atama yapılabiliyor.
- Aynı pakette **Designer İş Yükü** özeti eklendi — her designer'ın aktif iş sayısını gösteren
  küçük etiketler (3+ işi olan kırmızı renkte uyarıyor).
- **CANLI DOĞRULAMA:** Gerçek bir iş oluşturuldu → yöneticinin sorgusu onu hemen (durum:
  awaiting_assignment) gördü → designer'ın KENDİ sorgusu atamadan ÖNCE onu göremedi (0 satır) →
  atama yapıldı → designer'a gerçek bildirim gitti (sayı arttı) → designer'ın sorgusu artık işi
  gösteriyor (1 satır).
- Değişen dosyalar: `components/platform/design/DesignWorkspaceClient.tsx`,
  `app/(platform)/design/page.tsx`.
- Doğrulama: tsc temiz · lint 0 hata · build EXIT 0 · 460/462 test.

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

### 2026-08-28 — Madde 4: Müşteri revizyonu → Designer geri dönüşü doğrulandı + 2 gerçek hata düzeltildi
- 🔴 **BULUNAN HATA 1:** `app/api/public/reviews/[token]/route.ts` — müşteri herkese açık review
  linkinden "revizyon istiyorum" dediğinde, `sales_design_jobs.status` doğru güncelleniyordu ama
  **designer'a hiçbir özel bildirim gitmiyordu.** Bildirim sadece sabit 6 iç role (ops_manager,
  general_manager, trustlines_pm, tlines_pm, sales_rep, sales_marketing_manager) gidiyordu —
  `designer` bu listede hiç yok. Designer, işi ancak kendisi bakıp fark ederse revizyon istendiğini
  anlıyordu.
- 🔴 **BULUNAN HATA 2:** Aynı dosyada, müşteri "onaylandı" dediğinde, Marketing/Opportunity kökenli
  işlerde (proje zaten Accept adımında oluşmuş) onaylanan tasarım dosyaları **projeye hiç
  bağlanmıyordu** — bu blok da (madde 3'teki gibi) sadece `lead_intake_id` şartına bakıyordu.
- **DÜZELTME:** Revizyon isteğinde artık `assigned_designer_id`'ye, müşterinin yazdığı yorumla
  birlikte doğrudan bildirim gidiyor (hem eski hem yeni yol için). Onay durumunda Opportunity kökenli
  işler için de dosyalar artık `linkDesignFilesToProject` ile gerçek projeye bağlanıyor.
- **CANLI DOĞRULAMA (gerçek route kodu, gerçek public link, gerçek hesaplar):** Gerçek bir onay
  linki (`approval_links`, token gerçekten hash'lenip saklandı — üretimdeki gibi) oluşturuldu,
  gerçek `POST /api/public/reviews/[token]` rota kodu (kopyası değil, doğrudan import edilen aynı
  dosya) `action: "request_revision"` ve gerçek bir yorumla çağrıldı. Sonuç: designer'ın bildirim
  sayısı 1'den 2'ye çıktı, son bildirimin gövdesinde müşterinin yazdığı yorum **birebir** göründü,
  hem job hem version durumu `revision_requested` oldu.
- Eski versiyonun korunduğu da doğrulandı: yeni versiyonlar her zaman `INSERT` ile eklenir
  (`POST /api/design-jobs/[jobId]/versions`), var olan versiyon asla üzerine yazılmaz — bu zaten
  doğru tasarlanmış, dokunmadım.
- Değişen dosyalar: `app/api/public/reviews/[token]/route.ts`.
- Doğrulama: tsc temiz · lint 0 hata · build EXIT 0 · 460/462 test.

### 2026-08-28 — Madde 5: Closed Won → PM devri incelendi — bulunan şey "bildirim eksik" değil, daha büyük bir boşluktu
- 🔴 **BULUNAN GERÇEK DURUM (kod okunarak + canlı test edilerek doğrulandı):** Ne Sales'in "Accept"
  adımı, ne de "Closed Won" adımı, projeye **hiçbir zaman** bir T-Lines PM ya da Trust-Lines PM
  atamıyor. `projects.tlines_pm_id` / `trustlines_pm_id` bomboş kalıyor. Bunu yapan TEK yer, elle
  kullanılan "Yeni Proje" formu — o da seçilen `client_id`'ye (Bölge) göre `profiles.pm_client_id`
  eşleşen kişiyi buluyor. **Ama `clients` tablosu bu geliştirme veritabanında şu an tamamen boş
  (0 satır)** — yani bu otomatik eşleştirme mekanizması bugün hiçbir yerde gerçekten çalışamıyor,
  ne manuel formda ne otomatik yollarda.
- Bunu kendi başıma "düzelttim" demeden, bilinçli olarak SINIRLI bıraktım: boş bir tablodan
  regional PM tahmin etmeye çalışmak, **yanlış müşterinin PM'ine yanlış projenin görünmesi**
  riskini taşır (RLS `tlines_pm_id`'ye göre çalışıyor — yanlış atama gerçek bir veri sızıntısı
  olur). Bu, benim tek başıma karar verip kodlayacağım bir şey değil — `clients` verisinin
  doldurulması ayrı, önce yapılması gereken bir iş (muhtemelen Ay 2 veya 3'e eklenmeli).
- **YAPTIĞIM GÜVENLİ DÜZELTME:** `lib/marketing/salesHandoff.ts`'teki `closeWon()`'a, proje PM'siz
  kalmışsa `ops_manager`/`general_manager` rollerine **"Bu projeye PM atanmadı"** bildirimi gönderen
  bir güvenlik ağı ekledim. Kimseyi tahmin ederek atamıyorum — sadece kimsenin fark etmeden
  sahipsiz bir proje bırakmasını engelliyorum.
- **CANLI DOĞRULAMA:** Gerçek zincirle (Accept → Closed Won) bir proje oluşturuldu, PM sütunlarının
  gerçekten boş kaldığı kanıtlandı, general_manager hesabının bildirim sayısı arttı ve son bildirim
  gerçekten "New project needs a PM assigned" başlığını taşıyordu. Ayrıca: PM elle atandığında
  (bir ops kişisinin bugün zaten yaptığı gibi) hem `tlines_pm` hem `trustlines_pm` test
  hesaplarının KENDİ RLS oturumlarıyla projeyi gerçekten görebildiği doğrulandı — yani "atandıktan
  sonrası" sorunsuz, sorun sadece "hiç atanmıyor olması".
- Değişen dosyalar: `lib/marketing/salesHandoff.ts`.
### 2026-08-28 — Madde 6: Sınıflandırma kuralı — KARAR VERİLDİ, kapatıldı
- Kullanıcıya 3 seçenek sunuldu: (a) sadece belge/link (kodun bugün gerçekten yaptığı), (b) eski
  çoklu-sinyal kuralı, (c) ikisinin karışımı. **Seçilen: (a) — mevcut kural kalıyor.**
- Sonuç: **kod tarafında hiçbir değişiklik gerekmiyor** — `classifyLead()` zaten doğru kuralı
  uyguluyor. Tek yapılan, `PROJECT-MASTER-PLAN.md`'nin Phase 00.3c bölümünün bu kararla
  eşleştirilmesi (eski, artık geçersiz "çoklu sinyal" açıklamasının düzeltilmesi).
- Gerekçe (kayıt için): belge şartı nesnel ve suistimale kapalı — bir belge ya var ya yok, Sales'in
  "evet aktif proje var" gibi sözlü/tahmini beyanına dayanmıyor.

### 2026-08-28 — Madde 7: "Working on it Trust" güvenlik ağı bağlandı
- `lib/marketing/salesHandoff.ts`'teki `ensureProjectForOpportunity` fonksiyonu yazılmıştı ama
  hiçbir API rotasından çağrılmıyordu — bir Fırsat, Sales'in normal "Accept" adımından geçmeden,
  elle sürükle-bırakla doğrudan "Working on it Trust" aşamasına taşınabiliyordu ve bu durumda
  **projesiz** kalıyordu.
- **DÜZELTME:** `app/api/marketing/opportunities/[id]/route.ts`'in PATCH ucuna, stage
  "working_on_it_trust" yapıldığında `ensureProjectForOpportunity`'i çağıran bir kanca eklendi.
  Eksik bilgi (bölge/servis hattı/şehir Need'de yoksa) net bir hata mesajıyla kullanıcıya
  gösteriliyor — sessizce hiçbir şey olmuyormuş gibi davranmıyor. Arayüz tarafında
  (`OpportunitiesPageClient.tsx`) da bu sonucu (proje açıldı / eksik bilgi uyarısı) toast olarak
  gösterecek şekilde küçük bir ek yapıldı.
- **CANLI DOĞRULAMA:** Şehir bilgisi olmayan bir Need ile bu aşamaya taşınmaya çalışıldığında
  net bir hata alındı ("missing city..."); şehir eklenip tekrar denendiğinde gerçek bir proje
  açıldı (**STW 12**); aynı çağrı ikinci kez yapıldığında **ikinci proje açılmadı**
  (idempotency doğrulandı).
- Değişen dosyalar: `app/api/marketing/opportunities/[id]/route.ts`,
  `components/platform/marketing/OpportunitiesPageClient.tsx`.
- Doğrulama: tsc temiz · lint 0 hata · build EXIT 0 · 460/462 test.

### 2026-08-28 — Madde 8: Kampanya modülü uçtan uca test edildi — TAMAMEN SAĞLAM ÇIKTI
- Gerçek route kodlarını (kopya değil, doğrudan import) kullanarak tam zincir denendi: gerçek
  bir kampanya oluşturuldu → aktif edildi → herkese açık `GET /api/public/campaigns/[slug]`
  rotası hiçbir iç bilgi sızdırmadan doğru veriyi döndürdü → gerçek bir form gönderimi
  (`POST .../submissions`) 201 ile başarılı işlendi → **aynı `submissionToken` ile ikinci
  gönderim aynı `submissionId`'yi döndürdü** (tekrar/çift tıklama güvenliği çalışıyor) →
  **honeypot doldurulmuş sahte bir gönderim** sessizce `rejected_spam` olarak işaretlendi
  (çağırana hiçbir ipucu verilmeden, dokümandaki söz verildiği gibi) ve **hiçbir Prospect
  kaydı oluşturmadı** → istatistik paneli (`computeCampaignStats`) tüm bu sayıları doğru
  yansıttı (2 gönderim, 1 gerçek Prospect, 1 spam, 1 Potansiyel).
- Bu görevde **hiçbir hata bulunmadı** — modül gerçekten uçtan uca sağlam. Sadece bir gözlem
  (hata değil): kampanya slug'ı girilen `code` parametresinden değil, kampanya adından
  otomatik türetiliyor — beklenen davranış, dokümante edilmiş bir tasarım kararı.
- Test verileri (kampanya + prospect) temizlendi.
- Değişen dosya yok (sadece doğrulama).

### 2026-08-28 — Madde 9: Etkinlik modülü — planlanan "yeni tablo" GEREKMİYORMUŞ, gerçek eksik küçüktü
- Bu göreve başlamadan önce yaptığım kontrol, planı değiştirdi: `marketing_campaigns` tablosu
  (migration 086) baştan beri `campaign_type` alanında **hem `trade_fair` HEM `event`**
  değerlerini destekliyordu — ayrı bir `marketing_events` tablosu asla gerekmemiş. Liste ve
  detay ekranları da zaten "Event" filtresini/etiketini destekliyordu.
- 🔴 **BULUNAN GERÇEK EKSİK:** Tek eksik, **oluşturma/düzenleme formunun** kendisiydi —
  `CampaignFormClient.tsx` `campaignType`'ı sabit olarak `'trade_fair'` gönderiyordu, kullanıcıya
  seçim hiç sunmuyordu. Yani bir Marketing çalışanı arayüzden asla bir "Event" kampanyası
  oluşturamıyordu, sadece backend'de teorik olarak destekleniyordu.
- **DÜZELTME:** Forma "Trade Fair / Event" seçici eklendi (hem yeni oluşturma hem düzenleme
  ekranında); düzenleme sayfası artık `campaign_type` sütununu gerçekten okuyup forma dolduruyor.
- **CANLI DOĞRULAMA:** Formun gönderdiği BİREBİR aynı veriyle gerçek `createCampaign()` çağrıldı
  → `campaign_type = "event"` olarak oluştu → liste filtresinde (`type: "event"`) doğru çıktı →
  `updateCampaign()` ile geri `trade_fair`'e çevrildi, hepsi sorunsuz çalıştı.
- Bu, planlanandan çok daha küçük ve doğru bir düzeltmeydi — sıfırdan yeni tablo/API/ekran inşa
  etseydim, zaten var olan bir sistemi gereksiz yere ikiye katlamış olurdum.
- Değişen dosyalar: `components/platform/marketing/CampaignFormClient.tsx`,
  `app/(platform)/marketing/campaigns/[id]/edit/page.tsx`.
- Doğrulama: tsc temiz · lint 0 hata · build EXIT 0 · 460/462 test.

### 2026-08-28 — Madde 10: 087-104 migration belgeleri tamamlandı + AY 1 TAMAMLANDI 🎉
- `PROJECT-MASTER-PLAN.md`'ye 18 migration'ın (087-104, ClickUp entegrasyonu + Deals Unified
  Board) her biri için ayrı, gerçek CHANGE LOG kaydı eklendi — artık "sonra bakarız" değil,
  her migration'ın ne yaptığı tek satırda okunabiliyor.
- Ayrıca `docs/CLICKUP_IMPORT.md`'nin "henüz hiç import yapılmadı" diyen bayat durumu
  düzeltildi — gerçek durum: import tamamlandı, checklist güncellendi.
- Eski "start here next" bölümündeki 2 bayat madde de düzeltildi (migration 78 zaten
  uygulanmış ve doğrulanmış; Sales Opportunity ekranı zaten var olduğu ortaya çıktı).
- **🎉 AY 1 — TÜM 10 MADDE TAMAMLANDI** (madde 6 hariç tam kapalı; o da ürün kararı
  gerektirdiği için öneri yazılıp sizin onayınıza bırakıldı). Bu ay boyunca canlı testler
  sırasında bulunup düzeltilen gerçek hatalar: 3 tanesi bildirim eksikliği (designer'a
  atama/revizyon bildirimi gitmiyordu), 1 tanesi büyük yapısal boşluk (Closed Won'da hiç PM
  atanmıyor), 1 tanesi bağlanmamış güvenlik ağı (Working on it Trust proje kontrolü).
- Değişen dosyalar: `PROJECT-MASTER-PLAN.md`, `docs/CLICKUP_IMPORT.md`.

- **Ay 2/3'e eklenmesi gereken yeni, gerçek görev:** `clients` (Bölge) tablosunun doldurulması +
  bölgesel PM otomatik atama mantığının Accept/Closed Won adımlarına güvenle bağlanması. Bu,
  bugünkü küçük düzeltmeden daha büyük, ayrı bir iş.
- Doğrulama: tsc temiz · lint 0 hata · build EXIT 0 · 460/462 test.

### 2026-08-28 — Madde 17: PM önceliklendirme gerçek hale getirildi + test kalıntısı temizliği
- 🔴 **BULUNAN AYRI SORUN (test hijyeni):** Daha önceki bazı test script'lerimde proje silme işlemi
  `notifications.project_id` yabancı anahtar kısıtı yüzünden sessizce başarısız oluyordu (hata
  kontrolü yapmıyordum) — bu yüzden 3 tane ZZTEST projesi (STW 7/10/11) temizlenmeden dev
  veritabanında kalmıştı. Bulunup düzgünce (önce bildirimler, sonra proje) temizlendi. Bundan
  sonraki her script önce `notifications` tablosunu temizleyecek.
- 🔴 **ASIL BULUNAN HATA:** `lib/lifecycle/nextActions.ts` her aksiyona gerçek bir aciliyet puanı
  (`priority`) veriyordu (ör. "devam eden handover" = 70, "designer atanmamış" = 40) ama bu puan
  `lib/workspace/rows.ts`'te PM ekranına ulaşmadan önce siliniyordu. Sonuç: `/pm` sayfası "bende iş
  var mı yok mu"ya göre sıralıyordu, gerçekten en acil olan hangisiyse ona göre değil.
- **DÜZELTME:** `priority` alanı artık satırlara kadar taşınıyor, `/pm` sayfası artık her projenin
  en yüksek öncelikli aksiyonuna göre sıralıyor.
- **CANLI DOĞRULAMA:** Aynı PM'e ait iki test projesi oluşturuldu — biri "handover başlatılmamış"
  (öncelik 70), diğeri "handover devam ediyor" (öncelik 65). Gerçek `loadPortfolio()` çağrıldı,
  sıralama doğru şekilde yüksek öncelikli olanı önce gösterdi.
- Değişen dosyalar: `lib/workspace/rows.ts`, `app/(platform)/pm/page.tsx`.
- Doğrulama: tsc temiz · lint 0 hata · build EXIT 0 · 460/462 test · 18/18 portfolio testi.

### 2026-08-28 — Madde 15+16: Gerçek Supply Workspace kuruldu + büyük bir görünürlük hatası bulundu
- Kullanıcı: "Supply ekranı da Design gibi dolu dolu olsun." Önceki durum: menüdeki "Supply"
  aslında `/projects`'e (genel proje listesi) alias'tı, kendine ait hiçbir sayfası yoktu — bu,
  daha önceki 11.4 denetiminde de not edilmişti ama hiç düzeltilmemişti.
- 🔴 **BULUNAN BÜYÜK GERÇEK HATA:** `/pm` ve yeni `/supply` sayfalarının ikisinin de dayandığı
  `loadPortfolio()`'nun "bana ait projeler" filtresi SADECE `tlines_pm_id` / `trustlines_pm_id` /
  `pm_supervisor_id` sütunlarına bakıyordu. `prod_pm_ms_id` (Millwork/Shelving üretim PM'i) ve
  `prod_pm_ci_id` (Ceiling/Image üretim PM'i) — CURRENT_SYSTEM_STATE.md'de belgeli, gerçek
  sütunlar — bu filtrede **hiç yoktu**. Yani bir `pm_millwork` ya da `pm_ceiling` kişisi, kendi
  projesine gerçekten atanmış olsa bile, `/pm` ya da yeni Supply ekranında **sıfır proje**
  görüyordu — sessizce, hatasız, sadece boş.
- **DÜZELTME:** `lib/workspace/portfolio.ts`'teki `PortfolioProject` tipine ve sorgusuna bu iki
  sütun eklendi, "bana ait" OR-filtresi genişletildi.
- **YENİ SAYFA:** `/supply` — `/pm` ile aynı, kanıtlanmış motoru (Phase 10 lifecycle + Phase 11.4
  N+1-güvenli toplu yükleme) kullanıyor, sadece kapsamı farklı (`pm_millwork`/`pm_ceiling`/
  `supply_user` kendi projelerini, `supply_manager`/ops/gm hepsini görür).
- Sol menü güncellendi: "Supply" artık gerçek `/supply` sayfasına gidiyor; eski davranışı
  (genel proje listesi) kaybetmemek için o link **"All Projects"** adıyla ayrı bir madde olarak
  korundu.
- **CANLI DOĞRULAMA:** Gerçek bir proje, `prod_pm_ms_id` = pm_millwork test hesabı ile oluşturuldu.
  Eski sorgu mantığı bu projeyi **0** sonuç döndürerek doğruladı (hata gerçekten oradaymış);
  düzeltilmiş `loadPortfolio` aynı projeyi doğru buldu.
- Değişen dosyalar: `lib/workspace/portfolio.ts`, `app/(platform)/supply/page.tsx` (yeni),
  `components/platform/shell/Sidebar.tsx`, `tests/portfolio.test.ts`.
- Doğrulama: tsc temiz · lint 0 hata (3 önceden var olan uyarı) · build EXIT 0 (`/supply`
  derleniyor) · 460/462 test · 18/18 portfolio testi.

### 2026-08-28 — Rol modeli doğrulaması (kullanıcının tarif ettiği hiyerarşi)
- Kullanıcı sistemin olması gereken rol hiyerarşisini tarif etti: **genel PM** tüm Supply
  projelerini görür; **pm_millwork** Millwork+Shelving'i görür; **pm_ceiling** (image PM)
  Ceiling+Image'i görür; **tlines_pm (genel süpervizör)** tüm ABD satış projelerini görür ama
  **PF fiyatını görmez, PO'yu görür**; **bölgesel tlines_pm** sadece kendi bölgesinin projelerini
  görür.
- Bunu koda bakıp doğruladım — hepsi **zaten doğru kurulmuş** durumda, benim yeni `/supply`
  sayfam da bunu bedavaya miras aldı çünkü aynı paylaşılan motoru (`loadPortfolio` →
  `redactLifecycleForRole`) kullanıyor:
  - `prod_pm_ms_id` = Millwork+Shelving PM'i, `prod_pm_ci_id` = Ceiling+Image PM'i (tek sütun,
    iki kategoriyi birden kapsıyor) — Madde 15/16'da düzelttiğim eksiklik buydu zaten.
  - `pm_supervisor_id` = genel süpervizör (tüm bölgeler) — zaten OR-filtresinde vardı.
  - `tlines_pm_id` = bölgesel Client PM (proje bazında tek kişiye atanır) — bölge ayrımı bu
    sütun üzerinden doğal olarak sağlanıyor.
  - `redactLifecycleForRole()` → `tlines_pm` rolü için `pfSigned` alanını TAMAMEN kaldırıyor,
    vendor'la ilgili tüm blocker'ları filtreliyor, ama `poSigned` alanını KORUYOR.
- **CANLI DOĞRULANDI:** Gerçek bir proje, gerçek bir tedarikçisiz üretim kalemi (pf_usd=5000) ile
  oluşturuldu, tlines_pm test hesabıyla sorgulandı: kendi projesini gördü, başka bölgenin
  projesini görmedi, hiçbir vendor bilgisi sızmadı, `pfSigned` alanı yoktu, `poSigned` alanı
  vardı — tarif edilen modelin birebir aynısı.
- Değişen dosya yok (sadece doğrulama — sistem zaten doğru kurulmuştu).

### 2026-08-28 — Geri bildirim üzerine düzeltme: Supply için ayrı sayfa YOK, tek sayfa
- Kullanıcı geri bildirimi: "supply kısmı ayrı all projects kısmı ayrı değil, fazladan sayfa
  lazım değil, yeterli sayfada lazım." Az önce kurduğum ayrı `/supply` sayfası + "All Projects"
  ikili menü yapısı istenmiyor.
- **DÜZELTME:** `/supply` sayfası tamamen kaldırıldı. Onun yerine "Waiting on me" / "Blocked"
  özeti doğrudan **mevcut `/projects` sayfasının en üstüne** eklendi — tablo aynı yerde duruyor,
  üstüne bir özet bölümü geldi. Menüde tek "Supply" maddesi kaldı, `/projects`'e gidiyor.
  Kimsenin bekleyen işi yoksa bu bölüm hiç görünmüyor (boş kutu yok).
- Canlı doğrulandı: pm_millwork test hesabına atanmış proje, birleşik `/projects` sayfasında
  gerçekten görünüyor.
- Değişen dosyalar: `app/(platform)/projects/page.tsx`, `components/platform/shell/Sidebar.tsx`;
  silinen: `app/(platform)/supply/page.tsx`.
- Doğrulama: tsc temiz · lint 0 hata (3 önceden var olan uyarı) · build EXIT 0 (`/supply` artık
  build çıktısında YOK, `/projects` var) · 460/462 test.

### 2026-08-28 — Design workspace, gösterilen ekran görüntüsü gibi zenginleştirildi
- Kullanıcı, proje detay sayfasındaki (checklist + Team + Integrations + Details panelleri olan)
  ekranın bir benzerini Design workspace için istedi — "UI olarak da backend olarak da yap
  demiştim", "dropboxta design diye ayrı alanımız var."
- Her iş kartı açıldığında artık **iki sütun**: solda mevcut içerik (durum, müşteri özeti,
  versiyonlar), sağda üç yeni panel:
  - **Team** — Designer, İsteği açan kişi, Trust PM, Client PM (gerçek proje kaydından, aynı
    proje detay sayfasının kullandığı kaynaktan).
  - **Integrations** — Dropbox Design klasörü (durum + "Aç" butonu), önceden sayfanın ortasında
    dağınık duran bilgi artık gerçek bir panel.
  - **Details** — Öncelik, teslim tarihi, oluşturulma tarihi, versiyon sayısı.
- Designer'ın kendi adını artık kendi işinde görebilmesi için `designerMap`'in sadece yöneticiye
  değil herkese dolduğu düzeltildi (önceden `isManager` şartına bağlıydı).
- **CANLI DOĞRULAMA:** Gerçek bir zincir kuruldu (Lead → Fırsat → Proje → Tasarım işi), projeye
  gerçek bir Trust PM atandı, işe gerçek bir designer atandı — Team panelinin göstereceği isim,
  Dropbox Design klasör yolu, istek açan kişi, hepsi doğru veriden geldiği kanıtlandı.
- Değişen dosyalar: `app/(platform)/design/page.tsx`, `components/platform/design/DesignWorkspaceClient.tsx`.
- Doğrulama: tsc temiz · lint 0 hata · build EXIT 0 · 460/462 test.

### 2026-08-28 — Design versiyonları artık Dropbox'tan otomatik çekiliyor, elle eklenmiyor
- Kullanıcı geri bildirimi: "Add version burdan olmayacak, Dropbox bağlandığında otomatik
  çekicek." Kullanıcıya karar sordum — bir "versiyon" hangi klasör yapısıyla temsil edilsin diye
  — cevap: **"V1", "V2", "V3"... alt klasörleri**, tıpkı diğer belge tiplerinde (PF, PO)
  kullanılan aynı desen.
- Proje klasöre düştüğünde Dropbox klasörünün zaten otomatik açıldığı kod kontrolüyle
  doğrulandı (`ensureDesignDropboxFolder`, iş oluşturulduğu an otomatik çağrılıyor) — bu kısım
  zaten doğruydu.
- **YENİ:** "Add version" formu tamamen kaldırıldı. Yerine **"Sync versions from Dropbox"**
  butonu geldi. Designer Dropbox'ta "Design Proposal" klasörünün altına bir "V2" klasörü açıp
  dosya atar, butona basar — sistem klasördeki dosyaları tarar, henüz kayıtlı olmayanları
  otomatik oluşturur.
- Mantığı ikiye böldüm: `computeDesignVersionSyncPlan` (saf fonksiyon) ve
  `applyDesignVersionSyncPlan` (gerçek veritabanına yazan kısım) — bu sayede mantığı **gerçek
  Dropbox bağlantısı olmadan** (bu ortamda `DROPBOX_APP_KEY` boş) hem 7 birim testiyle hem
  gerçek veritabanına karşı kanıtlayabildim.
- **CANLI DOĞRULAMA (gerçek Supabase'e karşı, sahte Dropbox listesiyle):** İlk senkron 1
  versiyon + 2 dosya gerçekten yarattı, iş durumu "working_on_it" oldu → aynı senkron ikinci kez
  çalıştırıldı, **sıfır yeni kayıt oluştu** (idempotency) → V1'e yeni dosya + yepyeni V2 eklendi,
  üçüncü senkron sadece o farkı işledi.
- **Dürüst sınır:** Gerçek Dropbox'a bağlanıp gerçek dosya listeleme çağrısını bu ortamda test
  edemedim çünkü `DROPBOX_APP_KEY` boş — zaten kanıtlanmış `list-versions` rotasıyla birebir
  aynı deseni kullanıyor ama gerçek bir hesapla ilk kullanımda bir kere gözlemlenerek
  doğrulanmalı.
- Değişen/yeni dosyalar: `lib/sales/designVersionSync.ts` (yeni),
  `app/api/design-jobs/[jobId]/sync-dropbox/route.ts` (yeni),
  `tests/designVersionSync.test.ts` (yeni), `components/platform/design/DesignWorkspaceClient.tsx`.
- Doğrulama: tsc temiz · lint 0 hata · build EXIT 0 · 467/469 test (7 yeni, 2 önceden var olan
  ilgisiz hata).

### 2026-08-28 — Madde 12+13 incelemesi: KRİTİK bir altyapı boşluğu bulundu (migration 105)
- Madde 12 (Shop Drawings) ve 13 (Trust PM onay listesi) için önce mevcut sistemi inceledim —
  meğer **ikisi de zaten büyük ölçüde kuruluymuş**: `shop_drawing` belge tipi Trust PM → Client
  PM onay zincirini zaten paylaşıyor (`lib/approvals/stageConfig.ts`), ve genel `/approvals`
  gelen kutusu (`ApprovalsPageClient.tsx`) sırası kimdeyse ona zaten doğru gösteriyor — bu,
  Madde 13'ün istediği "Trust PM onayına hazır" listesinin ta kendisi. Küçük bir etiket eksiğini
  (`shop_drawing` → "Shop Drawing" yerine ham metin görünüyordu) düzelttim.
- 🔴 **BULUNAN KRİTİK HATA (asıl önemli bulgu):** Bunu canlı test etmeye çalışırken, TÜM onay
  zincirlerini başlatan (`initiate`) akışın dayandığı `create_document_approval` veritabanı
  fonksiyonunun **bu geliştirme veritabanında hiç var olmadığını** buldum. Kod (`doc-approvals`
  ve `dropbox/link-file` rotaları) bu fonksiyonu çağırıyor, belgeler ("Sistemin Kalbi" diye
  tanımlanan onay motorunun tam da bu şekilde çalıştığını) anlatıyor — ama **repodaki 104
  migration dosyasının hiçbirinde bu fonksiyonu oluşturan bir `CREATE FUNCTION` yok.** Yani bir
  yerde (muhtemelen üretim veritabanında) elle SQL Editor'den oluşturulmuş, hiçbir migration
  dosyasına hiç yazılmamış. **Bu, sadece Shop Drawing'i değil — plan_layout, proposal, item
  paketleri, PO, PF dahil HER belge tipinin onay zincirinin başlatılmasını** etkiliyor.
- **Kanıt:** Gerçek bir proje + shop_drawing belgesi oluşturup RPC'yi çağırdığımda hata:
  `Could not find the function public.create_document_approval(...) in the schema cache` —
  kodun kullandığı BİREBİR aynı parametre isimleriyle.
- **YAZDIM AMA UYGULAYAMADIM:** `supabase/migrations/105_create_document_approval_rpc.sql` —
  eksik fonksiyonu, gerçek çağrı noktalarının kullandığı parametre imzasıyla birebir aynı şekilde
  oluşturuyor. **Bu migration'ı ben veritabanına uygulayamam** (ham SQL/DDL çalıştırma yetkim
  yok, sadece tablo okuma/yazma) — Supabase Dashboard/CLI'dan elle çalıştırılması gerekiyor.
  Uygulandıktan sonra hemen canlı olarak yeniden test edip doğrulayacağım.
- ⚠️ **BU MIGRATION ACİL — diğerlerinden farklı olarak "sırada" değil, öncelikli.** Uygulanmadığı
  sürece bu veritabanında hiçbir belge onay zincirine giremiyor demektir.
- Değişen dosyalar: `components/platform/approvals/ApprovalsPageClient.tsx` (küçük etiket
  düzeltmesi), `supabase/migrations/105_create_document_approval_rpc.sql` (yeni).
- Doğrulama: tsc temiz · lint 0 hata · build EXIT 0 · 467/469 test.

### 2026-08-28 — Madde 12+13 KAPANDI: Migration 105 kullanıcı tarafından uygulandı, canlı doğrulandı
- Kullanıcı migration 105'i Supabase SQL Editor'den çalıştırdı.
- **CANLI DOĞRULAMA (hemen ardından):** Gerçek bir proje + shop_drawing belgesi oluşturuldu,
  `create_document_approval` RPC'si iki kez çağrıldı (stage 1: Trust PM/pending, stage 2:
  Client PM/waiting) — **ikisi de başarılı**, gerçek `document_approvals` satırları oluştu,
  satır Trust PM'in `/api/approvals/mine` sorgusunda doğru şekilde çıktı. Test verileri
  temizlendi, 0 kalıntı.
- **Sonuç: onay sistemi artık bu veritabanında uçtan uca çalışıyor — sadece Shop Drawing değil,
  her belge tipi için.** Bu, bugünkü en kritik bulgu ve düzeltmeydi.

## AY 3 — Production / QC / Logistics Tamamlama + Warehouse Kuruluşu

### 2026-08-28 — Madde 19: Logistics spec karşılaştırması — 5/6 bölüm zaten tamdı, 1 gerçek eksik bulundu
- Phase 11 §4'ün istediği 6 bölüm tek tek kontrol edildi: Containers ✅, Shipments ✅ (konteyner
  kaydının kendisi), ETA ✅, Warehouse/Job Site rotası ✅ (`delivery_destination` seçici +
  saha adresi), Partial Delivery ✅ (üretim kalemleri konteynerlere tek tek yüklenip
  boşaltılabiliyor, doğal olarak kısmi sevkiyatı destekliyor).
- 🔴 **BULUNAN GERÇEK EKSİK:** "Customs" bölümü — `customs_clearance_date` sütunu backend'de
  (migration 058) ve PATCH'in izin verdiği alan listesinde tam destekleniyordu, durum
  zincirinde "CUSTOMS" diye bir aşama bile vardı — ama arayüzde **hiçbir yerde gösterilmiyordu**.
  Konteyner detay sayfasındaki tarih satırı sadece Departure/ETA/Arrived/Warehouse'u
  gösteriyordu.
- **DÜZELTME:** "Customs cleared" tarih alanı eklendi.
- **CANLI DOĞRULAMA:** Gerçek bir konteyner oluşturuldu, alan gerçekten kaydedildiği (null'dan
  gerçek bir tarihe) doğrulandı.
- Değişen dosyalar: `components/platform/logistics/ContainerDetailClient.tsx`.
- Doğrulama: tsc temiz · lint 0 hata · build EXIT 0 · 467/469 test.

### 2026-08-28 — Madde 20: QC, iki FARKLI gerçek kullanıcıyla test edildi — TAMAMEN SAĞLAM
- İkinci bir gerçek QC hesabı açıldı (`qc-responsible-2@test.trust-lines.internal`) — artık
  sistemde 2 farklı, gerçek `qc_responsible` hesabı var.
- Gerçek bir proje + "RECEIVED" durumunda bir üretim kalemi oluşturuldu, tam senaryo iki farklı
  kullanıcı kimliğiyle yürütüldü: **Kullanıcı 1** denetimi açtı → **Kullanıcı 2** aynı kaleme
  aynı anda ikinci bir denetim açmaya çalıştı → **doğru şekilde engellendi** (23505) →
  Kullanıcı 1 "kaldı" (FAIL) dedi → **Kullanıcı 2** (farklı bir kişi) rework açtı → aynı anda
  başka bir denetim daha açmaya çalışıldı → yine engellendi → Kullanıcı 2 rework'ü "geçti"
  (PASS) yaptı → hem Kullanıcı 1'in hem Kullanıcı 2'nin kuyruğu son durumu (geçti) doğru
  gösterdi.
- Bu görevde **hiçbir hata bulunmadı** — modül gerçekten iki farklı gerçek kişiyle sağlam
  çalışıyor.
- Test verileri temizlendi. Değişen dosya yok (sadece doğrulama + 1 yeni test hesabı).
- Doğrulama: canlı test 8/8 adım doğru.

### 2026-08-28 — Kullanıcı isteği: mola öncesi tamamlanan kısımları sağlamlaştır
- Kullanıcı Warehouse'u erteledi ("onu daha kararlaştırcaz"), bitmiş kısımların üzerinden
  tekrar geçilmesini istedi. Yapılanlar:
- **Tam sağlık taraması:** tsc temiz, `npx eslint .` → sadece 4 önceden var olan hata
  (`_probe078b.mjs`, benim değil), build EXIT 0.
- 🔴 **BULUNAN 2 BAYAT TEST (gerçek kod hatası değil):**
  1. `STATUS_TO_STAGE.working_on_it_trust`'ın `null` olması gerektiğini varsayan test —
     migration 103 + bugünkü Madde 7 çalışmasıyla bu ARTIK gerçek, kanıtlanmış, kasıtlı bir
     geçiş. Test, bu karardan ÖNCE yazılmış, hiç güncellenmemiş.
  2. `loadOpportunityLeadRows`'un Lead'in adını göstereceğini varsayan test — gerçek kod
     kasıtlı olarak Fırsat'ın KENDİ başlığını önceliklendiriyor (daha isabetli), test yanlış
     varsayımla yazılmış.
  - İkisi de kodu değil, testin kendisini gerçek/kasıtlı davranışa göre düzelttim.
- **Madde 18 bitirildi:** Sales Opportunity ekranındaki "Design'ı Aç →" linkinin yanına artık
  gerçek bir mini özet geliyor (tasarım durumu, hangi designer, kaç gün önce güncellendi) —
  gerçek verilerle doğrulandı.
- **SONUÇ: Test paketi artık %100 yeşil — 32/32 dosya, 470/470 test, 0 hata.** Ay 1 ve Ay 2
  tamamen kapandı (sadece 18b — `clients` verisi doldurma — büyük, ayrı bir iş olarak bekliyor).
- Değişen dosyalar: `tests/opportunityRows.test.ts`,
  `app/(platform)/sales-projects/page.tsx`, `components/platform/sales/SalesOpportunitiesClient.tsx`.
