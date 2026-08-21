
import type { ClickUpTask } from './client';
import { resolveCustomFieldValue } from './client';
import { classifySourceValue, type RegionTag } from './importMapping';
import type { OpportunityStage, ProjectType } from '@/types/database';

export type NeedOutcome =
  | { kind: 'potential' }
  | { kind: 'opportunity'; stage: OpportunityStage };

const STATUS_OP_MAP: Record<string, NeedOutcome> = {
  'Potential': { kind: 'potential' },
  'In Target List': { kind: 'potential' },
  'READY TO START': { kind: 'opportunity', stage: 'sales_accepted' },
  'MODIFICATION REQUEST': { kind: 'opportunity', stage: 'negotiation' },
  'WORKING ON IT TRUST': { kind: 'opportunity', stage: 'working_on_it_trust' },
  'Design Proposal SENT': { kind: 'opportunity', stage: 'proposal' },
  'WAITING': { kind: 'opportunity', stage: 'on_hold' },
  'DEAL MISSED': { kind: 'opportunity', stage: 'closed_lost' },
  'DEAL CLOSED': { kind: 'opportunity', stage: 'closed_won' },
};

export function mapStatusOp(raw: string): NeedOutcome {
  return STATUS_OP_MAP[raw.trim()] ?? { kind: 'potential' };
}

const PROJECT_TYPE_MAP: Record<string, ProjectType> = {
  'Full Remodel': 'full_remodel',
  'Small Remodel': 'small_remodel',
  'New Construction': 'new_construction',
};

const SERVICE_LINE_MAP: Record<string, string> = {
  'Store Maker': 'store_maker',
  'Design & Build': 'design_build',
  'Premuim Store Fitout': 'premium_store_fitout',
};

function firstString(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map(x => x.trim());
}
interface GeoValue { location?: { lat: number; lng: number }; formatted_address?: string }
function asGeo(v: unknown): GeoValue | null {
  if (v && typeof v === 'object' && 'location' in v) return v as GeoValue;
  return null;
}
interface ContactRef { id: string; name?: string }
function asContactRef(v: unknown): ContactRef | null {
  if (Array.isArray(v) && v[0] && typeof v[0] === 'object' && 'id' in v[0]) return v[0] as ContactRef;
  return null;
}

export interface OpportunityCandidate {
  externalSource: 'clickup';
  externalRef: string;
  region: RegionTag;
  siteName: string;
  brand: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string | null;
  businessTypes: string[];
  projectType: ProjectType | null;
  projectTypeRaw: string | null;
  serviceLine: string | null;
  sourceRaw: string | null;
  sourceClassification: ReturnType<typeof classifySourceValue> | null;
  requestRaw: string | null;
  externalProjectCode: string | null;
  contactExternalRef: string | null;
  statusOpRaw: string;
  outcome: NeedOutcome;
  industryRaw: string | null;
  toDoRaw: string | null;
  directContactRaw: string | null;
  description: string | null;
  tags: { name: string; color: string }[];
  externalCreatedAt: string | null;
  dueDate: string | null;
  dateDone: string | null;
  dealSize: number | null;
  deposit: number | null;
  paymentRaw: string | null;
  targeted: boolean;
}

function epochMsToIso(v: string | null | undefined): string | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? new Date(n).toISOString() : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === 'number' ? v : (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v)) ? Number(v) : null);
}
function asBool(v: unknown): boolean {
  return v === true || v === 'true';
}

export function mapTaskToOpportunityCandidate(task: ClickUpTask, region: RegionTag): OpportunityCandidate {
  const cf = new Map<string, unknown>(task.custom_fields.map(f => [f.name.trim(), resolveCustomFieldValue(f)]));
  const geo = asGeo(cf.get('11-Location'));
  const contact = asContactRef(cf.get('Contact'));
  const statusOpRaw = firstString(cf.get('Status OP')) ?? 'Potential';
  const projectTypeRaw = firstString(cf.get('Project Type'));
  const industryRaw = firstString(cf.get('Industry'));
  const sourceRaw = firstString(cf.get('Source'));

  return {
    externalSource: 'clickup',
    externalRef: task.id,
    region,
    siteName: task.name?.trim() || 'Unnamed site',
    brand: firstString(cf.get('Brand')),
    state: firstString(cf.get('01-State')),
    latitude: geo?.location?.lat ?? null,
    longitude: geo?.location?.lng ?? null,
    formattedAddress: geo?.formatted_address ?? null,
    businessTypes: asStringArray(cf.get('08-BUSNIESS TYPE')),
    projectType: projectTypeRaw ? (PROJECT_TYPE_MAP[projectTypeRaw] ?? null) : null,
    projectTypeRaw,
    serviceLine: industryRaw ? (SERVICE_LINE_MAP[industryRaw.trim()] ?? null) : null,
    sourceRaw,
    sourceClassification: sourceRaw ? classifySourceValue(sourceRaw) : null,
    requestRaw: firstString(cf.get('Request')),
    externalProjectCode: firstString(cf.get('PROJECT #')),
    contactExternalRef: contact?.id ?? null,
    statusOpRaw,
    outcome: mapStatusOp(statusOpRaw),
    industryRaw,
    toDoRaw: firstString(cf.get('To Do')),
    directContactRaw: firstString(cf.get('Direct Contact')),
    description: task.description?.trim() || task.text_content?.trim() || null,
    tags: (task.tags ?? []).map(t => ({ name: t.name, color: t.tag_bg })),
    externalCreatedAt: task.date_created ? new Date(Number(task.date_created)).toISOString() : null,
    dueDate: epochMsToIso(task.due_date),
    dateDone: epochMsToIso(task.date_done),
    dealSize: asNumber(cf.get('Deal Size')),
    deposit: asNumber(cf.get('Deposit')),
    paymentRaw: firstString(cf.get('Payment')),
    targeted: asBool(cf.get('Targeted')),
  };
}
