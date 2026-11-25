import { notFound, redirect } from 'next/navigation';
import { ItPhoneDetailClient } from '@/components/platform/it/ItPhoneDetailClient';
import { ITEM_COLS, itContext, itemImageUrl, loadAssignees, type ItemRow } from '@/lib/it/server';
import { loadPhoneItems } from '@/lib/it/phoneItemLink';
import { isUuid } from '@/lib/it/validate';
import { loadPhoneLine, loadPhoneLines, phoneAccounts } from '@/lib/it/phones';
import { loadAssignmentHistory } from '@/lib/it/assignments';

// IT → Phone number detail (Figma 966:40115): the line without its secrets — password, PIN and
// account number are revealed one at a time through /api/it/phones/[id]/secret (edit.it, audited) —
// plus its assignment history (it_assignments, migration 159).
export default async function ItPhoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await itContext();
  if (!ctx) redirect('/login');
  if (!ctx.canManage) redirect('/dashboard');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [l, people, history, all] = await Promise.all([
    loadPhoneLine(ctx, id),
    ctx.canEdit ? loadAssignees(ctx) : [],
    loadAssignmentHistory(ctx.admin, 'phone_line', id),
    ctx.canEdit ? loadPhoneLines(ctx) : Promise.resolve({ lines: [], error: null }),
  ]);
  if (!l) notFound();
  const [phoneItems, linked] = await Promise.all([
    ctx.canEdit ? loadPhoneItems(ctx) : [],
    l.itemId ? ctx.admin.from('it_items').select(ITEM_COLS).eq('id', l.itemId).is('deleted_at', null).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const item = (linked as { data: ItemRow | null }).data;

  return (
    <ItPhoneDetailClient
      canEdit={ctx.canEdit}
      people={people}
      history={history}
      accounts={phoneAccounts(all.lines.filter(x => x.active && x.id !== id))}
      phoneItems={phoneItems}
      line={{
        id: l.id, number: l.number,
        carrier: l.carrier, firm: l.firm, accountHolder: l.accountHolder, monthlyCost: l.monthlyCost,
        email: l.email, imei: l.imei, location: l.location, addedAt: l.createdAt, notes: l.notes,
        holder: l.holderName ? { id: l.holderId, name: l.holderName, role: l.holderRole, acquiredAt: l.holderSince } : null,
        device: l.deviceName ? {
          name: item?.name ?? l.deviceName, imageUrl: item ? itemImageUrl(item) : null, assignedAt: l.deviceAssignedAt, condition: l.deviceCondition,
          itemId: item?.id ?? null,
        } : null,
        personalDevice: l.personalDevice,
      }}
      editValues={{
        id: l.id, number: l.number, carrier: l.carrier ?? '', firm: l.firm ?? '', accountHolder: l.accountHolder ?? '',
        monthlyCost: l.monthlyCost != null ? l.monthlyCost.toFixed(2) : '',
        holderId: l.holderId ?? '', holderName: l.holderId ? '' : l.holderName ?? '',
        deviceName: l.deviceName ?? '', personalDevice: l.personalDevice, deviceCondition: l.deviceCondition ?? '', itemId: item?.id ?? '',
        email: l.email ?? '', imei: l.imei ?? '', location: l.location ?? '', notes: l.notes ?? '',
        active: l.active, hasSecret: l.hasSecret, holderSince: l.holderSince, deviceAssignedAt: l.deviceAssignedAt,
      }}
    />
  );
}
