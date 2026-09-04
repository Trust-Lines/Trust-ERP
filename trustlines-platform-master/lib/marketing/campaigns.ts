
/* eslint-disable @typescript-eslint/no-explicit-any */

import { generateUniqueCampaignSlug } from './campaignSlug';
import { SURVEY_TEMPLATES, type SurveyTemplate } from './surveyTemplates';
import { appBaseUrl } from '@/lib/env/appUrl';
import type { CampaignStatus, CampaignType, LeadSource, MarketingCampaign } from '@/types/database';

export { SURVEY_TEMPLATES, SURVEY_TEMPLATE_LABELS, type SurveyTemplate } from './surveyTemplates';

export class CampaignError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const CAMPAIGN_TYPES: CampaignType[] = ['trade_fair', 'event'];
export const CAMPAIGN_STATUSES: CampaignStatus[] = ['draft', 'active', 'paused', 'closed'];

const LIST_COLS = 'id, name, code, slug, campaign_type, source, city, state, country, venue, start_date, end_date, '
  + 'default_language, owner_user_id, status, public_title, public_description, consent_text_version, survey_template, '
  + 'created_by, created_at, updated_at, closed_at';
const DETAIL_COLS = `${LIST_COLS}, description`;

export function publicSurveyBaseUrl(): string {
  const custom = process.env.NEXT_PUBLIC_SURVEY_BASE_URL?.trim();
  if (custom) return custom.replace(/\/+$/, '');
  return appBaseUrl();
}
export function publicSurveyPath(slug: string): string {
  return `/survey/${slug}`;
}
export function publicSurveyUrl(slug: string): string {
  return `${publicSurveyBaseUrl()}${publicSurveyPath(slug)}`;
}

export interface CreateCampaignInput {
  name: string;
  code?: string | null;
  campaignType: CampaignType;
  source: LeadSource;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  venue?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  defaultLanguage?: string;
  ownerUserId?: string | null;
  publicTitle?: string | null;
  publicDescription?: string | null;
  consentTextVersion?: string;
  surveyTemplate?: SurveyTemplate;
}

export async function createCampaign(admin: any, input: CreateCampaignInput, actorId: string): Promise<MarketingCampaign> {
  const name = input.name?.trim();
  if (!name) throw new CampaignError('Campaign name is required');
  if (!CAMPAIGN_TYPES.includes(input.campaignType)) throw new CampaignError('Invalid campaign type');
  if (input.surveyTemplate && !(SURVEY_TEMPLATES as readonly string[]).includes(input.surveyTemplate)) {
    throw new CampaignError('Invalid survey template');
  }

  const slug = await generateUniqueCampaignSlug(admin, name);

  const { data, error } = await admin.from('marketing_campaigns').insert({
    name,
    code: input.code?.trim() || null,
    slug,
    campaign_type: input.campaignType,
    source: input.source,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    country: input.country?.trim() || null,
    venue: input.venue?.trim() || null,
    description: input.description?.trim() || null,
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    default_language: input.defaultLanguage?.trim() || 'en',
    owner_user_id: input.ownerUserId || actorId,
    status: 'draft',
    public_title: input.publicTitle?.trim() || null,
    public_description: input.publicDescription?.trim() || null,
    consent_text_version: input.consentTextVersion?.trim() || 'v1',
    survey_template: input.surveyTemplate || 'none',
    created_by: actorId,
  }).select(DETAIL_COLS).single();

  if (error) throw new CampaignError(error.message, 500);
  return data as MarketingCampaign;
}

export interface ListCampaignsFilter {
  status?: CampaignStatus;
  campaignType?: CampaignType;
  ownerUserId?: string;
  q?: string;
  scopeToUserId?: string;
}

