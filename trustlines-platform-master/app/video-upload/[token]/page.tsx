import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { isUploadToken } from '@/lib/design/productVideos';
import { PublicVideoUploader } from '@/components/public/PublicVideoUploader';

// Public (no login — middleware lets /video-upload through): the link handed to the production
// floor. Upload a product's installation video, get its QR code. Gated by the link's token.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Upload installation video · T Lines Store Maker', robots: { index: false } };

export default async function VideoUploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let valid = false;
  if (isUploadToken(token)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data } = await admin.from('product_video_upload_links').select('id').eq('token', token).is('revoked_at', null).maybeSingle();
    valid = !!data;
  }
  return <PublicVideoUploader token={token} valid={valid} />;
}
