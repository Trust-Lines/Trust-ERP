
/* eslint-disable @typescript-eslint/no-explicit-any */

import { normalizeEmail, normalizePhone } from './duplicates';
import { runClassificationForNeed, type NeedSyncResult } from './opportunityEngine';
import { PROJECT_TYPES, TIMINGS } from './classification';
import { logAudit } from '@/lib/audit/log';
import { notifyUsers, usersWithRoles } from '@/lib/events/notify';
import type { LeadEntityType, MarketingCampaign, SurveySubmissionStatus } from '@/types/database';

export class SubmissionValidationError extends Error {
  status = 400;
}
export class SubmissionProcessingError extends Error {
  status = 500;
}

export interface PublicSurveyDTO {
  leadType?: string;
  organizationName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  city?: string;
  state?: string;
  country?: string;
  preferredLanguage?: string;
  hasActiveProject?: boolean;
  deadline?: string;
  layoutAvailable?: boolean;
  projectTypes?: string[];
  timing?: string;
  notes?: string;
  consentAccepted?: boolean;
  consentTextVersion?: string;
  submissionToken?: string;
  honeypot?: string;
  storeAddress?: string;
  team?: string;
}

export function parsePublicSurveyBody(raw: unknown): PublicSurveyDTO {
  const b = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : undefined);
  const bool = (k: string) => (typeof b[k] === 'boolean' ? (b[k] as boolean) : undefined);
  const arr = (k: string) => (Array.isArray(b[k]) ? (b[k] as unknown[]).filter((x): x is string => typeof x === 'string') : undefined);
  return {
    leadType: str('leadType'), organizationName: str('organizationName'),
    firstName: str('firstName'), lastName: str('lastName'), email: str('email'), phone: str('phone'),
    jobTitle: str('jobTitle'), city: str('city'), state: str('state'), country: str('country'),
    preferredLanguage: str('preferredLanguage'), hasActiveProject: bool('hasActiveProject'),
    deadline: str('deadline'), layoutAvailable: bool('layoutAvailable'), projectTypes: arr('projectTypes'),
    timing: str('timing'), notes: str('notes'), consentAccepted: bool('consentAccepted'),
    consentTextVersion: str('consentTextVersion'), submissionToken: str('submissionToken'),
    honeypot: str('honeypot'), storeAddress: str('storeAddress'), team: str('team'),
  };
}

function snapshot(dto: PublicSurveyDTO): Record<string, unknown> {
  const { honeypot: _honeypot, submissionToken: _token, ...rest } = dto;
  return rest as Record<string, unknown>;
}

export interface SubmissionOutcome {
  submissionId: string;
  status: SurveySubmissionStatus;
}

async function findMatchingProspects(admin: any, email: string | null, phone: string | null): Promise<{ id: string }[]> {
  if (!email && !phone) return [];
  const { data } = await admin.from('prospects')
    .select('id, main_email, main_phone').is('deleted_at', null).limit(1000);
  const found = new Map<string, { id: string }>();
  for (const row of (data ?? []) as { id: string; main_email: string | null; main_phone: string | null }[]) {
    const emailMatch = !!email && normalizeEmail(row.main_email) === email;
    const phoneMatch = !!phone && normalizePhone(row.main_phone) === phone;
    if (emailMatch || phoneMatch) found.set(row.id, { id: row.id });
  }
  return [...found.values()];
}

function attributionUser(campaign: MarketingCampaign): string {
  return (campaign.owner_user_id ?? campaign.created_by) as string;
}

async function createProspectFromSubmission(
  admin: any, dto: PublicSurveyDTO, campaign: MarketingCampaign,
): Promise<{ prospectId: string; locationId: string | null }> {
  const entityType: LeadEntityType = dto.leadType === 'person' ? 'person' : 'organization';
  const organizationName = entityType === 'organization' ? (dto.organizationName?.trim() || null) : null;
  const personFullName = [dto.firstName?.trim(), dto.lastName?.trim()].filter(Boolean).join(' ').trim() || null;
  if (entityType === 'organization' && !organizationName) throw new SubmissionValidationError('Company name is required');
  if (entityType === 'person' && !personFullName) throw new SubmissionValidationError('Name is required');

  const attributedUser = attributionUser(campaign);

  const { data, error } = await admin.from('prospects').insert({
    entity_type: entityType,
    organization_name: organizationName,
    person_name: entityType === 'person' ? personFullName : null,
    main_email: dto.email?.trim() || null,
    main_phone: dto.phone?.trim() || null,
    source_label: campaign.source,
    source_raw_label: campaign.name,
    campaign_id: campaign.id,
    latest_source_label: campaign.source,
    latest_campaign_id: campaign.id,
    status: 'captured',
    owner_id: attributedUser,
    assigned_marketing_user_id: attributedUser,
    created_by: attributedUser,
  }).select('id').single();
  if (error) throw new SubmissionProcessingError(error.message);

  if (entityType === 'organization' && personFullName) {
    await admin.from('prospect_contacts').insert({
      prospect_id: data.id, name: personFullName, title: dto.jobTitle?.trim() || null,
      email: dto.email?.trim() || null, phone: dto.phone?.trim() || null,
      is_primary: true, created_by: attributedUser,
    });
  }

  let locationId: string | null = null;
  if (dto.city?.trim() || dto.state?.trim()) {
    const { data: loc } = await admin.from('prospect_locations').insert({
      prospect_id: data.id, city: dto.city?.trim() || null, state: dto.state?.trim() || null,
      country: dto.country?.trim() || null, is_active: true,
    }).select('id').single();
    locationId = loc?.id ?? null;
  }

  return { prospectId: data.id as string, locationId };
}

