# ClickUp import — media that did NOT come across (pending)

Written 2026-09-19. The ClickUp → Opportunities import (NE, SE, NW, West) re-hosts every task/comment
attachment in Dropbox (`need_files`). These could not be copied and must be handled before ClickUp is closed.
Task IDs are ClickUp task ids: open `https://app.clickup.com/t/<id>` to find the file.

## Reasons
- `>140MB` — too big for a single Dropbox upload. Needs a chunked upload session
  (`filesUploadSessionStart/Append/Finish`) added to `scripts/clickup-import-opportunities.mts`, then re-run
  with `--write --allow-fallback --backfill-details` (idempotent; already-imported files are skipped by name).
- `download failed` — ClickUp returned no file (deleted/hidden on their side?). Re-try once; if still failing,
  grab the file by hand from ClickUp before shutting it down.

## Northeast (TLINES_NE)
- 86bxm6tpq Architectural Plan Set 10-11-2022.pdf: download failed
- 86bxm6tpq Plan set for filing.pdf: download failed
- 86bxm6tpq 143-OP1-3-21-23-PLAN (1).pdf: download failed

## West (CVW)
- 86c8aebyp IMG_0478.MOV: >140MB
- 86c8aebvr Stamped Plans.zip: >140MB
- 86c8aebvr 5_15_2025 - Closed Deal Request - 1139 - San Luis Obispo, 4600 Broad St, CA.pdf: download failed
- 86c8aebvr 1139-DESIGN PROPOSAL.pdf: >140MB
- 86c8aebtz 1187 - North Star - Fontana, CA - Planset & Graphics Review - 2026_04_15 16_27 MST - Recording.mp4: >140MB
- 86c8aebtz 1187 - North Star - Fontana, CA - Planset & Graphics Review - 2026_04_15 16_27 MST - Recording.mp4: >140MB
- 86c8ae9wx 2022-12-16 40th & Pecos Floor Plan.pdf: download failed
- 86c8ae9ug LUX 1003 - Cornelis Hollander - Design - 09102025 - 2025_09_11 09_15 MST - Recording.mp4: >140MB
- 86c8ae7cg image.png: download failed
- 86c8ae77h EH-FDA-24-000276-WOF055.pdf: download failed
- 86c8ae6wk Blue Print drawing.jpg: download failed
- 86c8ae6bt Crossroads Chevron - Store  (1.28.25) (1).mp4: >140MB
- 86c8ae30r IMG_2512.MOV: >140MB
- 86c8ae30r Porterville C store.pptx: >140MB
- 86c8ae30r 1157 - Porterville, CA - Modify Request - 10_17_2025.pdf: download failed
- 86c8ae2c7 IMG_6291.MOV: >140MB
- 86c8ae2c7 IMG_6292.MOV: >140MB

## Southeast / Northwest
- none
