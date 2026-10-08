/* eslint-disable @typescript-eslint/no-explicit-any */

// The T-Lines people who take the NACS survey at the booth. The survey asks "who is entering
// this?" with a dropdown (not free text, so names are never mistyped) and the choice becomes the
// "Created by" cell on the Contact's profile.
export const SURVEY_REPRESENTATIVES = ['Layal', 'Justin', 'T', 'Naim', 'Merve', 'Hashem'] as const;

// Canonical spelling for a submitted value, or undefined if it isn't one of the known people.
export function normalizeRepresentative(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().toLowerCase();
  return SURVEY_REPRESENTATIVES.find(r => r.toLowerCase() === v);
}

// `prospects.created_by_label` is added by migration 124. Until it is applied in a given database
// the column does not exist, and none of the helpers below may take the survey (or a profile page)
// down with it — they swallow that error and behave as "no label".
export async function setCreatedByLabelIfEmpty(admin: any, prospectId: string, label?: string): Promise<void> {
  if (!label) return;
  const { error } = await admin.from('prospects')
    .update({ created_by_label: label }).eq('id', prospectId).is('created_by_label', null);
  if (error) console.error('[created_by_label] not saved (migration 124 applied?):', error.message);
}

export async function fetchCreatedByLabel(admin: any, prospectId: string): Promise<string | null> {
  const { data, error } = await admin.from('prospects').select('created_by_label').eq('id', prospectId).maybeSingle();
  if (error) return null;
  return (data?.created_by_label as string | null | undefined) ?? null;
}
