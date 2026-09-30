import { BLOG_CATEGORIES, isImageKitUrl, slugify } from './config';
import { orNull, parseSections, str, type SectionInput } from './projectPayload';

export interface PostInput {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  author: string;
  cover_image_url: string;
  cover_image_alt: string | null;
  published_at: string; // YYYY-MM-DD; a future date keeps the post hidden until then
  is_published: boolean;
}

export function parsePostPayload(raw: unknown):
  | { error: string }
  | { post: PostInput; sections: SectionInput[] } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const p = (b.post ?? {}) as Record<string, unknown>;

  const title = str(p.title);
  if (!title) return { error: 'Title is required' };
  const slug = slugify(str(p.slug) || title);
  if (!slug) return { error: 'Slug is required' };
  const category = str(p.category);
  if (!BLOG_CATEGORIES.some(c => c.value === category)) return { error: 'Pick a category' };
  const cover = str(p.cover_image_url);
  if (!isImageKitUrl(cover)) return { error: 'Cover image is required (ImageKit URL)' };
  const published_at = str(p.published_at);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(published_at) || Number.isNaN(Date.parse(published_at))) return { error: 'Pick a valid date' };

  const parsed = parseSections(b.sections);
  if ('error' in parsed) return parsed;

  return {
    post: {
      title, slug, excerpt: str(p.excerpt), category, author: str(p.author),
      cover_image_url: cover, cover_image_alt: orNull(p.cover_image_alt),
      published_at, is_published: p.is_published === true,
    },
    sections: parsed.sections,
  };
}
