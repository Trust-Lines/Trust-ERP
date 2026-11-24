import { notFound, redirect } from 'next/navigation';
import { ItPhoneDetailClient } from '@/components/platform/it/ItPhoneDetailClient';
import { itContext, loadAssignees } from '@/lib/it/server';
import { isUuid } from '@/lib/it/validate';
import { loadPhoneLine } from '@/lib/it/phones';
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
  const [l, people, history] = await Promise.all([
    loadPhoneLine(ctx, id),
    ctx.canEdit ? loadAssignees(ctx) : [],
    loadAssignmentHistory(ctx.admin, 'phone_line', id),
  ]);
  if (!l) notFound();

  return (
    <ItPhoneDetailClient
      canEdit={ctx.canEdit}
      people={people}
      history={history}
      line={{
        id: l.id, number: l.number,
        firm: [l.carrier, l.firm].filter(Boolean).join(' · ') || null,
        email: l.email, imei: l.imei, location: l.location, addedAt: l.createdAt, notes: l.notes,
        holder: l.holderId ? { id: l.holderId, name: l.holderName ?? 'Unknown', role: l.holderRole, acquiredAt: l.holderSince } : null,
        device: l.deviceName ? { name: l.deviceName, imageUrl: null, assignedAt: l.deviceAssignedAt } : null,
      }}
      editValues={{
        id: l.id, number: l.number, carrier: l.carrier ?? '', firm: l.firm ?? '', holderId: l.holderId ?? '',
        deviceName: l.deviceName ?? '', personalDevice: l.personalDevice,
        email: l.email ?? '', imei: l.imei ?? '', location: l.location ?? '', notes: l.notes ?? '',
        active: l.active, hasSecret: l.hasSecret, holderSince: l.holderSince, deviceAssignedAt: l.deviceAssignedAt,
      }}
    />
  );
}
