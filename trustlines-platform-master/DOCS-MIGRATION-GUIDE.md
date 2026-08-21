# Dokümantasyon Değiştirme Rehberi

`PROJECT-MASTER-PLAN.md` bu pakete dahil edilmemiştir ve değiştirilmemelidir.

Proje root'unda:

1. Mevcut `CLAUDE.md`, `README.md`, `SYSTEM_ARCHITECTURE.md`, `AGENTS.md` ve `TRUSTLINES_PLATFORM_IMPLEMENTATION.md` dosyalarının yedeğini alın.
2. Bu paketteki aynı adlı dosyalarla değiştirin.
3. Eski `PROJE_OZETI_DETAYLI.md` veya `PROJE_OZETI_DETAYLI(1).md` yerine `CURRENT_SYSTEM_STATE.md` kullanın.
4. `PROJECT-MASTER-PLAN.md` dosyasını olduğu gibi koruyun.
5. Claude Code'u ilk kez şu komutla başlatın:

```text
Read CLAUDE.md and all required documents in its source hierarchy. Do not modify PROJECT-MASTER-PLAN.md except for its CURRENT STATUS, NEXT TASKS and CHANGE LOG sections after completing an actual task. Start with the first incomplete Phase 0 audit item.
```
