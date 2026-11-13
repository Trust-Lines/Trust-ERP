/**
 * The name a board card shows, from its Sales deal (Opportunity / Potential):
 *
 *   1. the deal's Brand, when it is filled ("VIC", "Next Stop");
 *   2. else the lead's customer name (prospect organization, then display name);
 *   3. else the card's own name (Trust System / project name).
 *
 * A card finds its deal by project number AND address: one number can carry several deals
 * (e.g. #311 had one in Marietta and one in Locust), so the number alone is not enough.
 * A project linked to a deal (opportunities.project_id) uses that deal directly.
 */

export interface DealName {
  kind: 'opportunity' | 'potential';
  id: string;
  projectNo: string | null;
  projectId: string | null;
  /** The deal's title — its site / address ("Tempe, 475 W Guadalupe Rd"). */
  address: string | null;
  brand: string | null;
  customer: string | null;
}

const STOP = new Set(('rd road st street ave avenue blvd hwy highway dr drive ln lane pkwy parkway suite ste '
  + 'usa the and unit way ct court pl place north south east west us').split(' '));

/** Address words that tell two places apart: street numbers and real words, no state codes / "Rd". */
function addressTokens(s: string | null | undefined): string[] {
  return (s ?? '').toLowerCase().split(/[^a-z0-9]+/)
    .filter(t => t && !STOP.has(t) && (/^\d{3,}$/.test(t) || (/^[a-z]/.test(t) && t.length >= 4)));
}

/** Same place: the two addresses share a street number or a place word ("Tempe", "Locust"). */
export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  const A = new Set(addressTokens(a));
  return A.size > 0 && addressTokens(b).some(t => A.has(t));
}

const EMPTY = /^(n\/?a|-+|none|null)$/i;
const clean = (s: string | null | undefined) => {
  const v = (s ?? '').trim();
  return v && !EMPTY.test(v) ? v : null;
};

/** Brand, else customer name (unless it is just the address again), else null. */
export function dealName(d: DealName): string | null {
  const brand = clean(d.brand);
  if (brand) return brand;
  const customer = clean(d.customer);
  if (customer && customer.toLowerCase() !== (d.address ?? '').trim().toLowerCase()) return customer;
  return null;
}

export function buildDealNames(deals: DealName[], numberOf: (code: string | null) => string | null = n => n) {
  const byNo = new Map<string, DealName[]>();
  const byProject = new Map<string, DealName>();
  const byDeal = new Map<string, DealName>();
  for (const d of deals) {
    byDeal.set(`${d.kind}:${d.id}`, d);
    const no = numberOf(d.projectNo);
    if (no) byNo.set(no, [...(byNo.get(no) ?? []), d]);
    if (d.projectId && !byProject.has(d.projectId)) byProject.set(d.projectId, d);
  }
  /** The name for a card with this project number and address (and our project id, if any). */
  const forCard = (projectNo: string | null, address: string | null, projectId?: string | null): string | null => {
    const linked = projectId ? byProject.get(projectId) : undefined;
    if (linked) return dealName(linked);
    const hit = projectNo ? (byNo.get(projectNo) ?? []).find(d => sameAddress(address, d.address)) : undefined;
    return hit ? dealName(hit) : null;
  };
  /** The name for a deal's own card (Clients Opportunity). */
  const forDeal = (kind: string, id: string): string | null => {
    const d = byDeal.get(`${kind}:${id}`);
    return d ? dealName(d) : null;
  };
  return { forCard, forDeal };
}
