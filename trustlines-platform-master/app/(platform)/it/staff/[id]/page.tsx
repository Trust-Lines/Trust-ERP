import { notFound, redirect } from 'next/navigation';
import { ItStaffDetailClient, type ItStaffMailbox } from '@/components/platform/it/ItStaffDetailClient';
import { itContext, loadAssignees, loadPersonItems, loadPersonTickets } from '@/lib/it/server';
import { loadPhoneLinesFor } from '@/lib/it/phones';
import { listPurelymailMailboxes } from '@/lib/it/purelymail';
import { isUuid } from '@/lib/it/validate';

// IT → Staff member: everything IT has on one person — the items they hold, their phone lines, their
// Purelymail mailbox and the IT tickets they sent. IT management (page.it) only; the service-role
// reads run after that check (itContext).
export default async function ItStaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await itContext();
  if (!ctx) redirect('/login');
  if (!ctx.canManage) redirect('/dashboard');
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { data: profile } = await ctx.admin.from('profiles')
    .select('id, full_name, email, role, is_active, created_at').eq('id', id).maybeSingle();
  const person = profile as { id: string; full_name: string | null; email: string | null; role: string | null; is_active: boolean | null; created_at: string | null } | null;
  if (!person) notFound();

  const [items, phones, tickets, assignees, mailbox] = await Promise.all([
    loadPersonItems(ctx, id),
    loadPhoneLinesFor(ctx, id).catch(() => []),
    loadPersonTickets(ctx, id),
    ctx.canEdit ? loadAssignees(ctx) : Promise.resolve([]),
    findMailbox(person.email),
  ]);

  return (
    <ItStaffDetailClient
      person={{
        id: person.id,
        name: person.full_name || person.email || 'Unnamed',
        email: person.email,
        role: person.role,
        active: person.is_active !== false,
        joinedAt: person.created_at,
      }}
      items={items}
      phones={phones.map(l => ({
        id: l.id, number: l.number, carrier: [l.carrier, l.firm].filter(Boolean).join(' · ') || null,
        device: l.personalDevice ? 'Personal phone' : l.deviceName, since: l.holderSince, location: l.location,
      }))}
      tickets={tickets}
      mailbox={mailbox}
      canEdit={ctx.canEdit}
      assignees={assignees}
    />
  );
}

/** The person's login email as a Purelymail mailbox, if it is one. Fails soft: the page still loads. */
async function findMailbox(email: string | null): Promise<ItStaffMailbox> {
  if (!email) return { state: 'none', address: null };
  const res = await listPurelymailMailboxes();
  if (!res.ok) return { state: res.reason === 'not_configured' ? 'not_connected' : 'unavailable', address: null };
  const hit = res.addresses.find(a => a.toLowerCase() === email.toLowerCase());
  return hit ? { state: 'found', address: hit } : { state: 'none', address: null };
}
