import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { PostEditorClient, type EditorPost } from '@/components/platform/website/PostEditorClient';
import type { EditorSection } from '@/components/platform/website/SectionsEditor';
import { WEBSITE_URL } from '@/lib/web-cms/config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const newPost = (): EditorPost => ({
  id: null, title: '', slug: '', excerpt: '', category: '', author: '',
  cover_image_url: '', cover_image_alt: '', published_at: new Date().toISOString().slice(0, 10), is_published: false,
});

export default async function WebsitePostPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('page.marketing');
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user!.id).single();
  const canEdit = MARKETING_WRITE_ROLES.includes(profile?.role ?? '');

  let initial: { post: EditorPost; sections: EditorSection[] } = { post: newPost(), sections: [] };

  if (id === 'new') {
    if (!canEdit) notFound();
  } else {
    const { data: p } = await admin.from('web_posts').select('*').eq('id', id).maybeSingle();
    if (!p) notFound();
    const { data: sections } = await admin.from('web_post_sections')
      .select('heading, body, image_url, image_alt').eq('post_id', id).order('sort_order');
    initial = {
      post: {
        id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt ?? '', category: p.category, author: p.author ?? '',
        cover_image_url: p.cover_image_url, cover_image_alt: p.cover_image_alt ?? '',
        published_at: p.published_at, is_published: p.is_published,
      },
      sections: (sections ?? []).map((x: { heading: string | null; body: string | null; image_url: string | null; image_alt: string | null }) => ({
        heading: x.heading ?? '', body: x.body ?? '', image_url: x.image_url ?? '', image_alt: x.image_alt ?? '',
      })),
    };
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <PostEditorClient key={id} initial={initial} canEdit={canEdit} siteUrl={WEBSITE_URL} />
    </div>
  );
}
