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

## ClickUp Docs embedded in comments (29)
The import could only get the Doc's id — ClickUp's API returns 403 for these Docs (not readable with our token), so their CONTENT is not in the CRM. In the CRM each shows as a "ClickUp Doc" link card. Before closing ClickUp, open each one and export/copy it (or move the Docs somewhere the token can read, then re-run the import).

- dhdc7-6615 — Easton 160 S 3rd street, PA (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-6615
- dhdc7-4995 — Bronx, 2918 Boston Rd, NY (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-4995
- dhdc7-11095 — tallahassee, capital circle ne FL (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-11095
- dhdc7-7975 — Morehead highway 60 ,KY (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-7975
- dhdc7-8675 — New Britain 373 West Main Street  CT (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-8675
- dhdc7-9195 — Providence, 545 broad ST, RI (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-9195
- dhdc7-7655 — Morehead Highway 801 ,KY (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-7655
- dhdc7-12415 — Bronx3535 white plains road  NY (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-12415
- dhdc7-9395 — Hartford 181 Franklin Ave 
CT (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-9395
- dhdc7-11475 — Phillipsburg, 598 Memorial Parkway ,NJ (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-11475
- dhdc7-12495 — Wolcott, 47 wolcott road, CT (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-12495
- dhdc7-5255 — East Haven 227 Saltonstall Pkwy CT (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-5255
- dhdc7-9815 — New Britain 296 Allen Street New Britain CT (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-9815
- dhdc7-9575 — Hazleton, 3 Forest Hill Road ,PA (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-9575
- dhdc7-6355 — Bristol 198 Burlington AVE CT (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-6355
- dhdc7-12375 — Goshan, 303 Greenwich Ave, NY (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-12375
- dhdc7-12335 — Strattanvile, Route 322, PA (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-12335
- dhdc7-10815 — New Haven 80 Amity Rd CT (TLINES_NE) — https://app.clickup.com/14202247/v/dc/dhdc7-10815
- dhdc7-5295 — Alamo, 939 S Alamo Rd
 TX 78516 (TLINES_NW) — https://app.clickup.com/14202247/v/dc/dhdc7-5295
- dhdc7-6735 — HOUSTON,10146 WESTHEIMER RD,TX (TLINES_NW) — https://app.clickup.com/14202247/v/dc/dhdc7-6735
- dhdc7-6855 — HOUSTON, CYPRESS,21102 FM 529, TX (TLINES_NW) — https://app.clickup.com/14202247/v/dc/dhdc7-6855
- dhdc7-8315 — LACOMBE ,LA HWY 434 AT LPB BLVD.  LA (TLINES_NW) — https://app.clickup.com/14202247/v/dc/dhdc7-8315
- dhdc7-9435 — Channelview, 230 dell dale st, TX (TLINES_NW) — https://app.clickup.com/14202247/v/dc/dhdc7-9435
- dhdc7-8455 — WILLIS, INTERSTATE 45 N,TX (TLINES_NW) — https://app.clickup.com/14202247/v/dc/dhdc7-8455
- dhdc7-14735 — Deep Singh Build (CVW) — https://app.clickup.com/14202247/v/dc/dhdc7-14735
- dhdc7-11015 — Grocery - Cottonwood, 206 Gas Point Rd CA (CVW) — https://app.clickup.com/14202247/v/dc/dhdc7-11015
- dhdc7-14295 — Pasco, 10002 Burns Rd, WA (CVW) — https://app.clickup.com/14202247/v/dc/dhdc7-14295
- dhdc7-17895 — The Dalles, 516 w 9th st, OR (CVW) — https://app.clickup.com/14202247/v/dc/dhdc7-17895
- dhdc7-17855 — Keizer, 6375 River Road N, OR (CVW) — https://app.clickup.com/14202247/v/dc/dhdc7-17855

## ClickUp Docs imported into the CRM (2026-09-19)
165 Docs read from ClickUp: 130 became the **Documents** section of a deal, 15 became Contact notes. Files linked inside them (~470) were copied to Dropbox and appear under the record's Files.

### Still not in the CRM
- Docs whose parent task is not in the CRM (20) — the task itself was never imported (not in any Contacts / Opportunities list we pulled):
  - EASTON OFFICE YOUR CHOICE — parent task 86byn2qtf
  - Camilla, 300 W. Broad Street, Georgia — parent task 86bz4qy6h
  - Collect Information — parent task 86bzmgzzn
  - Project info — parent task 86c4tk385
  - Fine Indian restaurant — parent task 86c8rdz1n
  - Doc — parent task 86c8rdz1p
  - Doc — parent task 86c8rdz2k
  - Doc — parent task 86c8rdz4a
  - Modification — parent task 86c8rdz6u
  - New Britain 296 Allen Street New Britain CT — parent task 86c8rdzb4
  - 598 Memorial Parkway, Phillipsburg, NJ 08865 — parent task 86c8rdzc7
  - Doc — parent task 86c8rdzcr
  - 373 West Main Street  New Britain CT 06052 — parent task 86c8rdzdv
  - Doc — parent task 86c8rdzgg
  - Easton160 S 3rd street,PA — parent task 86c8rdzmx
  - Doc — parent task 86c8rdzv1
  - Morehead,KY — parent task 86c8rdzwe
  - Providence, 545 broad ST, RI — parent task 86c8re022
  - Doc — parent task 86c8re024
  - Doc — parent task 86c9tvjpf
- Files from Docs that did not copy (2):
  - Modify Request 8/14/2024 — Collect Information: Hand Draw Floorplan Example.pdf — download failed
  - Modify Request 8/14/2024 — Collect Information: IMG__4126 (1).MOV — over 140MB
- Contact notes from Docs are plain text (Markdown not rendered) and their files were attached to the Contact's company, not the person.
