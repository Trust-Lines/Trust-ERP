// Estimates and contracts (migration 131) — the Sales steps between Design and Closed Deal.
// Pure and browser-safe: totals, validation, the default contract text (numbers, tokens and
// hashes live in documentTokens.ts, server-only). Tested in tests/salesDocuments.test.ts.

export const CURRENCIES = ['USD', 'EUR', 'TRY', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface LineItem { description: string; quantity: number; unit: string | null; unit_price: number }

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Subtotal of the lines, then the discount, then tax on the discounted amount. */
export function estimateTotals(items: LineItem[], discountPct: number, taxPct: number) {
  const subtotal = round2(items.reduce((s, i) => s + i.quantity * i.unit_price, 0));
  const discount = round2(subtotal * discountPct / 100);
  const taxable = round2(subtotal - discount);
  const tax = round2(taxable * taxPct / 100);
  return { subtotal, discount, tax, total: round2(taxable + tax) };
}

export const lineTotal = (i: LineItem) => round2(i.quantity * i.unit_price);

type Result<T> = { value: T } | { error: string };
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);

export interface EstimateInput {
  title: string; currency: Currency; line_items: LineItem[]; discount_pct: number; tax_pct: number;
  notes: string | null; valid_until: string | null;
}

export function parseEstimate(raw: unknown): Result<EstimateInput> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const title = str(b.title).slice(0, 200);
  if (!title) return { error: 'Give the estimate a title' };
  const currency = (str(b.currency) || 'USD') as Currency;
  if (!CURRENCIES.includes(currency)) return { error: 'Pick a currency' };
  const rows = Array.isArray(b.line_items) ? b.line_items : [];
  const line_items: LineItem[] = [];
  for (const [i, r] of rows.entries()) {
    const x = (r ?? {}) as Record<string, unknown>;
    const description = str(x.description).slice(0, 500);
    const quantity = num(x.quantity);
    const unit_price = num(x.unit_price);
    if (!description && !quantity && !unit_price) continue; // an empty row
    if (!description) return { error: `Line ${i + 1}: add a description` };
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) return { error: `Line ${i + 1}: quantity must be more than 0` };
    if (!Number.isFinite(unit_price) || unit_price < 0 || unit_price > 1_000_000_000) return { error: `Line ${i + 1}: unit price must be 0 or more` };
    line_items.push({ description, quantity: round2(quantity), unit: str(x.unit).slice(0, 20) || null, unit_price: round2(unit_price) });
  }
  if (line_items.length > 200) return { error: 'At most 200 lines' };
  const pct = (v: unknown, label: string): Result<number> => {
    const n = v === undefined || v === null || v === '' ? 0 : num(v);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? { value: round2(n) } : { error: `${label} must be between 0 and 100 %` };
  };
  const d = pct(b.discount_pct, 'Discount');
  if ('error' in d) return d;
  const t = pct(b.tax_pct, 'Tax');
  if ('error' in t) return t;
  const valid = str(b.valid_until);
  if (valid && !/^\d{4}-\d{2}-\d{2}$/.test(valid)) return { error: 'Pick a valid “valid until” date' };
  return { value: { title, currency, line_items, discount_pct: d.value, tax_pct: t.value, notes: str(b.notes).slice(0, 5000) || null, valid_until: valid || null } };
}

const MONEY = (currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency });
export const formatMoney = (n: number, currency: string) => MONEY(currency).format(n);

/** A starting text for a contract made from an estimate — the salesperson edits it before sending. */
export function defaultContractTerms(p: { customer: string; title: string; estimateNumber: string; amount: number; currency: string; validUntil?: string | null }): string {
  return [
    `This agreement is between Trust-Lines Design & Supply ("Trust-Lines") and ${p.customer || '[Customer]'} ("the Customer").`,
    '',
    `1. Scope. Trust-Lines will design, supply and deliver the work described in estimate ${p.estimateNumber} — "${p.title}" — which forms part of this agreement.`,
    `2. Price. The total price is ${formatMoney(p.amount, p.currency)}, as itemised in the estimate.`,
    '3. Payment. [Deposit / milestone schedule — e.g. 50 % on signature, 40 % before shipment, 10 % on installation.]',
    '4. Timeline. Production starts once the deposit is received and the final drawings are approved by the Customer.',
    '5. Changes. Changes after approval are handled as change requests and may change the price and timeline.',
    '6. Delivery & installation. [Delivery terms, site readiness, installation responsibilities.]',
    '7. Warranty. [Warranty terms.]',
    '',
    'By signing, the Customer confirms they have read and agree to this agreement and the estimate it refers to.',
  ].join('\n');
}