export async function listCampaigns(admin: any, filter: ListCampaignsFilter): Promise<Record<string, unknown>[]> {
  let query = admin.from('marketing_campaigns').select(LIST_COLS).is('deleted_at', null);
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.campaignType) query = query.eq('campaign_type', filter.campaignType);
  if (filter.ownerUserId) query = query.eq('owner_user_id', filter.ownerUserId);
  if (filter.scopeToUserId) query = query.or(`owner_user_id.eq.${filter.scopeToUserId},created_by.eq.${filter.scopeToUserId}`);
  if (filter.q) {
    const safe = filter.q.replace(/[%,()\\]/g, '\\$&');
    query = query.or(`name.ilike.%${safe}%,code.ilike.%${safe}%,city.ilike.%${safe}%`);
  }
  query = query.order('created_at', { ascending: false }).limit(200);
  const { data, error } = await query;
  if (error) throw new CampaignError(error.message, 500);
  return data ?? [];
}

export async function getCampaign(admin: any, id: string): Promise<MarketingCampaign | null> {
  const { data } = await admin.from('marketing_campaigns').select(DETAIL_COLS).eq('id', id).is('deleted_at', null).maybeSingle();
  return (data as MarketingCampaign | null) ?? null;
}

export async function getCampaignBySlug(admin: any, slug: string): Promise<MarketingCampaign | null> {
  const { data } = await admin.from('marketing_campaigns').select(DETAIL_COLS).eq('slug', slug).is('deleted_at', null).maybeSingle();
  return (data as MarketingCampaign | null) ?? null;
}

const EDITABLE_FIELDS = [
  'name', 'code', 'campaignType', 'source', 'city', 'state', 'country', 'venue', 'description',
  'startDate', 'endDate', 'defaultLanguage', 'ownerUserId', 'publicTitle', 'publicDescription',
  'consentTextVersion', 'surveyTemplate',
] as const;
type EditableField = typeof EDITABLE_FIELDS[number];
const FIELD_TO_COLUMN: Record<EditableField, string> = {
  name: 'name', code: 'code', campaignType: 'campaign_type', source: 'source', city: 'city', state: 'state',
  country: 'country', venue: 'venue', description: 'description', startDate: 'start_date',
  endDate: 'end_date', defaultLanguage: 'default_language', ownerUserId: 'owner_user_id',
  publicTitle: 'public_title', publicDescription: 'public_description', consentTextVersion: 'consent_text_version',
  surveyTemplate: 'survey_template',
};

export async function updateCampaign(
  admin: any, id: string, patch: Partial<Record<EditableField, unknown>>,
): Promise<MarketingCampaign> {
  const existing = await getCampaign(admin, id);
  if (!existing) throw new CampaignError('Campaign not found', 404);
  if (existing.status === 'closed') throw new CampaignError('Closed campaigns cannot be edited', 409);

  const update: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (!(field in patch)) continue;
    const col = FIELD_TO_COLUMN[field];
    const v = patch[field];
    if (field === 'name') {
      const name = typeof v === 'string' ? v.trim() : '';
      if (!name) throw new CampaignError('Campaign name is required');
      update[col] = name;
    } else if (field === 'campaignType') {
      if (!CAMPAIGN_TYPES.includes(v as CampaignType)) throw new CampaignError('Invalid campaign type');
      update[col] = v;
    } else if (field === 'surveyTemplate') {
      if (!(SURVEY_TEMPLATES as readonly string[]).includes(v as string)) throw new CampaignError('Invalid survey template');
      update[col] = v;
    } else if (typeof v === 'string') {
      update[col] = v.trim() || null;
    } else {
      update[col] = v ?? null;
    }
  }
  if (!Object.keys(update).length) return existing;

  const { data, error } = await admin.from('marketing_campaigns').update(update).eq('id', id).select(DETAIL_COLS).single();
  if (error) throw new CampaignError(error.message, 500);
  return data as MarketingCampaign;
}

const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ['active', 'closed'],
  active: ['paused', 'closed'],
  paused: ['active', 'closed'],
  closed: [],
};

