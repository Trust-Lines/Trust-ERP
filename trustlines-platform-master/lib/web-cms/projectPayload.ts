import { PROJECT_CATEGORIES, isImageKitUrl, slugify } from './config';

export interface ProjectInput {
  title: string;
  slug: string;
  category: string;
  location: string;
  project_type: string | null;
  year_built: number | null;
  cover_image_url: string;
  cover_image_alt: string | null;
  is_published: boolean;
  sort_order: number;
}
export interface PhotoInput { image_url: string; alt: string | null }
export interface SectionInput { heading: string | null; body: string | null; image_url: string | null; image_alt: string | null }

export const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
export const orNull = (v: unknown) => str(v) || null;

// Returns a cleaned payload or { error }. Everything the site renders is checked here, because
// the ERP is the only writer and the site trusts what is in the tables.
export function parseProjectPayload(raw: unknown):
  | { error: string }
  | { project: ProjectInput; photos: PhotoInput[]; sections: SectionInput[] } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const p = (b.project ?? {}) as Record<string, unknown>;

  const title = str(p.title);
  if (!title) return { error: 'Title is required' };
  const slug = slugify(str(p.slug) || title);
  if (!slug) return { error: 'Slug is required' };
  const category = str(p.category);
  if (!PROJECT_CATEGORIES.some(c => c.value === category)) return { error: 'Pick a category' };
  const location = str(p.location);
  if (!location) return { error: 'Location is required' };
  const cover = str(p.cover_image_url);
  if (!isImageKitUrl(cover)) return { error: 'Cover image is required (ImageKit URL)' };

  let year: number | null = null;
  if (p.year_built !== null && p.year_built !== undefined && p.year_built !== '') {
    year = Number(p.year_built);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) return { error: 'Year must be between 1900 and 2100' };
  }
  const sort = Number(p.sort_order ?? 0);
  if (!Number.isInteger(sort)) return { error: 'Sort order must be a whole number' };

  const photos: PhotoInput[] = [];
  for (const x of Array.isArray(b.photos) ? b.photos : []) {
    const r = x as Record<string, unknown>;
    if (!isImageKitUrl(str(r.image_url))) return { error: 'A gallery photo has an invalid image URL' };
    photos.push({ image_url: str(r.image_url), alt: orNull(r.alt) });
  }

  const parsedSections = parseSections(b.sections);
  if ('error' in parsedSections) return parsedSections;
  const sections = parsedSections.sections;

  return {
    project: {
      title, slug, category, location,
      project_type: orNull(p.project_type), year_built: year,
      cover_image_url: cover, cover_image_alt: orNull(p.cover_image_alt),
      is_published: p.is_published === true, sort_order: sort,
    },
    photos, sections,
  };
}

// Body blocks, shared by projects and blog posts. Empty blocks are dropped.
export function parseSections(raw: unknown): { error: string } | { sections: SectionInput[] } {
  const sections: SectionInput[] = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    const r = x as Record<string, unknown>;
    const image = str(r.image_url);
    if (image && !isImageKitUrl(image)) return { error: 'A section has an invalid image URL' };
    const sec: SectionInput = { heading: orNull(r.heading), body: orNull(r.body), image_url: image || null, image_alt: orNull(r.image_alt) };
    if (!sec.heading && !sec.body && !sec.image_url) continue;
    sections.push(sec);
  }
  return { sections };
}
