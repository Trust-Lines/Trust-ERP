import { redirect } from 'next/navigation';
import { ItItemsLibraryClient } from '@/components/platform/it/ItItemsLibraryClient';
import { itContext, loadAssignees, loadItems } from '@/lib/it/server';

// IT Items Library (Figma 843:41158): IT management (page.it) sees it; edit.it adds / edits /
// deletes. Data: it_items (migration 155) via lib/it/server.
export default async function ItItemsLibraryPage() {
  const ctx = await itContext();
  if (!ctx) redirect('/login');
  if (!ctx.canManage) redirect('/dashboard');
  const [{ items, error }, assignees] = await Promise.all([loadItems(ctx), ctx.canEdit ? loadAssignees(ctx) : []]);

  return <ItItemsLibraryClient items={items} error={error} canCreate={ctx.canEdit} assignees={assignees} />;
}
