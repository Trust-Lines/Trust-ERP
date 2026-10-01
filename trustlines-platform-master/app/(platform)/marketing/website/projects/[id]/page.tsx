import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import {
  ProjectEditorClient, type EditorPhoto, type EditorProject, type EditorSection,
} from '@/components/platform/website/ProjectEditorClient';
import { WEBSITE_URL } from '@/lib/web-cms/config';
import type { WorkTypeRow } from '@/lib/web-cms/workTypes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EMPTY: EditorProject = {
  id: null, title: '', slug: '', category: '', location: '', project_type: '', year_built: '',
  cover_image_url: '', cover_image_alt: '', is_published: false, sort_order: 0,
};

export default async function WebsiteProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('page.marketing');
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user!.id).single();
  const canEdit = MARKETING_WRITE_ROLES.includes(profile?.role ?? '');

  const types = await admin.from('web_work_types').select('id, slug, label, icon_url, sort_order, is_active')
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  const workTypes = types.error ? null : (types.data ?? []) as WorkTypeRow[];

  let initial = { project: EMPTY, photos: [] as EditorPhoto[], sections: [] as EditorSection[], workTypes: [] as string[] };

  if (id === 'new') {
    if (!canEdit) notFound();
  } else {
    const { data: p } = await admin.from('web_projects').select('*').eq('id', id).maybeSingle();
    if (!p) notFound();
    const [photos, sections] = await Promise.all([
      admin.from('web_project_photos').select('image_url, alt').eq('project_id', id).order('sort_order'),
      admin.from('web_project_sections').select('heading, body, image_url, image_alt').eq('project_id', id).order('sort_order'),
    ]);
    initial = {
      project: {
        id: p.id, title: p.title, slug: p.slug, category: p.category, location: p.location,
        project_type: p.project_type ?? '', year_built: p.year_built == null ? '' : String(p.year_built),
        cover_image_url: p.cover_image_url, cover_image_alt: p.cover_image_alt ?? '',
        is_published: p.is_published, sort_order: p.sort_order,
      },
      workTypes: (p.work_types as string[] | null | undefined) ?? [],
      photos: (photos.data ?? []).map((x: { image_url: string; alt: string | null }) => ({ image_url: x.image_url, alt: x.alt ?? '' })),
      sections: (sections.data ?? []).map((x: { heading: string | null; body: string | null; image_url: string | null; image_alt: string | null }) => ({
        heading: x.heading ?? '', body: x.body ?? '', image_url: x.image_url ?? '', image_alt: x.image_alt ?? '',
      })),
    };
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <ProjectEditorClient key={id} initial={initial} canEdit={canEdit} siteUrl={WEBSITE_URL} workTypes={workTypes} />
    </div>
  );
}
