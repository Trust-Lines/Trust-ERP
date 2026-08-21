
import { resolveCustomFieldValue, type ClickUpTask } from './client';
import type { LeadSource } from '@/types/database';

export type RegionTag = 'TLINES_NE' | 'TLINES_SE' | 'TLINES_NW' | 'CVW';

export const GENERIC_SOURCE_MAP: Record<string, LeadSource> = {
  'REFERAL': 'referral', 'Referrals': 'referral', 'Referrals ': 'referral',
  'Website': 'website',
  'DIRECT': 'cold_outreach', 'Direct Marketing': 'other', 'Direct Marketing ': 'other',
  'RESEARCH': 'other', 'Dodge': 'other', 'Dodge ': 'other',
  'Client Architect': 'existing_customer', 'Client Civil Engineer': 'existing_customer',
  'Client Contractor': 'existing_customer', 'Client Supplier': 'existing_customer', 'Client PM': 'existing_customer',
  'PLANHUB': 'other', 'HCD': 'other', 'TDLR': 'other',
};

export interface SourceClassification {
  raw: string;
  kind: 'generic' | 'campaign';
  leadSource: LeadSource;
}

export function classifySourceValue(raw: string): SourceClassification {
  const trimmed = raw.trim();
  const generic = GENERIC_SOURCE_MAP[raw] ?? GENERIC_SOURCE_MAP[trimmed];
  if (generic) return { raw: trimmed, kind: 'generic', leadSource: generic };
  return { raw: trimmed, kind: 'campaign', leadSource: 'trade_fair' };
}

function firstString(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map(x => x.trim());
}
function asBool(v: unknown): boolean {
  return v === true || v === 'true';
}

interface GeoValue { location?: { lat: number; lng: number }; formatted_address?: string }
function asGeo(v: unknown): GeoValue | null {
  if (v && typeof v === 'object' && 'location' in v) return v as GeoValue;
  return null;
}

export interface ProspectCandidate {
  externalSource: 'clickup';
  externalRef: string;
  sourceListPath: string;
  region: RegionTag;
  entityType: 'organization' | 'person';
  organizationName: string | null;
  personName: string | null;
  contactName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  otherContact: string | null;
  whatsapp: boolean;
  website: string | null;
  businessTypes: string[];
  state: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string | null;
  mailingAddress: string | null;
  sourceRaw: string | null;
  sourceClassification: SourceClassification | null;
  showsAttended: string[];
  sourceDetail: string | null;
  company2Phone: string | null;
  xNote: string | null;
  tags: { name: string; color: string }[];
  externalCreatedAt: string | null;
}

export function mapTaskToProspectCandidate(task: ClickUpTask, region: RegionTag, sourceListPath: string): ProspectCandidate {
  const cf = new Map<string, unknown>(task.custom_fields.map(f => [f.name.trim(), resolveCustomFieldValue(f)]));
  const geo = asGeo(cf.get('11-Location'));

  const company = firstString(cf.get('06-Company')) ?? firstString(cf.get('Company Name'));
  const phone = firstString(cf.get('02-Phone')) ?? firstString(cf.get('Phone Number'));
  const email = firstString(cf.get('03-Email')) ?? firstString(cf.get('Email Address'));

  const sourceRaw = firstString(cf.get('13 - SOURCE')) ?? firstString(cf.get('13-SOURCE'));

  const entityType: 'organization' | 'person' =
    task.custom_item_id === 1001 ? 'person'
    : task.custom_item_id === 1010 ? 'organization'
    : (company ? 'organization' : 'person');

  return {
    externalSource: 'clickup',
    externalRef: task.id,
    sourceListPath,
    region,
    entityType,
    organizationName: entityType === 'organization' ? (company ?? (task.name?.trim() || null)) : company,
    personName: entityType === 'person' ? (task.name?.trim() || null) : null,
    contactName: task.name?.trim() || 'Unnamed',
    title: firstString(cf.get('04-Role/Position')),
    email,
    phone,
    linkedinUrl: firstString(cf.get('05-LinkedIn')),
    otherContact: firstString(cf.get('07-Other contact')),
    whatsapp: asBool(cf.get('Whatsapp')),
    website: firstString(cf.get('09-Website')),
    businessTypes: asStringArray(cf.get('08-BUSNIESS TYPE')),
    state: firstString(cf.get('01-State')),
    city: geo?.formatted_address ? null : null,
    latitude: geo?.location?.lat ?? null,
    longitude: geo?.location?.lng ?? null,
    formattedAddress: geo?.formatted_address ?? null,
    mailingAddress: firstString(cf.get('12-Mailing address')),
    sourceRaw,
    sourceClassification: sourceRaw ? classifySourceValue(sourceRaw) : null,
    showsAttended: asStringArray(cf.get('10- Shows attended')),
    sourceDetail: firstString(cf.get('14-Source info')),
    company2Phone: firstString(cf.get('Company 2 Phone Number')),
    xNote: firstString(cf.get('x-Note')),
    tags: (task.tags ?? []).map(t => ({ name: t.name, color: t.tag_bg })),
    externalCreatedAt: task.date_created ? new Date(Number(task.date_created)).toISOString() : null,
  };
}
