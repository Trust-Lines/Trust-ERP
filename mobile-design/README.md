# Trust Lines Mobil — Tasarım Taslağı v4 (105 ekran)

## Klasör
- `00-tasarim-sistemi.png`: renkler, tipografi, ölçüler, bileşenler (grafiker için ilk bakılacak sayfa)
- `moduller/`: 12 modül panosu, her modülün tüm ekranları açıklamalarıyla birlikte
- `screens/`: 105 ekranın her biri ayrı, 2x çözünürlükte (940×1840), `001-…` → `105-…`
- `source/mobile-mockups.html`: kaynak dosya. Tarayıcıda açılır: `#05` tek ekran, `#g3` tek modül, `#ds` tasarım sistemi.

## Modüller (Figma'da her biri bir sayfa, her ekran 390×844 frame)
| # | Modül | Ekranlar |
|---|---|---|
| 1 | Başlangıç & giriş | 01 Giriş · 46 Şifre sıfırlama · 47 PIN · 31 İzinler · 48 Çalışma yeri |
| 2 | Ana sayfa · role göre | 02 QC · 50 Depo (EN) · 51 Saha PM · 52 Yönetici · 53 Lojistik · 16 Görevler · 32 Bildirimler · 54 Boş durum |
| 3 | Ortak araçlar | 49 Arama · 56 AI asistan · 57 Rehber · 58 Kişi · 15 Menü · 30 Ayarlar · 55 Senkron çakışması · 59 Yardım |
| 4 | HR · Çalışan | 03 Giriş · 60 Giriş onayı · 61 Konum dışı · 62 Mola · 17 Çıkış · 04 Puantaj · 64 Aylık · 33 Vardiya · 34 Düzeltme · 35 Bakiye · 18 İzin talebi · 65 Belgeler · 63 Kiosk |
| 5 | HR · Yönetici | 19 Ekibim · 66 İzin onayı · 67 Ekip puantajı · 68 Vardiya planla |
| 6 | QR & ürün | 05 Tarayıcı · 44 Kod tanınmadı · 20 Arama · 69 Toplu tarama · 70 Toplu işlem · 06 Ürün kartı · 72 Geçmiş · 73 Galeri · 74 Video · 21 Durum · 36 Kamera · 22 İşaretleme · 75 Etiket · 71 Kalemler |
| 7 | Kalite kontrol | 07 Kuyruk · 08 Denetim · 23 Red · 76 Onay · 77 Rework · 37 Sorun bildir · 78 İstatistik |
| 8 | Lojistik · konteyner | 09 Liste · 79 Yeni · 24 Detay · 80 Durum · 81 Belgeler · 82 Yükleme planı · 10 Yükleme · 25 Kapanış · 26 Palet etiketi · 83 Gemi takibi |
| 9 | Depo | 84 Ana sayfa · 11 Teslim alma · 39 Rafa yerleştir · 38 Sayım · 85 Sevkiyat hazırlama · 86 Toplama · 87 Sevkiyat takvimi · 41 Missing & Extra |
| 10 | Saha & proje | 43 Projeler · 27 Detay · 95 Aktivite · 42 Dokümanlar · 45 Notlar · 94 Kişiler · 88 Takvim · 89 Teslimat planı · 12 Saha raporu · 90 Kurulum raporu · 91 Punch · 92 Değişiklik talebi · 40 Teslimat kanıtı · 93 Müşteri kabulü |
| 11 | Onay & finans | 14 Onaylar · 28 İmzala · 96 İmza zinciri · 97 Revize iste · 13 Masraf fişi · 29 Masraflarım · 98 Masraf detayı · 99 Muhasebe onayı · 100 Ödeme onayları |
| 12 | Satış · saha | 101 Lead'ler · 102 Kartvizit · 103 Lead detay · 104 Ziyaret · 105 Anket QR |

Tasarım sistemi: renkler web platformunun `globals.css` token'larından alındı. Yazı tipi Instrument Sans, ikonlar lucide (web ile aynı). Fotoğraf, harita, video ve QR'lar yer tutucudur. Sayfanın İngilizce hali örnek olarak ekran 50'de var.

## Web platformuyla ilişki
| Mevcut altyapıyı kullanan | Yeni geliştirme gerektiren |
|---|---|
| My Day, görevler, bildirimler, toplantılar (Google Calendar) | **HR modülü:** mesai, mola, vardiya, izin, bakiye, düzeltme, kiosk, yönetici onayları |
| production_items, durum zinciri, ürün QR etiketi ve videoları | Push bildirim, çevrimdışı senkron kuyruğu ve çakışma çözümü |
| QC (`/qc`, qc_checklists, rework zinciri) | Toplu tarama, palet kaydı, etiket yazıcısı |
| Konteynerler (12 durum, container_items, container_documents) | **Depo:** raf/lokasyon, rafa yerleştirme, sayım, toplama, sevkiyat takvimi |
| Delivery plan, site readiness, handover, change requests | Kurulum günlük raporu, punch detayı, müşteri kabulü, teslimat kanıtı |
| Approvals ve imza zinciri, expenses, payments | Fiş fotoğrafından otomatik okuma, sorun/hasar kaydı, gemi takibi entegrasyonu |
| Trust Lines AI, prospects, campaigns ve survey QR | Kartvizit okuma, mağaza ziyareti check-in |

## Onay sırasında karar verilecekler
1. **HR kuralları:** fazla mesai eşiği, izin hakları, vardiya tipleri, mesai toleransı. Bordro belgeleri (65) dış bir sisteme bağlanacaksa hangisi?
2. **Mesai doğrulaması:** konum + kapı QR'ı varsayılan. Selfie ve kiosk tableti isteğe bağlı.
3. **QR yapısı:** ürün QR'ı şu an montaj videosuna gidiyor (44 bunu karşılıyor). Kalem, palet, raf ve konteyner için ayrı QR formatları tanımlanmalı.
4. **Depo:** raf kodlaması (örnek B-3-12), sayım sıklığı, toplama kuralları.
5. **Dil:** Türkiye ekibi Türkçe, ABD ekibi İngilizce varsayılan (50 örnek).
6. **Etiket yazıcısı** modeli ve etiket ölçüleri.
7. **Teknoloji önerisi:** Expo (React Native). Mevcut TypeScript, Zod ve Supabase kodu tekrar kullanılır, uygulama iOS ve Android'de çalışır.
8. **Fiyat gizliliği:** fiyat, PF ve marj yalnızca yetkili rollere gösterilir (100). tlines_pm hiçbir ekranda bunları görmez (96'daki not).

## Figma
Dosya: https://www.figma.com/design/E4ijFv6u2FnFYvBw6duJEq (trustai's team, taslaklar)
- README sayfası + 13 sayfa: `00 · Tasarım sistemi`, `01 … 12` modüller (06 iki parça halinde).
- Katmanlar düzenlenebilir; component/variable yapısını grafiker kuracak.
- Yeniden aktarmak için: `source/` klasörünü yerelde sun, `mobile-mockups.html?v=g3` gibi modül adresini Figma yakalama betiğiyle aç.
