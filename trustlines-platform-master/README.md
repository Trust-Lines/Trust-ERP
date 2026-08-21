# Trust-Lines Platform

Trust-Lines Platform; T-Lines Sales tarafından bulunan son müşterilerin işlerini Lead aşamasından başlayarak Sales Design, Closed Deal, PM Finalization, Supply, doküman onayları, üretim, lojistik, teslimat ve build süreçlerine kadar yöneten dahili kurumsal platformdur.

## Teknoloji

- Next.js 16 / React 19 / TypeScript
- Supabase Postgres, Auth ve RLS
- Dropbox API — tek dosya deposu
- Tailwind CSS v4
- React Hook Form + Zod
- XState
- React PDF + pdf-lib
- Nodemailer SMTP
- Anthropic SDK
- Vitest

## Yerel çalıştırma

```bash
npm install
npm run dev
```

Uygulama varsayılan olarak `http://localhost:3000` adresinde açılır.

Kontrol komutları:

```bash
npm run build
npm run lint
npm test
```

> Script adları `package.json` ile doğrulanmalıdır. Repository’de bulunmayan bir script varsayılmamalıdır.

## Environment

`.env.local` Git’e eklenmez.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
DROPBOX_REFRESH_TOKEN=

SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

ANTHROPIC_API_KEY=
NEXT_PUBLIC_APP_URL=
```

## Dokümantasyon haritası

| Dosya | Görevi |
|---|---|
| `PROJECT-MASTER-PLAN.md` | Hedef ürün, doğru iş modeli, roadmap ve Claude devam protokolü |
| `CLAUDE.md` | Claude’un repository’ye giriş talimatı ve belge önceliği |
| `SYSTEM_ARCHITECTURE.md` | Mevcut çalışan teknik mimari |
| `AGENTS.md` | Zorunlu güvenlik, performans ve kodlama kuralları |
| `CURRENT_SYSTEM_STATE.md` | Güncel ayrıntılı modül ve migration envanteri |
| `TRUSTLINES_PLATFORM_IMPLEMENTATION.md` | Eski tarihsel plan; uygulanmaz |

## Ana iş zinciri

```text
Lead
→ Sales Design
→ Closed Deal
→ PM Finalization
→ Supply Development
→ Type Proposals
→ PF / PO
→ Production
→ Container / Shipment
→ Delivery / Build
→ Completion
```

## Kritik kavram ayrımı

```text
Trust Lines = iç supply / production / operations
T-Lines = sales / PM / customer relationship
Customer = T-Lines’ın gerçek son müşterisi
```

Aynı proje tüm ekiplerde tek `Project ID` ile yaşar. Ekipler farklı workspace ve izinlerle aynı kaydı görür.

## Migration

Migration’lar `supabase/migrations/` altında tutulur ve mevcut proje düzenine göre uygulanır. Yeni migration oluşturmadan önce gerçek en yüksek numara kontrol edilir. Migration’ın uygulanması, kod değişikliğinden ayrı ve açıkça raporlanmalıdır.

## Dosya saklama

Supabase Storage kullanılmaz. Dosyalar Dropbox’ta, metadata Supabase’te tutulur.

Dropbox değişmezlik kuralları:

- Silme yok
- Koşulsuz overwrite yok
- Mevcut dosyayı taşıma veya yeniden adlandırma yok
- Var olan proje kökünü tekrar oluşturma yok
