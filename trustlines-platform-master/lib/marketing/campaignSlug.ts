
/* eslint-disable @typescript-eslint/no-explicit-any */

export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.length ? s : 'campaign';
}

export async function generateUniqueCampaignSlug(admin: any, name: string): Promise<string> {
  const base = slugify(name);

  async function exists(candidate: string): Promise<boolean> {
    const { data } = await admin.from('marketing_campaigns').select('id').eq('slug', candidate).limit(1);
    return Array.isArray(data) && data.length > 0;
  }

  if (!(await exists(base))) return base;

  for (let n = 2; n <= 50; n++) {
    const candidate = `${base}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }

  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${randomSuffix}`;
}
