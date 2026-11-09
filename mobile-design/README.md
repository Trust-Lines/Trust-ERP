# Trust Lines Mobil + Tablet — Taslak v5

Figma: https://www.figma.com/design/E4ijFv6u2FnFYvBw6duJEq

## Tasarım sistemi
- Kaynak: `Light Mode.tokens.json` + `Dark Mode.tokens.json` (Trust Lines DS).
- Figma'da **"Trust Lines DS"** değişken koleksiyonu: Light Mode / Dark Mode, 125 renk değişkeni (All Colors, Basic UI Colors, System Messages Colors, Status T0–T10, aşama renkleri), 7 metin stili (TL/…), Button · Chip · Input · List row bileşenleri.
- HTML mockup'ları aynı token'lara bağlandı (`source/mobile-mockups.html` → `:root`): metin = Body text / Primary heading (P500), ana aksiyon = Accent button+CTA (A400), koyu buton = Primary button (S700), linkler = Links (A600), sekme aktif = Navigation active (S500), etiketler = System Messages Colors.
- Not: T2 token'ında Foreground/background adları diğer T'lere göre ters tanımlı.

## Klasör
- `00-tasarim-sistemi.png` — token panosu
- `screens/` — 105 mobil ekran (390×844)
- `tablet/` — 67 tablet çerçevesi (iPad 11" yatay 1194×834), her mobil ekran en az bir tablet çerçevesinde
- `moduller/` — 12 mobil modül panosu · `tablet-moduller/` — 12 tablet modül panosu
- `source/` — kaynak HTML. Görünümler: `?v=05` tek mobil ekran, `?v=g3` mobil modül, `?v=T07` tek tablet, `?v=t3` tablet modülü, `?v=ds` tasarım sistemi

## Tablet düzeni
Sol 84 px navigasyon şeridi (Bugün, Görevler, QR, Mesai, Menü) + iki panel: solda liste (390 px), sağda detay. Giriş ekranları marka paneli + form; kamera/galeri/kiosk gibi ekranlar tek geniş panel.

## Figma sayfaları
`00 · Tasarım sistemi`, `01 … 12` modüller — her sayfada solda Mobil, sağda Tablet panoları.
Ekran katmanları HTML'den aktarıldığı için değişkenlere bağlı değil; renkler token değerleriyle birebir aynı. Grafiker 00 sayfasındaki bileşen ve değişkenlerle yeniden bağlamalı.

## Açık kararlar (değişmedi)
HR kuralları, mesai doğrulaması, QR yapısı, depo raf kodlaması, dil, etiket yazıcısı, teknoloji (Expo önerisi), fiyat gizliliği.
