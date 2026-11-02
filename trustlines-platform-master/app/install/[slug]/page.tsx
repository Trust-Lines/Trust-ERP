import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { isVideoSlug } from '@/lib/design/productVideos';

// Public (no login — middleware lets /install through): what a packaging sticker's QR code opens.
// Just the product and its installation video; the video streams from Dropbox through
// /api/public/product-videos/<slug>.
export const dynamic = 'force-dynamic';

const GREEN = '#2f4639';

async function load(slug: string) {
  if (!isVideoSlug(slug)) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin.from('product_videos').select('product_code, title, category, dropbox_path').eq('slug', slug).is('deleted_at', null).maybeSingle();
  return data as { product_code: string; title: string | null; category: string | null; dropbox_path: string | null } | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const v = await load((await params).slug);
  return { title: v ? `${v.product_code} — Installation · T Lines Store Maker` : 'Installation video · T Lines Store Maker', robots: { index: false } };
}

export default async function InstallVideoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const video = await load(slug);
  if (!video) notFound();

  return (
    <main style={{ minHeight: '100dvh', background: '#f4f5f2', color: GREEN, fontFamily: 'var(--font-montserrat), system-ui, sans-serif' }}>
      <header style={{ background: '#fff', borderBottom: `4px solid ${GREEN}`, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/TLINES%20LOGOS%20PNG/Store%20Maker.png" alt="T Lines Store Maker" width={64} height={64} style={{ objectFit: 'cover' }} />
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Installation video</span>
      </header>
      <section style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 40px)', fontWeight: 800, lineHeight: 1.1 }}>{video.product_code}</h1>
          {video.category && <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6b6b6b' }}>{video.category}</p>}
          {video.title && <p style={{ margin: '2px 0 0', fontSize: 'clamp(15px, 3vw, 20px)', fontWeight: 700, color: '#4b4b4b', textTransform: 'uppercase' }}>{video.title}</p>}
        </div>
        {video.dropbox_path ? <video
          src={`/api/public/product-videos/${slug}`}
          controls
          playsInline
          preload="metadata"
          style={{ width: '100%', aspectRatio: '16 / 9', background: '#000', borderRadius: 12 }}
        >
          Your browser can’t play this video.
        </video> : (
          <div style={{ aspectRatio: '16 / 9', display: 'grid', placeItems: 'center', background: '#e8ebe6', borderRadius: 12, textAlign: 'center', padding: 16, fontWeight: 600 }}>
            The installation video for this product is coming soon.
          </div>
        )}
        <p style={{ margin: 0, fontSize: 12, color: '#6b6b6b' }}>T Lines Store Maker · Need help? Contact your T Lines representative.</p>
      </section>
    </main>
  );
}
