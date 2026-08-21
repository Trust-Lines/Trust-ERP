export const PROJECT_TYPES = [
  'New Construction',
  'Small Remodel',
  'Full Remodel',
  'BID',
  'ITEMS',
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const LEAD_SOURCES = [
  'Referral', 'Website', 'Walk-in', 'Cold outreach', 'Existing client', 'ClickUp', 'Other',
] as const;
