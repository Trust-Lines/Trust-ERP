import { notFound, redirect } from 'next/navigation';
import { isUuid } from '@/lib/it/validate';

// A phone line no longer has its own page: it opens as a pop-up on IT → Phone Numbers. This keeps
// old links (items, staff, bookmarks) working.
export default async function ItPhoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  redirect(`/it/phones?line=${id}`);
}
