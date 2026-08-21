import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { getRolePermissions } from '@/lib/permissions/server';
import { permCan } from '@/lib/permissions/catalog';
import { CustomerDetailClient } from '@/components/platform/customers/CustomerDetailClient';
import type { UserRole } from '@/types/database';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('page.customers');
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'ops_manager';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canEdit = permCan(await getRolePermissions(createAdminClient() as any, userRole), 'edit.customers');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: customer, error } = await sb.from('customers')
    .select('id, name, code, industry, email, phone, website, tax_id, status, notes, is_archived, created_at, updated_at')
    .eq('id', id).is('deleted_at', null).maybeSingle();
  if (error || !customer) notFound();

  const { data: contacts } = await sb.from('customer_contacts')
    .select('id, customer_id, name, title, role_type, email, phone, is_primary, is_authorized_approver, notes, created_at')
    .eq('customer_id', id).is('deleted_at', null).order('is_primary', { ascending: false }).order('name');

  const addrRes = await sb.from('customer_addresses')
    .select('id, customer_id, label, address_type, line1, line2, city, state, postal_code, country, is_primary, notes, created_at')
    .eq('customer_id', id).is('deleted_at', null).order('is_primary', { ascending: false });
  const addresses = addrRes.error ? [] : (addrRes.data ?? []);

  const projRes = await sb.from('projects')
    .select('id, code, name, current_stage, current_phase, is_draft')
    .eq('customer_id', id).order('created_at', { ascending: false }).limit(200);
  const projects = projRes.error ? [] : (projRes.data ?? []);

  const meetRes = await sb.from('customer_meetings')
    .select('id, customer_id, lead_intake_id, project_id, title, meeting_type, meeting_at, location, attendees, notes, outcome, status, created_at')
    .eq('customer_id', id).is('deleted_at', null).order('meeting_at', { ascending: false }).limit(100);
  const meetings = meetRes.error ? [] : (meetRes.data ?? []);

  const fuRes = await sb.from('customer_follow_ups')
    .select('id, customer_id, lead_intake_id, project_id, note, due_date, assignee_id, status, completed_at, created_at')
    .eq('customer_id', id).is('deleted_at', null).order('due_date', { ascending: true }).limit(100);
  const followUps = fuRes.error ? [] : (fuRes.data ?? []);

  const { data: assigneeRows } = await sb.from('profiles')
    .select('id, full_name')
    .in('role', ['sales_rep', 'sales_marketing_manager', 'tlines_pm', 'ops_manager', 'general_manager'])
    .eq('is_active', true).order('full_name').limit(200);
  const assignees = (assigneeRows ?? []) as { id: string; full_name: string }[];

  return (
    <div className="main-inner">
      <CustomerDetailClient
        initialCustomer={customer}
        initialContacts={contacts ?? []}
        initialAddresses={addresses}
        initialMeetings={meetings}
        initialFollowUps={followUps}
        assignees={assignees}
        projects={projects}
        canEdit={canEdit}
      />
    </div>
  );
}
