import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { ProspectDetailClient } from '@/components/platform/marketing/ProspectDetailClient';
import type { UserRole } from '@/types/database';

export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('page.marketing');
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'marketing_pr';
  const canEdit = MARKETING_WRITE_ROLES.includes(userRole);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: prospect, error } = await sb.from('prospects')
    .select('id, entity_type, display_name, organization_name, person_name, brand_name, industry, website, main_email, main_phone, company_size, location_count, '
      + 'status, source_label, business_types, region, owner_id, assigned_marketing_user_id, customer_id, is_archived, created_at, updated_at, '
      + 'source_detail, source_raw_label, x_note, external_created_at')
    .eq('id', id).is('deleted_at', null).maybeSingle();
  if (error || !prospect) notFound();

  const [{ data: contacts }, { data: locations }, { data: needs }, { data: potentials }, { data: opportunities }] = await Promise.all([
    sb.from('prospect_contacts')
      .select('id, prospect_id, name, title, role_type, email, phone, linkedin_url, preferred_contact_method, is_decision_maker, is_primary, contact_consent, notes, other_contact, whatsapp, company2_phone, created_at')
      .eq('prospect_id', id).order('is_primary', { ascending: false }).order('name'),
    sb.from('prospect_locations')
      .select('id, prospect_id, location_name, address_line_1, address_line_2, city, state, postal_code, country, location_type, is_active, store_status, estimated_remodel_date, notes, mailing_address, created_at')
      .eq('prospect_id', id).order('created_at', { ascending: true }),
    sb.from('prospect_needs')
      .select('id, prospect_id, location_id, title, description, has_active_project, project_types, scope_types, deadline, expected_start_date, layout_available, site_ready, budget_min, budget_max, currency, timing, target_contact_date, source, status, classification, classification_reasons, created_at, updated_at')
      .eq('prospect_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
    sb.from('prospect_potentials')
      .select('id, need_id, prospect_id, title, status, target_contact_date, converted_opportunity_id, auto_managed, classification_reasons, created_at')
      .eq('prospect_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
    sb.from('opportunities')
      .select('id, need_id, prospect_id, title, stage, deadline, auto_managed, admin_corrected, classification_reasons, created_at')
      .eq('prospect_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
  ]);

  const contactIds = (contacts ?? []).map((c: { id: string }) => c.id);
  const { data: contactNotes } = contactIds.length
    ? await sb.from('prospect_contact_notes')
        .select('id, prospect_contact_id, author_name, author_id, body, image_path, source_created_at, created_at')
        .in('prospect_contact_id', contactIds).order('source_created_at', { ascending: false })
    : { data: [] };

  const { data: files } = await sb.from('prospect_files')
    .select('id, prospect_id, dropbox_path, file_name, uploaded_by, created_at')
    .eq('prospect_id', id).order('created_at', { ascending: false });
  const fileUploaderIds = [...new Set((files ?? []).map((f: { uploaded_by: string | null }) => f.uploaded_by).filter(Boolean))] as string[];
  const { data: fileUploaders } = fileUploaderIds.length
    ? await sb.from('profiles').select('id, full_name').in('id', fileUploaderIds)
    : { data: [] };
  const fileUploaderNameById = Object.fromEntries(((fileUploaders ?? []) as { id: string; full_name: string }[]).map((u: { id: string; full_name: string }) => [u.id, u.full_name]));
  interface FileRow { id: string; prospect_id: string; dropbox_path: string; file_name: string; uploaded_by: string | null; created_at: string }
  const filesWithNames = ((files ?? []) as FileRow[]).map(f => ({ ...f, uploaded_by_name: f.uploaded_by ? (fileUploaderNameById[f.uploaded_by] ?? null) : null }));

  const { data: touchedCampaigns } = await sb.from('campaign_interactions').select('marketing_campaigns(name)').eq('prospect_id', id);
  const showsAttended = [...new Set(((touchedCampaigns ?? []) as { marketing_campaigns: { name: string } | null }[])
    .map((r: { marketing_campaigns: { name: string } | null }) => r.marketing_campaigns?.name).filter((n: string | undefined): n is string => !!n))];

  const { data: people } = await sb.from('profiles')
    .select('id, full_name')
    .in('role', ['marketing_pr', 'marketing_manager', 'sales_rep', 'sales_marketing_manager', 'ops_manager', 'general_manager'])
    .eq('is_active', true).order('full_name', { ascending: true });

  return (
    <div className="main-inner">
      <ProspectDetailClient
        initialProspect={prospect}
        initialContacts={contacts ?? []}
        initialLocations={locations ?? []}
        initialNeeds={needs ?? []}
        initialPotentials={potentials ?? []}
        initialOpportunities={opportunities ?? []}
        initialContactNotes={contactNotes ?? []}
        initialFiles={filesWithNames}
        showsAttended={showsAttended}
        assignees={people ?? []}
        canEdit={canEdit}
      />
    </div>
  );
}
