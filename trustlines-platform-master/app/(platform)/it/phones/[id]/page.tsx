import { notFound, redirect } from 'next/navigation';
import { ItPhoneDetailClient } from '@/components/platform/it/ItPhoneDetailClient';
import { itContext, loadAssignees } from '@/lib/it/server';
import { isUuid } from '@/lib/it/validate';
import { loadPhoneLine } from '@/lib/it/phones';

// IT → Phone number detail (Figma 966:40115): the line without its secrets — password, PIN and
// account number are revealed one at a time through /api/it/phones/[id]/secret (edit.it, audited).
export default async function ItPhoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await itContext();
  if (!ctx) redirect('/login');
  if (!ctx.canManage) redirect('/dashboard');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [l, people] = await Promise.all([loadPhoneLine(ctx, id), ctx.canEdit ? loadAssignees(ctx) : []]);
  if (!l) notFound();

  return (
    <ItPhoneDetailClient
      canEdit={ctx.canEdit}
      people={people}
      line={{
        id: l.id, number: l.number,
        firm: [l.carrier, l.firm].filter(Boolean).join(' · ') || null,
        email: l.email, imei: l.imei, location: l.location, startDate: l.startDate, addedAt: l.createdAt, notes: l.notes,
        holder: l.holderId ? { id: l.holderId, name: l.holderName ?? 'Unknown', role: l.holderRole, acquiredAt: l.holderSince } : null,
        device: l.deviceName ? { name: l.deviceName, imageUrl: null, assignedAt: l.deviceAssignedAt } : null,
      }}
      editValues={{
        id: l.id, number: l.number, carrier: l.carrier ?? '', firm: l.firm ?? '', holderId: l.holderId ?? '', holderSince: l.holderSince ?? '',
        deviceName: l.deviceName ?? '', personalDevice: l.personalDevice, deviceAssignedAt: l.deviceAssignedAt ?? '',
        email: l.email ?? '', imei: l.imei ?? '', location: l.location ?? '', startDate: l.startDate ?? '', notes: l.notes ?? '',
        active: l.active, hasSecret: l.hasSecret,
      }}
    />
  );
}
