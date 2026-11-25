import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/supabase/server';
import { isUuid } from '@/lib/it/validate';
import { loadPublicItem } from '@/lib/it/publicItem';
import { PublicItemForm } from '@/components/public/PublicItemForm';

export const metadata: Metadata = { title: 'IT item — Trust Lines', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// What an IT item's QR label opens for someone without an account: a full page (no app shell) with
// the item and a form to fill it in. Signed-in people opening /it/items/<id> get the ERP page; the
// middleware sends everyone else here. See lib/it/publicItem for what the page may show and change.
export default async function PublicItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [item, user] = await Promise.all([loadPublicItem(createAdminClient(), id), getSessionUser().catch(() => null)]);
  if (!item) notFound();
  return <PublicItemForm item={item} signedIn={!!user} />;
}
