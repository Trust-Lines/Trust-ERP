// Which Dropbox folder is a project's? Pure scoring over the scanned folder index
// (lib/dropbox/folderScan.ts) — used by the admin "Dropbox Matching" page.
//
// Folder names on the real drives are inconsistent ("STNE 409 - …", "409-Roodhouse, …",
// "STNW408 MARKET", "PSNW480-Brookfield…", a 262 both under Under Working and Done), so no single
// rule is trusted. Each candidate earns points for every clue that agrees and loses some for clues
// that disagree; only a clear, single winner counts as "sure". Everything else goes to a person.

import { liveKey } from '@/lib/workspace/live';
import { dropboxRegionFolder, dropboxSectionForServiceLine } from '@/lib/regions';

export interface MatchProject {
  id: string;
  code: string | null;
  name: string | null;
  region: string | null;        // TLINES_NE …
  service_line: string | null;  // store_maker | design_build | premium_store_fitout …
  current_stage: string | null;
  dropbox_root_path: string | null;
}

export interface FolderRow { path_lower: string; path_display: string; name: string }

export interface Candidate { path: string; score: number; reasons: string[] }

export type MatchStatus = 'linked' | 'sure' | 'ambiguous' | 'none';

export interface MatchResult { status: MatchStatus; candidates: Candidate[] }

const REGION_PREFIX = /^(?:ST|PS|DS)(?:NE|SE|NW|W)(?=\s|-|_|\d|$)\s*/i;

/** A folder name in the same shape as liveKey(): region prefix dropped, upper-case, separators folded. */
export function folderKey(name: string): string {
  return name.toUpperCase().trim().replace(REGION_PREFIX, '').replace(/[\s_-]+/g, ' ').trim();
}

/** Does this folder name look like a project folder (so the scan doesn't go inside it)? */
export function looksLikeProject(name: string): boolean {
  const n = name.trim();
  if (/^(19|20)\d{2}$/.test(n)) return false;                 // a year folder
  if (/^\d\s*-/.test(n)) return false;                          // "1-Finalization", "3-Production & Delivery"
  return REGION_PREFIX.test(n)
    || /^\d{2,4}[A-Z]?(?:\b|[\s,_-])/i.test(n)                    // "409-…", "13P", "1150 Marysville"
    || /^[A-Z]{1,3}\s?-?\s?\d{1,4}[A-Z]?(?:\b|[\s,_-])/i.test(n);  // "EX-5 NACS…", "P-12R"
}

const words = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Parts of the project name after the code: "STNW 395 - Stuart,1120 S Division St, IA" → city Stuart, state IA. */
export function placeOf(name: string | null): { city: string | null; state: string | null } {
  const rest = String(name ?? '').split(/\s[-–]\s/).slice(1).join(' - ');
  if (!rest) return { city: null, state: null };
  const parts = rest.split(',').map(s => s.trim()).filter(Boolean);
  const city = parts[0]?.replace(/\d.*$/, '').trim() || null;
  const st = parts.at(-1)?.match(/\b([A-Z]{2})\b\s*$/);
  return { city: city && city.length > 2 ? city : null, state: st ? st[1] : null };
}

/** The client folder in the project's stored path ("…/Clients/Brew Oil/STNW 395 …" → "Brew Oil"). */
export function clientOf(path: string | null): string | null {
  const segs = String(path ?? '').split('/').filter(Boolean);
  if (segs.length < 3) return null;
  const parent = segs.at(-2)!;
  return /^(clients|individuals|individiuals)$/i.test(parent) ? null : parent;
}


export function scoreFolder(p: MatchProject, f: FolderRow): Candidate | null {
  const key = liveKey(p.code);
  if (!key) return null;
  const fk = folderKey(f.name);
  const reasons: string[] = [];
  let score = 0;

  const exact = fk === key || fk.startsWith(key + ' ') || fk.startsWith(key + ',');
  const no = key.match(/\d+/)?.[0];
  const firstNo = fk.match(/^(?:[A-Z]{1,3} )?(\d{1,4})(?![0-9])/)?.[1];
  if (exact) { score += 60; reasons.push(`name starts with ${key}`); }
  else if (no && firstNo === no) {
    score += 35; reasons.push(`number ${no}`);
    // "408 MARKET" vs a folder "408 EXPRESS": same number, other suffix → the other project.
    const suffix = key.slice(key.indexOf(no) + no.length).trim();
    if (suffix && !fk.includes(suffix)) { score -= 25; reasons.push(`no "${suffix}" in name`); }
    else if (suffix) { score += 20; reasons.push(`"${suffix}" in name`); }
  } else return null;

  const lower = f.path_lower;
  const client = clientOf(p.dropbox_root_path);
  if (client && words(lower).includes(words(client))) { score += 15; reasons.push(`client ${client}`); }
  const { city, state } = placeOf(p.name);
  if (city && words(f.name).includes(words(city))) { score += 10; reasons.push(`city ${city}`); }
  if (state && new RegExp(`\\b${state}\\b`).test(f.name.toUpperCase())) { score += 5; reasons.push(`state ${state}`); }
  const region = dropboxRegionFolder(p.region).toLowerCase();           // "t lines ne projects"
  if (region && lower.includes(`/${region}/`)) { score += 10; reasons.push(`region ${dropboxRegionFolder(p.region)}`); }
  const section = dropboxSectionForServiceLine(p.service_line).toLowerCase(); // "1-store maker"
  if (section && lower.includes(`/${section}/`)) { score += 5; reasons.push(dropboxSectionForServiceLine(p.service_line)); }
  const finished = p.current_stage === 'delivered';
  if (/\/done\//.test(lower) && !finished) { score -= 10; reasons.push('under Done, project still open'); }
  if (/\/under working\//.test(lower) && !finished) { score += 5; reasons.push('Under Working'); }

  return { path: f.path_display, score, reasons };
}

/**
 * linked    — the stored path is a scanned folder (still right)
 * sure      — one clear winner: score ≥ 70 and 20+ ahead of the next
 * ambiguous — candidates, but no clear winner
 * none      — no folder carries the project's number
 */
export function matchProject(p: MatchProject, folders: FolderRow[], existing: Set<string>): MatchResult {
  const candidates = folders
    .map(f => scoreFolder(p, f))
    .filter((c): c is Candidate => !!c)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  if (p.dropbox_root_path && existing.has(p.dropbox_root_path.toLowerCase().replace(/\/+$/, ''))) {
    return { status: 'linked', candidates };
  }
  if (!candidates.length) return { status: 'none', candidates };
  const [top, second] = candidates;
  if (top.score >= 70 && (!second || top.score - second.score >= 20)) return { status: 'sure', candidates };
  return { status: 'ambiguous', candidates };
}
