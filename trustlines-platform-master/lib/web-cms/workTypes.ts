import { slugify } from './config';

export interface WorkTypeRow {
  id: string;
  slug: string;
  label: string;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Slug is generated once from the label and never changes afterwards (projects store it).
export function workTypeSlug(label: string): string {
  return slugify(label).slice(0, 60);
}

// Icon the website ships for the six default slugs (cream on transparent). The ERP shows it in
// previews when a type has no uploaded icon of its own.
export function builtInIconUrl(siteUrl: string, slug: string): string {
  return `${siteUrl}/images/projects/work-types/${slug}.svg`;
}

// Checks a project's selected slugs against the table. A slug must exist; an INACTIVE one is only
// allowed if the project already had it (editing an old project must not fail because a type was
// retired later).
export async function checkWorkTypes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any, slugs: string[], alreadyOnProject: string[] = [],
): Promise<string | null> {
  if (!slugs.length) return null;
  const { data, error } = await admin.from('web_work_types').select('slug, is_active').in('slug', slugs);
  if (error) return error.message;
  const known = new Map<string, boolean>((data ?? []).map((r: { slug: string; is_active: boolean }) => [r.slug, r.is_active]));
  for (const s of slugs) {
    if (!known.has(s)) return `Unknown type of work: ${s}`;
    if (!known.get(s) && !alreadyOnProject.includes(s)) return `"${s}" is no longer active`;
  }
  return null;
}

export function parseWorkTypeSlugs(raw: unknown): { error: string } | { slugs: string[] | undefined } {
  if (raw === undefined) return { slugs: undefined };
  if (!Array.isArray(raw)) return { error: 'workTypes must be a list' };
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== 'string' || !SLUG_RE.test(x)) return { error: 'workTypes contains an invalid slug' };
    if (!out.includes(x)) out.push(x);
  }
  if (out.length > 30) return { error: 'Too many types of work selected' };
  return { slugs: out };
}
