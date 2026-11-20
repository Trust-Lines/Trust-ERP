import { redirect } from 'next/navigation';
import { ItPhonesClient } from '@/components/platform/it/ItPhonesClient';
import { itContext, loadAssignees } from '@/lib/it/server';
import { loadPhoneLines } from '@/lib/it/phones';

// IT → Phone Numbers (Figma 966:39447): company phone lines (it_phone_lines, migration 158).
// IT management (page.it) sees them; edit.it adds ("New Number"), edits and deletes.
export default async function ItPhonesPage() {
  const ctx = await itContext();
  if (!ctx) redirect('/login');
  if (!ctx.canManage) redirect('/dashboard');
  const [{ lines, error }, people] = await Promise.all([loadPhoneLines(ctx), ctx.canEdit ? loadAssignees(ctx) : []]);

  return (
    <ItPhonesClient
      error={error}
      canCreate={ctx.canEdit && !error}
      people={people}
      lines={lines.map(l => ({
        id: l.id, number: l.number, carrier: l.carrier, deviceName: l.deviceName, personalDevice: l.personalDevice,
        holderId: l.holderId, holderName: l.holderName, holderRole: l.holderRole, firm: l.firm, active: l.active, createdAt: l.createdAt,
      }))}
    />
  );
}
