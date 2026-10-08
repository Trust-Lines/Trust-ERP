// Shared types for the "Import Excel" flow (browser + server).

/** What a spreadsheet column can mean. `ignore` = leave the column out. */
export type ImportField =
  | 'full_name' | 'first_name' | 'last_name' | 'title'
  | 'company' | 'email' | 'email2' | 'phone' | 'phone2' | 'website'
  | 'address' | 'city' | 'state' | 'zip' | 'city_state'
  | 'business_type' | 'notes' | 'captured_by' | 'captured_date'
  | 'ignore';

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  full_name: 'Person name',
  first_name: 'First name',
  last_name: 'Last name',
  title: 'Job title / position',
  company: 'Company',
  email: 'Email',
  email2: 'Email (alternate)',
  phone: 'Phone',
  phone2: 'Phone (alternate)',
  website: 'Website',
  address: 'Street address',
  city: 'City',
  state: 'State',
  zip: 'ZIP / postal code',
  city_state: 'City / State (combined)',
  business_type: 'Business type',
  notes: 'Notes (added to Activity)',
  captured_by: 'Captured / provided by',
  captured_date: 'Date captured / added (shown as "Created" on the card)',
  ignore: '— Ignore this column —',
};

export const IMPORT_FIELDS = Object.keys(IMPORT_FIELD_LABELS) as ImportField[];

/** One detected column: its header, how it was mapped and why. */
export interface ColumnMapping {
  index: number;
  header: string;
  field: ImportField;
  /** How sure the auto-detection is: 'header' (name matched), 'content' (values looked like it), 'none'. */
  basis: 'header' | 'content' | 'none';
  sample: string[];
  /** The user chose this by hand — "Add all other columns to Notes" must not change it. */
  locked?: boolean;
}

/** One person row, cleaned. */
export interface ImportPerson {
  /** Where it came from — "<file label> · row N". Several when duplicates were merged. */
  sources: string[];
  name: string | null;
  title: string | null;
  company: string | null;
  email: string | null;
  email2: string | null;
  phone: string | null;
  phone2: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  businessTypes: string[];
  /** Free-text lines that go to the Activity feed. */
  notes: string[];
  capturedBy: string | null;
  /** When the lead was captured (ISO) — becomes the Contact's "Created" date. */
  capturedAt: string | null;
}

/** One company (or a lone person) and the people found for it — becomes ONE Prospect. */
export interface ImportGroup {
  id: string;
  company: string | null;
  people: ImportPerson[];
  /** Rows that were folded into an earlier row of this group (same person seen twice). */
  mergedRows: number;
  /** Lines worth showing the user: "Shares phone 4783654936 with Rocky K", … */
  warnings: string[];
}

export type MatchStrength = 'strong' | 'possible';

export interface ExistingContactLite {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  otherContact: string | null;
  isPrimary: boolean;
}

/** A Prospect already in the CRM that looks like an import group. */
export interface ExistingMatch {
  prospectId: string;
  displayName: string;
  organizationName: string | null;
  personName: string | null;
  email: string | null;
  phone: string | null;
  businessTypes: string[];
  sourceLabel: string | null;
  /** When the Contact entered the CRM (ISO) — its original date if it was imported with one. */
  addedAt: string | null;
  website: string | null;
  strength: MatchStrength;
  /** Human-readable reasons, e.g. "Same email: x@y.com". */
  reasons: string[];
  contacts: ExistingContactLite[];
}

export type ImportAction = 'create' | 'merge' | 'skip';