export async function trashCampaign(admin: any, id: string): Promise<void> {
  const existing = await getCampaign(admin, id);
  if (!existing) throw new CampaignError('Campaign not found', 404);
  await admin.from('marketing_campaigns').update({ deleted_at: new Date().toISOString() }).eq('id', id);
}

export async function setCampaignStatus(admin: any, id: string, next: CampaignStatus): Promise<MarketingCampaign> {
  const existing = await getCampaign(admin, id);
  if (!existing) throw new CampaignError('Campaign not found', 404);
  if (!VALID_TRANSITIONS[existing.status].includes(next)) {
    throw new CampaignError(`Cannot move a campaign from "${existing.status}" to "${next}"`, 409);
  }
  const update: Record<string, unknown> = { status: next };
  if (next === 'closed') update.closed_at = new Date().toISOString();

  const { data, error } = await admin.from('marketing_campaigns').update(update).eq('id', id).select(DETAIL_COLS).single();
  if (error) throw new CampaignError(error.message, 500);
  return data as MarketingCampaign;
}

export interface CampaignStats {
  totalSubmissions: number;
  newProspects: number;
  existingProspects: number;
  needsCreated: number;
  needsReview: number;
  rejectedSpam: number;
  potentials: number;
  opportunities: number;
  conversionRate: number;
}

export async function computeCampaignStats(admin: any, campaignId: string): Promise<CampaignStats> {
  const { data: submissions } = await admin.from('survey_submissions')
    .select('id, status, prospect_id, need_id').eq('campaign_id', campaignId) as {
      data: { id: string; status: string; prospect_id: string | null; need_id: string | null }[] | null;
    };
  const rows = submissions ?? [];

  const totalSubmissions = rows.length;
  const needsReview = rows.filter(r => r.status === 'needs_review').length;
  const rejectedSpam = rows.filter(r => r.status === 'rejected_spam').length;
  const needIds = [...new Set(rows.map(r => r.need_id).filter((v): v is string => !!v))];
  const needsCreated = needIds.length;

  const prospectIds = [...new Set(rows.map(r => r.prospect_id).filter((v): v is string => !!v))];
  let newProspects = 0, existingProspects = 0;
  if (prospectIds.length) {
    const { data: prospects } = await admin.from('prospects').select('id, campaign_id').in('id', prospectIds) as {
      data: { id: string; campaign_id: string | null }[] | null;
    };
    for (const p of prospects ?? []) {
      if (p.campaign_id === campaignId) newProspects += 1; else existingProspects += 1;
    }
  }

  let potentials = 0, opportunities = 0;
  if (needIds.length) {
    const { data: needs } = await admin.from('prospect_needs').select('id, classification').in('id', needIds) as {
      data: { id: string; classification: string }[] | null;
    };
    for (const n of needs ?? []) {
      if (n.classification === 'potential') potentials += 1;
      else if (n.classification === 'opportunity') opportunities += 1;
    }
  }

  const conversionRate = totalSubmissions > 0 ? Math.round((opportunities / totalSubmissions) * 1000) / 10 : 0;

  return { totalSubmissions, newProspects, existingProspects, needsCreated, needsReview, rejectedSpam, potentials, opportunities, conversionRate };
}

export interface RecentSubmissionRow {
  id: string;
  status: string;
  prospect_id: string | null;
  need_id: string | null;
  normalized_email: string | null;
  normalized_phone: string | null;
  language: string | null;
  submitted_at: string;
  processed_at: string | null;
}

export async function listRecentSubmissions(admin: any, campaignId: string, limit = 50): Promise<RecentSubmissionRow[]> {
  const { data, error } = await admin.from('survey_submissions')
    .select('id, status, prospect_id, need_id, normalized_email, normalized_phone, language, submitted_at, processed_at')
    .eq('campaign_id', campaignId).order('submitted_at', { ascending: false }).limit(limit);
  if (error) throw new CampaignError(error.message, 500);
  return (data ?? []) as RecentSubmissionRow[];
}
