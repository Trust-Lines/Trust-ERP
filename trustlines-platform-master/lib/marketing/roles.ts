
export const MARKETING_ROLES = ['marketing_pr', 'marketing_manager'];

export const MARKETING_MANAGE_ROLES = ['marketing_manager', 'general_manager', 'ops_manager'];

export const MARKETING_SEE_ALL_ROLES = ['marketing_manager', 'general_manager', 'ops_manager'];

export const MARKETING_READ_ROLES = ['marketing_pr', 'marketing_manager', 'general_manager', 'ops_manager'];

export const MARKETING_WRITE_ROLES = ['marketing_pr', 'marketing_manager', 'general_manager', 'ops_manager'];

/** Sales-side roles. They READ Contacts (Sales → Contacts) and work the Store Maker website inbox;
 *  editing Contacts stays with MARKETING_WRITE_ROLES. */
export const SALES_CONTACT_ROLES = ['sales_rep', 'sales_marketing_manager'];

/** Read-only Contacts access: Marketing + Sales. Used on the GET routes Contact Manager calls. */
export const CONTACTS_READ_ROLES = [...MARKETING_READ_ROLES, ...SALES_CONTACT_ROLES];

/** Store Maker website submissions (web_leads): Marketing + Sales can triage and convert them. */
export const WEB_LEADS_ROLES = [...MARKETING_WRITE_ROLES, ...SALES_CONTACT_ROLES];
