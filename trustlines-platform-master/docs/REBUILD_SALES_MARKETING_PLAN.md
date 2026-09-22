# Sales + Marketing'i yeniden kurma planı

Tarih: 2026-09-21 · Durum: **öneri — onay bekliyor** · Hazırlayan: kod ve canlı veritabanı ölçümüne dayanarak

## Karar: sıfırdan yeni uygulama değil — aynı veritabanı ve teknoloji üzerinde, modül modül yeniden kurulum

**Neden yeni backend/yeni uygulama yazmıyoruz**

| Ölçüm | Değer | Sonuç |
|---|---|---|
| Canlı veride dolu olan | Prospects 2.022, Contacts 2.164, Checklist 5.217, Notlar 2.522, Dosyalar 1.518, Needs 695, Opportunities 569, Potentials 128 | Değerli olan **veri ve veri modeli**; ClickUp'tan taşınan bu emeği yeniden yapmak istemeyiz |
| Supply / operasyon | 18 proje, 27 production item, 7 tedarikçi; 64 tablonun 29'u boş | Bu taraf henüz az kullanılıyor; şimdi dokunmak gereksiz risk |
| Teknoloji | Next 16, React 19, Supabase (Postgres), Dropbox; 115 migration, 37 test dosyası | Sağlıklı ve güncel; değiştirmeyi gerektiren bir sorun yok |
| Kod boyutu | ~67 bin satır; Sales + Marketing ≈ 22 bin satır | Yeniden yazılacak kısım sınırlı ve iyi sınırlanmış |

**Asıl sorun backend değil, iki şey:**

1. **CRM'in kavramsal olarak üçe bölünmüş olması.** Eski `lead_intake` (canlıda **6 satır**) hâlâ 47 dosyada, 141 satırda kullanılıyor; görev / aktivite / izleyici / tasarım işi tabloları "lead_intake **veya** opportunity" çift bağlantılı (2 migration). `opportunities` ile `prospect_potentials` aynı 13 sütunu kopyalıyor. Pipeline'ı ekranda görmek için 3 tablo TypeScript'te birleştiriliyor. Müşteri kavramı 3 tabloya dağılmış (customers, clients, prospects).
2. **Ön yüzde tek bir tasarım sistemi olmaması.** 111 dosya satır içi stil, 76 dosya global CSS sınıfı, 8 dosya Tailwind kullanıyor; 3 farklı tablo bileşeni, 1.600 satırlık dev ekranlar (Prospect detay). Sahibin her değişiklik isteği bu yüzden pahalı.

## Hedef model (Sales ve Marketing için ortak)

```
Contact / Company (prospects)  ──  Deal  ──  Project (Supply'ın çalıştığı yer, değişmez)
                                     │
                       Stage: Potential → Ready → Working on it Trust → Proposal → Changes → Closed (won/lost) · Waiting
                       + Tasks, Activity, Documents, Files, Notes  (hepsi tek bir Deal'e bağlı)
```

- **Tek Deal kavramı.** Potential ile Opportunity ayrı tablo olmaktan çıkar, aynı Deal'in iki aşaması olur.
- **Tek bağlantı.** Görev / aktivite / izleyici / tasarım işi sadece Deal'e bağlanır (çift bağlantı kalkar).
- **Sales ve Marketing aynı kayıtları farklı görünümlerle görür** (rol + bölge yetkisi aynen korunur).

## Aşamalar (her aşama tek başına yayınlanabilir; eski ekran, yenisi hazır olana kadar kalır)

| # | İş | Risk | Not |
|---|---|---|---|
| 0 | **Sahibin değişiklik listesi** (ekranlar, kavramlar, isimler) → bu belgeyi ona göre kesinleştirme | yok | Modeli bu belirler; buna kadar veri modeline dokunulmaz |
| 1 | Ön yüz temeli: tek tasarım sistemi (renk/aralık/tipografi belirteçleri + ortak bileşenler: Select, Tablo, Drawer, İstatistik, Belge görüntüleyici) | düşük | Bir kısmı hazır: Select, Progress paneli, Markdown, para gizleme, dashboard |
| 2 | Okuma katmanı: `crm_deals` SQL görünümü + tek TypeScript "Deal" tipi; ekranlar 3 tabloyu birleştirmeyi bırakır | düşük | Sadece okuma, veri değişmez |
| 3 | Yeni Sales+Marketing çalışma alanı: Contacts · Pipeline (liste/board) · Tasks · Dashboard · Campaigns, tek "Yeni deal" akışı | orta | Eski `/leads`, `/marketing/*` ekranları paralel çalışır, sonra kapatılır |
| 4 | Veri modeli sadeleştirme: `lead_intake` (6 satır) → Deal'e taşı; çift bağlantıları kaldır; Potential+Opportunity → tek `deals` tablosu | **yüksek** | Önce yedek (`/api/admin/backup` + Supabase PITR), migration'lar eklemeli; bir sürüm boyunca eski tablo salt-okunur kalır |
| 5 | Supply / Projects: dokunma → tasarım sistemine sonra geçir | düşük | Şu an çalışan kısım |
| 6 | Diğer modüller (Logistics, Customers, Approvals…) veri geldikçe | — | Boş tablolar için ekran cilalamak erken |

## Yapmayacaklarımız

- Supabase'i, Next.js'i veya Dropbox entegrasyonunu değiştirmek.
- ClickUp'tan taşınan veriyi yeniden içe aktarmak.
- Supply/Projects ekranlarını Sales/Marketing bitmeden yeniden yazmak.
- Yedek almadan tablo birleştirmek (Aşama 4).

## Aşama 0 için sahibin cevaplaması gerekenler

1. İstediği değişikliklerin listesi (hangi ekran, hangi kavram/isim).
2. Potential ve Opportunity onun için gerçekten ayrı iki şey mi, yoksa aynı işin iki aşaması mı?
3. Marketing ve Sales ayrı ekranlar/menüler olarak mı kalsın, yoksa tek "CRM" içinde farklı görünümler mi?
4. Sales tarafında kimler çalışacak (şu an sistemde sales_rep yok)? Bölge sahipleri kim?
