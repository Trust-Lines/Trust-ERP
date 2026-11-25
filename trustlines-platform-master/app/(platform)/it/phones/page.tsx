import { redirect } from 'next/navigation';
import { ItPhonesClient } from '@/components/platform/it/ItPhonesClient';
import { itContext, loadAssignees } from '@/lib/it/server';
import { loadPhoneLines, phoneAccounts } from '@/lib/it/phones';
import { loadPhoneItems } from '@/lib/it/phoneItemLink';

// IT → Phone Numbers (Figma 966:39447): company phone lines (it_phone_lines, migration 158).
// IT management (page.it) sees them; edit.it adds ("New Number"), edits and deletes.
export default async function ItPhonesPage() {
  const ctx = await itContext();
  if (!ctx) redirect('/login');
  if (!ctx.canManage) redirect('/dashboard');
  const [{ lines, error }, people, phoneItems] = await Promise.all([
    loadPhoneLines(ctx), ctx.canEdit ? loadAssignees(ctx) : [], loadPhoneItems(ctx),
  ]);

  return (
    <ItPhonesClient
      error={error}
      canCreate={ctx.canEdit && !error}
      people={people}
      phoneItems={phoneItems}
      accounts={ctx.canEdit ? phoneAccounts(lines.filter(l => l.active)) : []}
      lines={lines}
    />
  );
}
