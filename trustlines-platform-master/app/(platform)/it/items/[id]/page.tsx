import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { GROUP_COOKIE, groupTokenOk } from '@/lib/it/groupLock';
import { ItItemDetailClient } from '@/components/platform/it/ItItemDetailClient';
import { itContext, loadAssignees, loadItemDetail } from '@/lib/it/server';
import { isUuid } from '@/lib/it/validate';
import { loadAssignmentHistory } from '@/lib/it/assignments';

// IT item detail (Figma 880:14431). ?edit=1 (a card's "Edit Info") opens the edit form — and so
// does an item with no details yet (added with "Quick add + QR"), so scanning its label on a phone
// goes straight to filling it in.
export default async function ItItemDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const ctx = await itContext();
  if (!ctx) redirect('/login');
  if (!ctx.canManage) redirect('/dashboard');
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const [item, assignees, history] = await Promise.all([
    loadItemDetail(ctx, id), ctx.canEdit ? loadAssignees(ctx) : [], loadAssignmentHistory(ctx.admin, 'item', id),
  ]);
  if (!item) notFound();
  const groupUnlocked = ctx.canEdit && groupTokenOk((await cookies()).get(GROUP_COOKIE)?.value, ctx.userId);
  const blank = !item.model && !item.notes && !item.setLabel && !item.imageUrl && item.specs.length === 0 && item.status === 'available';

  return <ItItemDetailClient key={`${item.id}-${item.updatedAt}`} item={item} canEdit={ctx.canEdit} assignees={assignees} startEditing={sp.edit === '1' || (ctx.canEdit && blank)} groupUnlocked={groupUnlocked} history={history} />;
}
