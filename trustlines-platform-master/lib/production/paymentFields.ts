// Payments page writes: the fields the accounting sheet may change on a production row, and their
// validation. Browser-safe (the cells use the same names). Payments 1 / 2 write Paid 1 / 2.
export const PAY_MONEY_FIELDS = ['paid_usd1', 'paid_usd2', 'paid_tl1', 'paid_tl2'] as const;
export const PAY_DATE_FIELDS = ['paid_usd1_date', 'paid_usd2_date', 'paid_tl1_date', 'paid_tl2_date', 'invoice_date'] as const;
export const PAY_TEXT_FIELDS = ['invoice_transaction_no', 'invoice_number'] as const;
export type PayField = typeof PAY_MONEY_FIELDS[number] | typeof PAY_DATE_FIELDS[number] | typeof PAY_TEXT_FIELDS[number] | 'quick_book';

const MONEY = new Set<string>(PAY_MONEY_FIELDS);
const DATES = new Set<string>(PAY_DATE_FIELDS);
const TEXTS = new Set<string>(PAY_TEXT_FIELDS);
const MAX_MONEY = 9_999_999_999.99; // numeric(12,2) holds up to 10 digits before the point

/** The update to write, or an error message. Unknown keys are refused, not ignored. */
export function cleanPaymentPatch(body: Record<string, unknown>): { update: Record<string, string | number | null> } | { error: string } {
  const update: Record<string, string | number | null> = {};
  const keys = Object.keys(body);
  if (!keys.length) return { error: 'Nothing to save' };
  for (const k of keys) {
    const v = body[k];
    if (MONEY.has(k)) {
      // 0 is a real payment of 0, kept apart from "not entered" (null).
      if (v === null || v === '') { update[k] = null; continue; }
      const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
      if (!Number.isFinite(n) || n < 0 || n > MAX_MONEY) return { error: `${k}: enter an amount between 0 and ${MAX_MONEY}` };
      update[k] = Math.round(n * 100) / 100;
    } else if (DATES.has(k)) {
      if (v === null || v === '') { update[k] = null; continue; }
      const d = String(v).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) return { error: `${k}: enter a date (yyyy-mm-dd)` };
      update[k] = d;
    } else if (TEXTS.has(k)) {
      const t = v == null ? '' : String(v).trim();
      if (t.length > 120) return { error: `${k}: 120 characters at most` };
      update[k] = t || null;
    } else if (k === 'quick_book') {
      // A toggle: "Done" or nothing.
      if (v !== null && v !== '' && v !== 'Done') return { error: 'quick_book: "Done" or empty' };
      update[k] = v === 'Done' ? 'Done' : null;
    } else {
      return { error: `${k} cannot be changed here` };
    }
  }
  return { update };
}