async function backfillEmptyContactFields(admin: any, prospectId: string, dto: PublicSurveyDTO): Promise<void> {
  const { data: current } = await admin.from('prospects').select('main_email, main_phone').eq('id', prospectId).maybeSingle();
  const patch: Record<string, unknown> = {};
  if (!current?.main_email && dto.email?.trim()) patch.main_email = dto.email.trim();
  if (!current?.main_phone && dto.phone?.trim()) patch.main_phone = dto.phone.trim();
  if (Object.keys(patch).length) await admin.from('prospects').update(patch).eq('id', prospectId);
}

async function applyLatestAttribution(admin: any, prospectId: string, campaign: MarketingCampaign): Promise<void> {
  await admin.from('prospects').update({
    latest_source_label: campaign.source, latest_campaign_id: campaign.id,
  }).eq('id', prospectId);
}

async function createNeedFromSubmission(
  admin: any, prospectId: string, locationId: string | null, dto: PublicSurveyDTO, campaign: MarketingCampaign,
): Promise<string> {
  const projectTypes = (dto.projectTypes ?? []).filter(t => (PROJECT_TYPES as string[]).includes(t));
  let timing = dto.timing && (TIMINGS as string[]).includes(dto.timing) ? dto.timing : null;
  if (timing === 'contact_later') timing = null;

  const title = dto.storeAddress?.trim() || `${campaign.name} — Survey response`;

  const { data, error } = await admin.from('prospect_needs').insert({
    prospect_id: prospectId,
    location_id: locationId,
    title,
    description: dto.notes?.trim() || null,
    has_active_project: dto.hasActiveProject ?? null,
    project_types: projectTypes,
    deadline: dto.deadline || null,
    layout_available: dto.layoutAvailable ?? null,
    timing,
    source: campaign.source,
    created_by: attributionUser(campaign),
  }).select('id').single();
  if (error) throw new SubmissionProcessingError(error.message);
  return data.id as string;
}

async function enrichCreatedRow(admin: any, sync: NeedSyncResult, dto: PublicSurveyDTO): Promise<void> {
  const address = dto.storeAddress?.trim() || null;
  const industryRaw = dto.team && dto.team.trim() && dto.team.trim().toLowerCase() !== 'other' ? 'Store Maker' : null;
  if (!address && !industryRaw) return;

  const patch: Record<string, unknown> = {};
  if (address) { patch.title = address; patch.formatted_address = address; }
  if (industryRaw) patch.industry_raw = industryRaw;

  if (sync.opportunity?.id) {
    await admin.from('opportunities').update(patch).eq('id', sync.opportunity.id as string);
  } else if (sync.potential?.id) {
    await admin.from('prospect_potentials').update(patch).eq('id', sync.potential.id as string);
  }
}

// 🔴 2026-08-28: public survey forms (both templates) never collect a structured
// state/region — the freeform "store address" field they DO collect never gets parsed
// back onto the created Opportunity/Potential's own `state`/`region` columns, so those
// rows land in the CRM board unassigned to a region until someone fills it in by hand.
// Rather than let that go unnoticed, ping Marketing (and whoever the campaign is
// attributed to) right away so it gets completed instead of sitting invisible.
async function notifyIncompleteSubmission(
  admin: any, campaign: MarketingCampaign, dto: PublicSurveyDTO, sync: NeedSyncResult,
): Promise<void> {
  try {
    const missing: string[] = [];
    if (!dto.state?.trim()) missing.push('region/state');
    if (!dto.email?.trim() && !dto.phone?.trim()) missing.push('a way to contact them (no email or phone)');
    if (!missing.length) return;

    const name = dto.organizationName?.trim()
      || [dto.firstName, dto.lastName].filter(Boolean).join(' ').trim()
      || 'A new survey response';
    const recordKind = sync.opportunity ? 'an Opportunity' : sync.potential ? 'a Potential' : 'a Lead';

    const recipients = [...await usersWithRoles(admin, ['sales_marketing_manager', 'marketing_manager']), attributionUser(campaign)];
    await notifyUsers(admin, {
      userIds: recipients,
      projectId: null,
      type: 'survey.incomplete_submission',
      title: `${name} needs ${missing.join(' and ')}`,
      body: `"${campaign.name}" just created ${recordKind} for ${name}, but it's missing ${missing.join(' and ')}. Open the CRM board and fill it in.`,
      link: '/leads',
    });
  } catch (e) {
    console.error('[campaignSubmission] incomplete-data notification failed:', e instanceof Error ? e.message : e);
  }
}

