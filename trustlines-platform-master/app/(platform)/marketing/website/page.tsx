import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import {
  WebsiteHubClient, type HubTab, type WebPostRow, type WebProjectRow,
} from '@/components/platform/website/WebsiteHubClient';
import { BLOG_PAGE_DEFAULTS, PROJECTS_PAGE_DEFAULTS, WEBSITE_URL } from '@/lib/web-cms/config';
import { imageKitConfigured } from '@/lib/web-cms/imagekit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TABS: HubTab[] = ['projects', 'blog', 'projects_header', 'blog_header'];

export default async function WebsiteCmsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePage('page.marketing');
  const { tab } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user!.id).single();
  const canEdit = MARKETING_WRITE_ROLES.includes(profile?.role ?? '');

  const [projects, posts, settings] = await Promise.all([
    admin.from('web_projects')
      .select('id, slug, title, category, location, project_type, year_built, cover_image_url, is_published, sort_order, updated_at')
      .order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
    admin.from('web_posts')
      .select('id, slug, title, category, author, cover_image_url, published_at, is_published')
      .order('published_at', { ascending: false }),
    admin.from('web_settings').select('key, value').in('key', ['projects_page', 'blog_page']),
  ]);
  const setting = (key: string) => (settings.data ?? []).find((r: { key: string }) => r.key === key)?.value ?? {};

  return (
    <div style={{ padding: '24px 32px' }}>
      <WebsiteHubClient
        projects={(projects.data ?? []) as WebProjectRow[]}
        posts={(posts.data ?? []) as WebPostRow[]}
        projectsPage={{ ...PROJECTS_PAGE_DEFAULTS, ...setting('projects_page') }}
        blogPage={{ ...BLOG_PAGE_DEFAULTS, ...setting('blog_page') }}
        canEdit={canEdit}
        siteUrl={WEBSITE_URL}
        imageKitReady={imageKitConfigured()}
        projectsError={!!projects.error || !!settings.error}
        blogError={!!posts.error}
        initialTab={TABS.includes(tab as HubTab) ? (tab as HubTab) : 'projects'}
      />
    </div>
  );
}
