
export interface CompletenessInput {
  organizationName: string | null;
  personName: string | null;
  mainEmail: string | null;
  mainPhone: string | null;
  website: string | null;
  sourceLabel: string | null;
  sourceRawLabel?: string | null;
  sourceDetail?: string | null;
  businessTypes: string[];
  showsAttended?: string[];
  primaryContact: {
    title: string | null; linkedinUrl: string | null; otherContact: string | null;
    company2Phone?: string | null; whatsapp?: boolean;
  } | null;
  location: { state: string | null; address?: string | null; mailingAddress?: string | null } | null;
  xNote?: string | null;
}

export interface CompletenessCheck { key: string; label: string; done: boolean }
export interface CompletenessResult { percent: number; checks: CompletenessCheck[]; filledCount: number; totalCount: number }

export function computeProspectCompleteness(input: CompletenessInput): CompletenessResult {
  const checks: CompletenessCheck[] = [
    { key: 'state', label: 'State', done: !!input.location?.state },
    { key: 'phone', label: 'Phone', done: !!input.mainPhone },
    { key: 'email', label: 'Email', done: !!input.mainEmail },
    { key: 'role', label: 'Role/Position', done: !!input.primaryContact?.title },
    { key: 'linkedin', label: 'LinkedIn', done: !!input.primaryContact?.linkedinUrl },
    { key: 'company', label: 'Company', done: !!input.organizationName || !!input.personName },
    { key: 'other_contact', label: 'Other contact', done: !!input.primaryContact?.otherContact },
    { key: 'business_type', label: 'Business type', done: input.businessTypes.length > 0 },
    { key: 'website', label: 'Website', done: !!input.website },
    { key: 'source', label: 'Reference', done: !!input.sourceLabel || !!input.sourceRawLabel },
  ];
  const filledCount = checks.filter(c => c.done).length;
  const totalCount = checks.length;
  return { percent: Math.round((filledCount / totalCount) * 100), checks, filledCount, totalCount };
}
