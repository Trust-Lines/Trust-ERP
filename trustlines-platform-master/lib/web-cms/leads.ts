export const LEAD_STATUSES = ['new', 'contacted', 'converted', 'spam', 'archived'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New', contacted: 'Contacted', converted: 'Converted', spam: 'Spam', archived: 'Archived',
};

export interface WebLeadInput {
  kind: 'contact' | 'newsletter';
  name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  store_location: string | null;
  store_condition: string | null;
  store_type: string | null;
  message: string | null;
  consent_accepted: boolean;
  consent_text_version: string | null;
  source_page: string | null;
  utm: Record<string, string> | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Cap every text field: this endpoint is public, so nothing unbounded goes into the table.
function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, max);
  return t || null;
}
const bool = (v: unknown) => v === true || v === 'true' || v === 'on' || v === 1 || v === '1';

// Accepts the website form's own field names (camelCase or snake_case) so the site can post
// what it already collects: name, phone, email, company, store location, store condition,
// store type, privacy consent.
export function parseWebLeadBody(raw: unknown): { error: string; code: string } | { lead: WebLeadInput; honeypot: boolean } {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = (...keys: string[]) => { for (const k of keys) if (b[k] !== undefined) return b[k]; return undefined; };

  const kind = pick('kind', 'type') === 'newsletter' ? 'newsletter' : 'contact';
  const honeypot = typeof b.honeypot === 'string' && b.honeypot.trim().length > 0;

  const email = text(pick('email'), 200);
  if (email && !EMAIL_RE.test(email)) return { error: 'Please enter a valid email address.', code: 'invalid_email' };
  if (!bool(pick('consentAccepted', 'consent_accepted', 'consent', 'privacy'))) {
    return { error: 'Please accept the privacy notice to submit.', code: 'consent_required' };
  }

  const name = text(pick('name', 'fullName', 'full_name'), 200);
  const phone = text(pick('phone'), 60);
  if (kind === 'newsletter') {
    if (!email) return { error: 'Email is required.', code: 'email_required' };
  } else if (!name || (!email && !phone)) {
    return { error: 'Name and an email or phone number are required.', code: 'validation_error' };
  }

  const rawUtm = pick('utm');
  let utm: Record<string, string> | null = null;
  if (rawUtm && typeof rawUtm === 'object') {
    utm = {};
    for (const [k, v] of Object.entries(rawUtm as Record<string, unknown>).slice(0, 10)) {
      const val = text(v, 200);
      if (val && /^[a-z_]{1,40}$/i.test(k)) utm[k] = val;
    }
    if (!Object.keys(utm).length) utm = null;
  }

  return {
    honeypot,
    lead: {
      kind, name, phone, email,
      company: text(pick('company', 'organization'), 200),
      store_location: text(pick('storeLocation', 'store_location', 'location'), 300),
      store_condition: text(pick('storeCondition', 'store_condition', 'condition'), 60),
      store_type: text(pick('storeType', 'store_type'), 60),
      message: text(pick('message', 'notes'), 3000),
      consent_accepted: true,
      consent_text_version: text(pick('consentTextVersion', 'consent_text_version'), 40),
      source_page: text(pick('sourcePage', 'source_page', 'page'), 300),
      utm,
    },
  };
}
