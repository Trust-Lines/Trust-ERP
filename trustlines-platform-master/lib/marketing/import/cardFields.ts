// Readers for the "card" fields a spreadsheet can carry beyond name/e-mail/phone: WhatsApp tick,
// Status, project type, timing. Pure and forgiving — anything that is not clearly one of the
// CRM's own values is dropped (the original text is still kept in the Activity note).

/** "Yes", "TRUE", "✓", "x", "1" → true; "No", "false", "0" → false; blank/other → null (unknown). */
export function parseYesNo(value: unknown): boolean | null {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return null;
  if (['yes', 'y', 'true', '1', 'x', '✓', '✔', 'evet', 'var', 'on'].includes(v)) return true;
  if (['no', 'n', 'false', '0', 'hayir', 'hayır', 'yok', 'off', '-'].includes(v)) return false;
  return null;
}

const STATUS_BY_WORD: Record<string, string> = {
  captured: 'captured', lead: 'captured', new: 'captured',
  enrichment: 'enrichment',
  potential: 'potential', nurture: 'nurture',
  opportunity: 'opportunity_candidate', opportunity_candidate: 'opportunity_candidate',
  qualified: 'qualified_for_sales', qualified_for_sales: 'qualified_for_sales',
  converted: 'converted', won: 'converted',
  disqualified: 'disqualified', lost: 'disqualified',
  archived: 'archived',
};

/** A value for `prospects.status` (the CHECK-constrained list), or null when the text is not one of them. */
export function parseStatus(value: unknown): string | null {
  const v = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return STATUS_BY_WORD[v] ?? null;
}

/** Project types (full_remodel / small_remodel / new_construction) mentioned in free text. */
export function parseProjectTypes(value: unknown): string[] {
  const v = String(value ?? '').toLowerCase();
  if (!v.trim()) return [];
  const out = new Set<string>();
  if (/new (store|build|construction)|ground[\s-]?up|new construction|new location|new branch/.test(v)) out.add('new_construction');
  if (/full remodel|complete remodel|gut|total remodel/.test(v)) out.add('full_remodel');
  else if (/remodel|renovat|refresh|upgrade|retrofit|re-?image/.test(v)) out.add('small_remodel');
  return [...out];
}

/** Timing buckets used by the CRM; null when the text is not clearly one of them. */
export function parseTiming(value: unknown): string | null {
  const v = String(value ?? '').toLowerCase().trim();
  if (!v) return null;
  if (/asap|immediate|now|urgent/.test(v)) return 'immediate';
  if (/0\s*[-–to]+\s*3|next 3|3 months or less|within 3/.test(v)) return '0_3_months';
  if (/3\s*[-–to]+\s*6/.test(v)) return '3_6_months';
  if (/6\s*[-–to]+\s*12/.test(v)) return '6_12_months';
  if (/12\+|12 plus|over a year|next year|still planning/.test(v)) return '12_plus_months';
  if (/no current|not right now|none/.test(v)) return 'no_current_project';
  if (/later|follow up later/.test(v)) return 'contact_later';
  return null;
}
