
/* eslint-disable @typescript-eslint/no-explicit-any */

export function normalizeOrgName(s: string | null | undefined): string | null {
  if (!s) return null;
  const v = s.toLowerCase().trim().replace(/\s+/g, ' ');
  return v.length ? v : null;
}
export const normalizePersonName = normalizeOrgName;

export function normalizeWebsiteDomain(s: string | null | undefined): string | null {
  if (!s) return null;
  let v = s.toLowerCase().trim();
  if (!v) return null;
  v = v.replace(/^https?:\/\//, '').replace(/^www\./, '');
  v = v.split('/')[0].split('?')[0];
  return v.length ? v : null;
}

export function normalizeEmail(s: string | null | undefined): string | null {
  if (!s) return null;
  const v = s.toLowerCase().trim();
  return v.length ? v : null;
}

export function normalizePhone(s: string | null | undefined): string | null {
  if (!s) return null;
  const v = s.replace(/\D/g, '');
  return v.length ? v : null;
}

export interface DuplicateInput {
  organizationName?: string | null;
  personName?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface DuplicateSuggestion {
  id: string;
  display_name: string;
  matchedOn: ('organization_name' | 'person_name' | 'website' | 'email' | 'phone')[];
}

export async function findProspectDuplicates(
  admin: any,
  input: DuplicateInput,
  excludeId?: string,
): Promise<DuplicateSuggestion[]> {
  const orgName = normalizeOrgName(input.organizationName);
  const personName = normalizePersonName(input.personName);
  const domain = normalizeWebsiteDomain(input.website);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!orgName && !personName && !domain && !email && !phone) return [];

  const { data } = await admin.from('prospects')
    .select('id, display_name, organization_name, person_name, website, main_email, main_phone')
    .is('deleted_at', null)
    .limit(500) as {
      data: { id: string; display_name: string; organization_name: string | null; person_name: string | null; website: string | null; main_email: string | null; main_phone: string | null }[] | null;
    };

  const found = new Map<string, DuplicateSuggestion>();
  for (const row of data ?? []) {
    if (excludeId && row.id === excludeId) continue;
    const matchedOn: DuplicateSuggestion['matchedOn'] = [];
    if (orgName && row.organization_name && normalizeOrgName(row.organization_name) === orgName) matchedOn.push('organization_name');
    if (personName && row.person_name && normalizePersonName(row.person_name) === personName) matchedOn.push('person_name');
    if (domain && normalizeWebsiteDomain(row.website) === domain) matchedOn.push('website');
    if (email && normalizeEmail(row.main_email) === email) matchedOn.push('email');
    if (phone && normalizePhone(row.main_phone) === phone) matchedOn.push('phone');
    if (matchedOn.length) found.set(row.id, { id: row.id, display_name: row.display_name, matchedOn });
  }
  return [...found.values()];
}
