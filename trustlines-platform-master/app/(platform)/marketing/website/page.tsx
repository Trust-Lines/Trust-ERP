import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { WebsiteHubClient, type WebProjectRow } from '@/components/platform/website/WebsiteHubClient';
import { PROJECTS_PAGE_DEFAULTS, WEBSITE_URL } from '@/lib/web-cms/config';
import { imageKitConfigured } from '@/lib/web-cms/imagekit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WebsiteCmsPage() {
  await requirePage('page.marketing');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user!.id).single();
  const canEdit = MARKETING_WRITE_ROLES.includes(profile?.role ?? '');

  const [projects, settings] = await Promise.all([
    admin.from('web_projects')
      .select('id, slug, title, category, location, project_type, year_built, cover_image_url, is_published, sort_order, updated_at')
      .order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
    admin.from('web_settings').select('value').eq('key', 'projects_page').maybeSingle(),
  ]);

  return (
    <div style={{ padding: '24px 32px' }}>
      <WebsiteHubClient
        projects={(projects.data ?? []) as WebProjectRow[]}
        settings={{ ...PROJECTS_PAGE_DEFAULTS, ...(settings.data?.value ?? {}) }}
        canEdit={canEdit}
        siteUrl={WEBSITE_URL}
        imageKitReady={imageKitConfigured()}
        loadError={!!projects.error || !!settings.error}
      />
    </div>
  );
}
