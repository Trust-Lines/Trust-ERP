# TRUSTLINES_PLATFORM_IMPLEMENTATION.md — DEPRECATED

> **DURUM: TARİHSEL / UYGULANMAYACAK**
>
> Bu dosyanın eski içeriği projenin ilk planlama dönemine aitti. Güncel kod için uygulama talimatı değildir.

## Neden devre dışı?

Eski sürüm güncel repository ile çelişen talimatlar içeriyordu:

- Next.js 14 varsayımı; güncel sistem Next.js 16 kullanıyor.
- Eski 001–024 migration ve şema varsayımları; güncel sistem daha ileri migration geçmişine sahip.
- `user_role` enum varsayımı; canlı sistemde roller TEXT + `role_definitions` ile yönetiliyor.
- Dropbox’ta koşulsuz `overwrite` ve dosya silme endpoint’i önerileri; güncel değişmezlik kurallarına aykırı.
- Eski `clients → region → company` modelini gerçek müşteri modeli gibi kullanması.
- Güncel Sales CRM, global proje numarası, bölgesel PM, permission catalog, güvenlik düzeltmeleri ve AI segregasyonunu kapsamaması.
- Tailwind config ve eski framework konvansiyonlarına dayalı bazı artık geçersiz kurallar.

## Güncel kaynaklar

Uygulama sırasında şu sırayı kullan:

```text
PROJECT-MASTER-PLAN.md
→ CLAUDE.md
→ AGENTS.md
→ SYSTEM_ARCHITECTURE.md
→ CURRENT_SYSTEM_STATE.md
→ README.md
```

Eski implementation planına ait bir fikir tekrar kullanılacaksa önce mevcut kod, migration geçmişi, güvenlik modeli ve Dropbox kurallarıyla yeniden doğrulanmalıdır.
