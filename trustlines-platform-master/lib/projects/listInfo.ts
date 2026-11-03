// Projects list (app/(platform)/projects): what a row shows that the project row itself often
// doesn't carry — the client's brand, the site address, and the Trust System's view of it (stage,
// per-type production status, ETD). Read-only; nothing here is written back. Browser-safe.
import { classifyTrustProject, typeLabel, type TrustProject, type TrustStage } from '@/lib/trust/board';

export const TRUST_STAGE_LABEL: Record<TrustStage, string> = {
  finalization: 'Finalization',
  technical: 'Technical / PO + PF',
  to_production: 'To Production',
  in_production: 'In Production',
  shipped: 'Shipped',
};
export const TRUST_STAGE_ORDER: TrustStage[] = ['finalization', 'technical', 'to_production', 'in_production', 'shipped'];

/** The brand folder a project's Dropbox folder sits in: ".../Clients/<Brand>/<code - address>". */
export function brandFromDropboxPath(path: string | null | undefined): string | null {
  const parts = String(path ?? '').split('/').filter(Boolean);
  const i = parts.findIndex(p => /^clients?$/i.test(p));
  return i >= 0 && i + 2 < parts.length ? parts[i + 1] : null;
}

/** "STSE 500 - Cumming, 1620 Buford Dam Rd, GA" → "Cumming, 1620 Buford Dam Rd, GA". */
export function addressFromName(name: string, code: string | null): string {
  const rest = code && name.startsWith(code) ? name.slice(code.length) : name;
  return rest.replace(/^\s*[-–—]\s*/, '').trim() || name;
}

export interface TrustRowInfo {
  stage: TrustStage;
  /** One per type: "Millwork" + its production status ("Sent", "Ordered"). */
  types: { type: string; status: string | null }[];
  onHold: boolean;
  /** Latest estimated departure of its types (yyyy-mm-dd), else the container date once shipped. */
  etd: string | null;
}

type ItemDates = { etd?: string | null; containerDate?: string | null };

export function trustRowInfo(p: TrustProject, today: string): TrustRowInfo {
  const e = classifyTrustProject(p, today);
  const byType = new Map<string, string | null>();
  for (const i of p.items ?? []) {
    const t = typeLabel(i.type);
    if (!t) continue;
    const s = typeLabel(i.status);
    // A type in several states keeps the least advanced one — what still needs work.
    if (!byType.has(t) || (s && !byType.get(t))) byType.set(t, s ? s.charAt(0) + s.slice(1).toLowerCase() : null);
  }
  const dates = (p.items ?? []).flatMap(i => [(i as ItemDates).etd, e.stage === 'shipped' ? i.containerDate : null])
    .map(d => (d && d.slice(0, 4) >= '2000' ? d.slice(0, 10) : null)).filter((d): d is string => !!d).sort();
  return { stage: e.stage, types: [...byType].map(([type, status]) => ({ type, status })), onHold: e.onHold, etd: dates.at(-1) ?? null };
}