async function recordSubmission(
  admin: any, campaign: MarketingCampaign, dto: PublicSurveyDTO,
  fields: {
    status: SurveySubmissionStatus; prospectId?: string | null; needId?: string | null;
    email: string | null; phone: string | null; idempotencyKey: string | null;
    errorCode?: string | null; errorMessage?: string | null; consentAccepted: boolean;
  },
): Promise<{ id: string; status: SurveySubmissionStatus }> {
  const now = new Date().toISOString();
  const { data, error } = await admin.from('survey_submissions').insert({
    campaign_id: campaign.id,
    prospect_id: fields.prospectId ?? null,
    need_id: fields.needId ?? null,
    status: fields.status,
    submitted_data: snapshot(dto),
    normalized_email: fields.email,
    normalized_phone: fields.phone,
    consent_accepted: fields.consentAccepted,
    consent_text_version: dto.consentTextVersion || campaign.consent_text_version,
    consent_accepted_at: fields.consentAccepted ? now : null,
    language: dto.preferredLanguage?.trim() || campaign.default_language,
    idempotency_key: fields.idempotencyKey,
    processed_at: now,
    error_code: fields.errorCode ?? null,
    error_message: fields.errorMessage ?? null,
  }).select('id, status').single();
  if (error) throw new SubmissionProcessingError(error.message);
  return data as { id: string; status: SurveySubmissionStatus };
}

export async function processSurveySubmission(admin: any, campaign: MarketingCampaign, rawBody: unknown): Promise<SubmissionOutcome> {
  const dto = parsePublicSurveyBody(rawBody);
  const idempotencyKey = dto.submissionToken?.trim() || null;
  const email = normalizeEmail(dto.email);
  const phone = normalizePhone(dto.phone);

  if (idempotencyKey) {
    const { data: existing } = await admin.from('survey_submissions')
      .select('id, status').eq('campaign_id', campaign.id).eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing) return { submissionId: existing.id, status: existing.status };
  }

  if (dto.honeypot && dto.honeypot.trim().length > 0) {
    const row = await recordSubmission(admin, campaign, dto, {
      status: 'rejected_spam', email, phone, idempotencyKey, consentAccepted: dto.consentAccepted === true,
    });
    return { submissionId: row.id, status: row.status };
  }

  if (dto.consentAccepted !== true) {
    throw new SubmissionValidationError('Please accept the consent notice to submit.');
  }

  try {
    const matches = await findMatchingProspects(admin, email, phone);

    if (matches.length > 1) {
      const row = await recordSubmission(admin, campaign, dto, {
        status: 'needs_review', email, phone, idempotencyKey, consentAccepted: true,
        errorCode: 'ambiguous_match', errorMessage: `${matches.length} conflicting Prospect matches on email/phone`,
      });
      return { submissionId: row.id, status: row.status };
    }

    let prospectId: string;
    let locationId: string | null = null;
    let isNewProspect = false;
    if (matches.length === 1) {
      prospectId = matches[0].id;
      await applyLatestAttribution(admin, prospectId, campaign);
      await backfillEmptyContactFields(admin, prospectId, dto);
    } else {
      const created = await createProspectFromSubmission(admin, dto, campaign);
      prospectId = created.prospectId;
      locationId = created.locationId;
      isNewProspect = true;
    }

    const needId = await createNeedFromSubmission(admin, prospectId, locationId, dto, campaign);
    const sync = await runClassificationForNeed(admin, needId, attributionUser(campaign));
    await enrichCreatedRow(admin, sync, dto);
    await notifyIncompleteSubmission(admin, campaign, dto, sync);

    await admin.from('campaign_interactions').insert({
      campaign_id: campaign.id, prospect_id: prospectId, interaction_type: 'survey_submission',
      source: campaign.source,
    });

    const row = await recordSubmission(admin, campaign, dto, {
      status: 'processed', prospectId, needId, email, phone, idempotencyKey, consentAccepted: true,
    });

    await admin.from('campaign_interactions').update({ survey_submission_id: row.id })
      .eq('campaign_id', campaign.id).eq('prospect_id', prospectId).is('survey_submission_id', null);

    await logAudit({
      actorId: null,
      action: isNewProspect ? 'prospect.created_via_survey' : 'prospect.touched_via_survey',
      resource: `prospect:${prospectId}`,
      newValue: { campaign_id: campaign.id, submission_id: row.id, need_id: needId, classification: sync.needClassification },
    });

    return { submissionId: row.id, status: row.status };
  } catch (e) {
    if (e instanceof SubmissionValidationError) throw e;
    const message = e instanceof Error ? e.message : 'Unknown error';
    try {
      await recordSubmission(admin, campaign, dto, {
        status: 'failed', email, phone, idempotencyKey, consentAccepted: true,
        errorCode: 'processing_error', errorMessage: message,
      });
    } catch { }
    throw new SubmissionProcessingError(message);
  }
}
