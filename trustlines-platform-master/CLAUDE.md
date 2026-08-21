# CLAUDE.md — Trust-Lines Çalışma Girişi

Bu repository üzerinde herhangi bir değişiklik yapmadan önce aşağıdaki dosyaları belirtilen sırayla tamamen oku:

1. `PROJECT-MASTER-PLAN.md` — **ürün hedefi, iş akışı ve geliştirme sırası için tek ana kaynak**
2. `SYSTEM_ARCHITECTURE.md` — mevcut çalışan sistemin teknik mimarisi ve korunacak davranışları
3. `AGENTS.md` — zorunlu güvenlik, performans, Dropbox ve kodlama kuralları
4. `CURRENT_SYSTEM_STATE.md` — mevcut modüllerin ayrıntılı envanteri ve bilinen sınırlamalar
5. `README.md` — kurulum, komutlar ve dokümantasyon haritası

## Kaynak önceliği

Belgeler arasında çelişki olduğunda şu sıra geçerlidir:

```text
PROJECT-MASTER-PLAN.md
→ AGENTS.md
→ SYSTEM_ARCHITECTURE.md
→ CURRENT_SYSTEM_STATE.md
→ README.md
```

`TRUSTLINES_PLATFORM_IMPLEMENTATION.md` eski tarihsel taslaktır. Uygulama talimatı olarak kullanılmaz.

## “Devam et” komutu

Kullanıcı yalnızca `devam et` dediğinde:

1. `PROJECT-MASTER-PLAN.md` içindeki `CURRENT STATUS`, `NEXT TASKS` ve `CHANGE LOG` bölümlerini oku.
2. İlk tamamlanmamış görevi seç.
3. İlgili mevcut kodu ve migration geçmişini incele.
4. Önce bir mini audit yap; varsayımla tablo veya kolon yeniden adlandırma.
5. Çalışan yapıyı bozmadan görevi uçtan uca uygula:
   - migration
   - RLS
   - TypeScript tipleri
   - API yetkilendirmesi
   - UI ve rol görünürlüğü
   - audit log
   - loading / empty / error state
   - test veya en azından build
6. `PROJECT-MASTER-PLAN.md` içindeki durum, görev ve changelog bölümlerini güncelle.
7. Yapılan işi, değişen dosyaları, migration uygulama ihtiyacını ve sıradaki görevi Türkçe özetle.

## Temel iş kavramları

- **Trust Lines:** Supply, production ve iç operasyon organizasyonu.
- **T-Lines:** Trust Lines’ın sabit kurumsal müşterisi; Sales ve müşteri ilişkileri tarafı.
- **Customer / End Customer:** T-Lines’ın iş yaptığı gerçek son müşteri.
- `clients` tablosunu gerçek end customer sanma. Mevcut kullanımını audit etmeden rename veya migration yapma.
- Aynı iş için birden fazla proje açma. Sales, PM, Supply ve Operations aynı `Project ID` üzerinde çalışır.

## Rol yetki modeli (2026-07-10)

- `general_manager` = **full system-wide authority** (tüm sistem yetkisi).
- `ops_manager` = **full Trust Lines operational authority** (Trust Lines operasyon tarafında tam yetki).
- `executive` = **removed / deprecated** — yeni kodda KULLANILMAZ. (Migration 046 profilleri `general_manager`'a taşır.)

## Değişmez güvenlik kuralları

- `tlines_pm` PF, vendor alış fiyatı, iç maliyet veya margin göremez.
- Service-role kullanılan her route açık authorization kontrolü taşımalıdır.
- Dropbox’ta dosya/klasör silme, taşıma veya koşulsuz overwrite yapma.
- `documents` listelerinde `select('*')` kullanma.
- Yeni migration numarasını repository’deki gerçek en yüksek numarayı kontrol ederek belirle.
- Canlı şemada rol alanı TEXT’tir; var olmayan `user_role` enum’una migration yazma.
