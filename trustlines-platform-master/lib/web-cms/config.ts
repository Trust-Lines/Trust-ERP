// Website CMS ("Store Maker" public site, sm.tlines.us). The ERP writes; the site only reads.
// Site-side contract: supabase/web_*.sql tables + POST <site>/api/revalidate.

export const WEBSITE_URL = (process.env.WEBSITE_URL || 'https://sm.tlines.us').replace(/\/+$/, '');

// Every ERP-managed image lives under this ImageKit folder. Existing folders (the old site's
// images) are never written to — the browser only lists them, read-only.
export const IK_ROOT = '/store-maker';

// The site's next.config only allows this host.
export const IK_ALLOWED_HOST = 'ik.imagekit.io';

export const PROJECT_CATEGORIES = [
  { value: 'c-store', label: 'C-Store' },
  { value: 'truck-stops', label: 'Truck Stops' },
  { value: 'grocery', label: 'Grocery' },
] as const;

export const SETTINGS_KEYS = ['projects_page'] as const;
export type SettingsKey = (typeof SETTINGS_KEYS)[number];

export interface ProjectsPageSettings {
  eyebrow: string;
  heading: string;
  description: string;
  hero_image_url: string;
  hero_image_alt: string;
}

export const PROJECTS_PAGE_DEFAULTS: ProjectsPageSettings = {
  eyebrow: 'Tlines Gallery',
  heading: 'Projects',
  description: '',
  hero_image_url: '',
  hero_image_alt: '',
};

export function isImageKitUrl(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.hostname === IK_ALLOWED_HOST;
  } catch {
    return false;
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ImageKit on-the-fly resize for previews inside the ERP.
export function thumb(url: string, width = 480): string {
  if (!url) return url;
  return url.includes('?') ? `${url}&tr=w-${width}` : `${url}?tr=w-${width}`;
}
