
import { computeProspectCompleteness } from './prospectCompleteness';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ProspectListBase {
  id: string;
  owner_id: string | null;
  assigned_marketing_user_id: string | null;
  organization_name?: string | null;
  person_name?: string | null;
  main_email?: string | null;
  main_phone?: string | null;
  website?: string | null;
  source_label?: string | null;
  source_raw_label?: string | null;
  source_detail?: string | null;
  business_types?: string[] | null;
  x_note?: string | null;
  [key: string]: unknown;
}

export interface ProspectListContact {
  id: string; name: string; whatsapp: boolean; completeness_percent: number;
}

export interface ProspectListEnrichment {
  primary_contact: string | null;
  primary_contact_id: string | null;
  location_count_actual: number;
  potential_count: number;
  opportunity_count: number;
  owner_name: string | null;
  state: string | null;
  whatsapp: boolean;
  completeness_percent: number;
  other_contacts: ProspectListContact[];
}

export async function enrichProspectRows<T extends ProspectListBase>(sb: any, base: T[]): Promise<(T & ProspectListEnrichment)[]> {
  const ids = base.map(p => p.id);
  if (!ids.length) return [];

  interface ContactRow {
    id: string; prospect_id: string; name: string; is_primary: boolean;
    title: string | null; linkedin_url: string | null; other_contact: string | null;
    company2_phone: string | null; whatsapp: boolean | null; email: string | null; phone: string | null;
  }
  const contactsByProspect: Record<string, ContactRow[]> = {};
  const locationByProspect: Record<string, { state: string | null; address_line_1: string | null; mailing_address: string | null }> = {};
  const locationCountByProspect: Record<string, number> = {};
  const potentialCountByProspect: Record<string, number> = {};
  const opportunityCountByProspect: Record<string, number> = {};
  const showsAttendedByProspect: Record<string, boolean> = {};
  let nameById: Record<string, string> = {};

  const [{ data: contacts }, { data: locations }, { data: potentials }, { data: opportunities }, { data: touches }] = await Promise.all([
    sb.from('prospect_contacts').select('id, prospect_id, name, is_primary, title, linkedin_url, other_contact, company2_phone, whatsapp, email, phone').in('prospect_id', ids),
    sb.from('prospect_locations').select('prospect_id, state, address_line_1, mailing_address').in('prospect_id', ids),
    sb.from('prospect_potentials').select('prospect_id, status').in('prospect_id', ids).is('deleted_at', null),
    sb.from('opportunities').select('prospect_id, stage').in('prospect_id', ids).is('deleted_at', null),
    sb.from('campaign_interactions').select('prospect_id').in('prospect_id', ids),
  ]);
  for (const c of (contacts ?? []) as ContactRow[]) {
    (contactsByProspect[c.prospect_id] ??= []).push(c);
  }
  for (const l of (locations ?? []) as { prospect_id: string; state: string | null; address_line_1: string | null; mailing_address: string | null }[]) {
    locationCountByProspect[l.prospect_id] = (locationCountByProspect[l.prospect_id] ?? 0) + 1;
    if (!locationByProspect[l.prospect_id]) locationByProspect[l.prospect_id] = { state: l.state, address_line_1: l.address_line_1, mailing_address: l.mailing_address };
  }
  for (const p of (potentials ?? []) as { prospect_id: string; status: string }[]) {
    if (['converted', 'lost', 'cancelled'].includes(p.status)) continue;
    potentialCountByProspect[p.prospect_id] = (potentialCountByProspect[p.prospect_id] ?? 0) + 1;
  }
  for (const o of (opportunities ?? []) as { prospect_id: string; stage: string }[]) {
    if (o.stage === 'closed_lost') continue;
    opportunityCountByProspect[o.prospect_id] = (opportunityCountByProspect[o.prospect_id] ?? 0) + 1;
  }
  for (const t of (touches ?? []) as { prospect_id: string }[]) showsAttendedByProspect[t.prospect_id] = true;
  const peopleIds = [...new Set(base.flatMap(p => [p.owner_id, p.assigned_marketing_user_id]).filter(Boolean))] as string[];
  if (peopleIds.length) {
    const { data: people } = await sb.from('profiles').select('id, full_name').in('id', peopleIds);
    nameById = Object.fromEntries(((people ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));
  }

  return base.map(p => {
    const rowContacts = contactsByProspect[p.id] ?? [];
    const primaryContact = rowContacts.find(c => c.is_primary) ?? rowContacts[0] ?? null;
    const location = locationByProspect[p.id] ?? null;

    const completenessFor = (c: ContactRow | null) => computeProspectCompleteness({
      organizationName: p.organization_name ?? null, personName: p.person_name ?? null,
      mainEmail: c?.email ?? p.main_email ?? null, mainPhone: c?.phone ?? p.main_phone ?? null, website: p.website ?? null,
      sourceLabel: p.source_label ?? null, sourceRawLabel: p.source_raw_label ?? null, sourceDetail: p.source_detail ?? null,
      businessTypes: p.business_types ?? [], showsAttended: showsAttendedByProspect[p.id] ? ['x'] : [],
      primaryContact: c ? {
        title: c.title, linkedinUrl: c.linkedin_url, otherContact: c.other_contact,
        company2Phone: c.company2_phone, whatsapp: c.whatsapp === true,
      } : null,
      location: location ? { state: location.state, address: location.address_line_1, mailingAddress: location.mailing_address } : null,
      xNote: p.x_note ?? null,
    }).percent;

    const perContactPercent = rowContacts.map(c => ({ c, percent: completenessFor(c) }));
    const bestPercent = perContactPercent.length ? Math.max(...perContactPercent.map(x => x.percent)) : completenessFor(null);
    const otherContacts: ProspectListContact[] = perContactPercent
      .filter(x => !x.c.is_primary)
      .map(x => ({ id: x.c.id, name: x.c.name, whatsapp: x.c.whatsapp === true, completeness_percent: x.percent }));

    return {
      ...p,
      primary_contact: primaryContact?.name ?? null,
      primary_contact_id: primaryContact?.id ?? null,
      location_count_actual: locationCountByProspect[p.id] ?? 0,
      potential_count: potentialCountByProspect[p.id] ?? 0,
      opportunity_count: opportunityCountByProspect[p.id] ?? 0,
      owner_name: nameById[p.assigned_marketing_user_id ?? ''] ?? nameById[p.owner_id ?? ''] ?? null,
      state: location?.state ?? null,
      whatsapp: primaryContact?.whatsapp === true,
      completeness_percent: bestPercent,
      other_contacts: otherContacts,
    };
  });
}
