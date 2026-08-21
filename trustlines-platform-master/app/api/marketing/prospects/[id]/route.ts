import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_READ_ROLES, MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';
import { ENTITY_TYPES } from '@/lib/marketing/classification';

type Params = { params: Promise<{ id: string }> };

const DETAIL_COLS = 'id, entity_type, display_name, organization_name, person_name, brand_name, industry, website, main_email, main_phone, '
  + 'company_size, location_count, status, source_id, source_label, campaign_id, event_id, owner_id, '
  + 'assigned_marketing_user_id, customer_id, is_archived, created_by, created_at, updated_at, business_types, region, '
  + 'source_detail, source_raw_label, x_note, external_created_at';

const EDITABLE = [
  'entity_type', 'organization_name', 'person_name', 'brand_name', 'industry', 'website', 'main_email', 'main_phone',
  'company_size', 'location_count', 'owner_id', 'assigned_marketing_user_id', 'is_archived', 'source_label',
  'business_types',
  'x_note', 'source_raw_label', 'source_detail',
  'tags',
] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data: prospect, error } = await admin.from('prospects')
    .select(DETAIL_COLS).eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!prospect) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [{ data: contacts }, { data: locations }, { data: needs }, { data: potentials }, { data: opportunities }] = await Promise.all([
    admin.from('prospect_contacts')
      .select('id, prospect_id, name, title, role_type, email, phone, linkedin_url, preferred_contact_method, is_decision_maker, is_primary, contact_consent, notes, other_contact, whatsapp, company2_phone, created_at')
      .eq('prospect_id', id).order('is_primary', { ascending: false }).order('name'),
    admin.from('prospect_locations')
      .select('id, prospect_id, location_name, address_line_1, address_line_2, city, state, postal_code, country, location_type, is_active, store_status, estimated_remodel_date, notes, mailing_address, created_at')
      .eq('prospect_id', id).order('created_at', { ascending: true }),
    admin.from('prospect_needs')
      .select('id, prospect_id, location_id, title, description, has_active_project, project_types, scope_types, deadline, expected_start_date, layout_available, site_ready, budget_min, budget_max, currency, timing, target_contact_date, source, status, classification, classification_reasons, classification_rule_version, region, service_line, state, project_id, created_at, updated_at')
      .eq('prospect_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
    admin.from('prospect_potentials')
      .select('id, need_id, prospect_id, title, potential_type, status, estimated_start_date, target_contact_date, estimated_value, currency, confidence, assigned_to, converted_opportunity_id, auto_managed, classification_reasons, created_at, updated_at')
      .eq('prospect_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
    admin.from('opportunities')
      .select('id, need_id, prospect_id, title, opportunity_type, project_types, stage, deadline, marketing_owner_id, sales_owner_id, auto_managed, admin_corrected, classification_reasons, created_at, updated_at')
      .eq('prospect_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
  ]);

  const contactIds = (contacts ?? []).map((c: { id: string }) => c.id);
  const [{ data: contactNotes }, { data: people }, { data: touchedCampaigns }, { data: files }] = await Promise.all([
    contactIds.length
      ? admin.from('prospect_contact_notes')
          .select('id, prospect_contact_id, author_name, author_id, body, image_path, source_created_at, created_at')
          .in('prospect_contact_id', contactIds).order('source_created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    admin.from('profiles').select('id, full_name')
      .in('role', ['marketing_pr', 'marketing_manager', 'sales_rep', 'sales_marketing_manager', 'ops_manager', 'general_manager'])
      .eq('is_active', true).order('full_name', { ascending: true }),
    admin.from('campaign_interactions').select('marketing_campaigns(name)').eq('prospect_id', id),
    admin.from('prospect_files').select('id, prospect_id, dropbox_path, file_name, uploaded_by, created_at').eq('prospect_id', id).order('created_at', { ascending: false }),
  ]);
  const showsAttended = [...new Set(((touchedCampaigns ?? []) as { marketing_campaigns: { name: string } | null }[])
    .map(r => r.marketing_campaigns?.name).filter((n): n is string => !!n))];

  const uploaderIds = [...new Set(((files ?? []) as { uploaded_by: string | null }[]).map(f => f.uploaded_by).filter(Boolean))] as string[];
  const { data: uploaders } = uploaderIds.length
    ? await admin.from('profiles').select('id, full_name').in('id', uploaderIds)
    : { data: [] };
  const uploaderNameById = Object.fromEntries(((uploaders ?? []) as { id: string; full_name: string }[]).map(u => [u.id, u.full_name]));
  const filesWithNames = ((files ?? []) as { uploaded_by: string | null }[]).map(f => ({ ...f, uploaded_by_name: f.uploaded_by ? (uploaderNameById[f.uploaded_by] ?? null) : null }));

  return NextResponse.json({
    prospect, contacts: contacts ?? [], locations: locations ?? [],
    needs: needs ?? [], potentials: potentials ?? [], opportunities: opportunities ?? [],
    files: filesWithNames,
    contactNotes: contactNotes ?? [],
    people: people ?? [],
    showsAttended,
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];

  if ('entity_type' in patch && !(ENTITY_TYPES as string[]).includes(String(patch.entity_type))) {
    return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
  }
  if ('organization_name' in patch) {
    const name = patch.organization_name == null ? null : String(patch.organization_name).trim() || null;
    patch.organization_name = name;
  }
  if ('person_name' in patch) {
    const name = patch.person_name == null ? null : String(patch.person_name).trim() || null;
    patch.person_name = name;
  }
  if ('entity_type' in patch || 'organization_name' in patch || 'person_name' in patch) {
    const { data: current } = await admin.from('prospects').select('entity_type, organization_name, person_name').eq('id', id).maybeSingle();
    const effectiveType = (patch.entity_type as string | undefined) ?? current?.entity_type ?? 'organization';
    const effectiveOrgName = 'organization_name' in patch ? patch.organization_name : current?.organization_name;
    const effectivePersonName = 'person_name' in patch ? patch.person_name : current?.person_name;
    if (effectiveType === 'organization' && !effectiveOrgName) {
      return NextResponse.json({ error: 'Company name is required for an organization Lead' }, { status: 400 });
    }
    if (effectiveType === 'person' && !effectivePersonName) {
      return NextResponse.json({ error: 'Full name is required for a person Lead' }, { status: 400 });
    }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('prospects').update(patch).eq('id', id).is('deleted_at', null)
    .select(DETAIL_COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const action = patch.is_archived === true ? 'prospect.archived' : patch.is_archived === false ? 'prospect.unarchived' : 'prospect.updated';
  await logAudit({ actorId: user.id, action, resource: `prospect:${id}`, newValue: patch });

  return NextResponse.json({ prospect: data });
}
