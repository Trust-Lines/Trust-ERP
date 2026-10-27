import { describe, it, expect } from 'vitest';
import { parsePostPayload } from '@/lib/web-cms/postPayload';
import { parseProjectPayload } from '@/lib/web-cms/projectPayload';

const COVER = 'https://ik.imagekit.io/trustlines/blog/cover.jpg';

const post = (over: Record<string, unknown> = {}) => ({
  post: { title: 'Hello', category: 'industry-news', published_at: '2026-10-27', cover_image_url: '', is_published: false, ...over },
});
const project = (over: Record<string, unknown> = {}) => ({
  project: { title: 'Store', category: 'c-store', location: 'Dallas, TX', cover_image_url: '', is_published: false, ...over },
});

describe('web CMS cover image', () => {
  it('saves a draft post without a cover', () => {
    const r = parsePostPayload(post());
    expect('post' in r && r.post.cover_image_url).toBe('');
  });

  it('needs a cover to publish a post', () => {
    expect(parsePostPayload(post({ is_published: true }))).toEqual({ error: 'Add a cover image before publishing' });
    expect('post' in parsePostPayload(post({ is_published: true, cover_image_url: COVER }))).toBe(true);
  });

  it('rejects a non-ImageKit cover even on a draft', () => {
    expect(parsePostPayload(post({ cover_image_url: 'https://example.com/x.jpg' }))).toEqual({ error: 'Cover image must be an ImageKit URL' });
  });

  it('applies the same rule to website projects', () => {
    expect('project' in parseProjectPayload(project())).toBe(true);
    expect(parseProjectPayload(project({ is_published: true }))).toEqual({ error: 'Add a cover image before publishing' });
  });
});
