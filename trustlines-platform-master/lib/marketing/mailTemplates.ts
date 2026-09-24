import { regionLabel } from '@/lib/regions';

// Minimal shape a template can merge against — a subset of ProspectRow's fields, whatever the
// caller has on hand (the Contacts export/bulk-send routes select exactly these columns).
export interface MergeContact {
  display_name: string;
  organization_name?: string | null;
  person_name?: string | null;
  brand_name?: string | null;
  industry?: string | null;
  region?: string | null;
  state?: string | null;
  source_label?: string | null;
  main_email?: string | null;
}

// The whitelist of {{tokens}} a template body/subject can use — shown as a reference in the
// template editor and the only thing renderTemplate() substitutes (an unknown {{token}} is
// left as literal text rather than silently dropped, so a typo is visible, not swallowed).
export const MERGE_FIELDS: { token: string; label: string; sample: string }[] = [
  { token: 'name', label: 'Contact / company name', sample: 'Acme Retail' },
  { token: 'first_name', label: 'First word of the name', sample: 'Acme' },
  { token: 'company', label: 'Company (falls back to name)', sample: 'Acme Retail' },
  { token: 'industry', label: 'Industry', sample: 'Retail' },
  { token: 'region', label: 'T-Lines region', sample: 'T-Lines North East' },
  { token: 'state', label: 'State', sample: 'GA' },
  { token: 'source', label: 'Source', sample: 'Trade Fair' },
  { token: 'email', label: 'Email address', sample: 'contact@example.com' },
];

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function mergeValues(c: MergeContact): Record<string, string> {
  const company = c.organization_name || c.brand_name || c.display_name;
  return {
    name: c.display_name ?? '',
    first_name: c.person_name ? firstName(c.person_name) : firstName(c.display_name ?? ''),
    company: company ?? '',
    industry: c.industry ?? '',
    region: c.region ? regionLabel(c.region) : '',
    state: c.state ?? '',
    source: c.source_label ?? '',
    email: c.main_email ?? '',
  };
}

// {{token}} only — no logic/loops. Unknown tokens are left as-is (visible typo beats a
// silently blank sentence in someone's inbox).
export function renderTemplate(text: string, contact: MergeContact): string {
  const values = mergeValues(contact);
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, token: string) => {
    const key = token.toLowerCase();
    return key in values ? values[key] : whole;
  });
}
