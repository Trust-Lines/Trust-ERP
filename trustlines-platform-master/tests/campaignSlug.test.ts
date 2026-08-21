import { describe, it, expect } from 'vitest';
import { slugify, generateUniqueCampaignSlug } from '@/lib/marketing/campaignSlug';

function fakeAdmin(existingSlugs: string[]) {
  return {
    from: (table: string) => {
      if (table !== 'marketing_campaigns') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (_f: string, v: string) => ({
            limit: async () => ({ data: existingSlugs.includes(v) ? [{ id: 'x' }] : [] }),
          }),
        }),
      };
    },
  } as any;  
}

describe('slugify', () => {
  it('lowercases, replaces non-alphanumerics with dashes, trims edges', () => {
    expect(slugify('Atlanta Build Expo 2026!')).toBe('atlanta-build-expo-2026');
    expect(slugify('  --Hello World--  ')).toBe('hello-world');
  });

  it('never returns an empty string', () => {
    expect(slugify('!!!')).toBe('campaign');
    expect(slugify('')).toBe('campaign');
  });
});

describe('generateUniqueCampaignSlug', () => {
  it('returns the plain slug when there is no collision', async () => {
    const admin = fakeAdmin([]);
    const slug = await generateUniqueCampaignSlug(admin, 'Atlanta Build Expo 2026');
    expect(slug).toBe('atlanta-build-expo-2026');
  });

  it('appends a numeric suffix on collision, finding the first free one', async () => {
    const admin = fakeAdmin(['atlanta-build-expo-2026', 'atlanta-build-expo-2026-2']);
    const slug = await generateUniqueCampaignSlug(admin, 'Atlanta Build Expo 2026');
    expect(slug).toBe('atlanta-build-expo-2026-3');
  });
});
