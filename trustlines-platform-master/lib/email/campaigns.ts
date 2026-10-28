import type { Audience } from '@/lib/email/sender';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Email campaigns (migration 129): validation and the shapes the pages / routes share.

export const EMAIL_CAMPAIGN_COLS = 'id, name, subject, preheader, body_html, template_id, sender_user_id, audience, marketing_campaign_id, status, scheduled_at, started_at, finished_at, recipient_count, last_error, created_by, created_at, updated_at';

export interface EmailCampaignRow {
  id: string; name: string; subject: string; preheader: string | null; body_html: string; template_id: string | null;
  sender_user_id: string | null; audience: Audience; marketing_campaign_id: string | null;
  status: 'draft' | 'scheduled' | 'sending' | 'paused' | 'sent' | 'cancelled';
  scheduled_at: string | null; started_at: string | null; finished_at: string | null; recipient_count: number;
  last_error: string | null; created_by: string | null; created_at: string; updated_at: string;
}

export interface CampaignStats {
  campaign_id: string; total: number; pending: number; sent: number; failed: number; skipped: number;
  opened: number; clicked: number; unsubscribed: number; opens: number; clicks: number;
}

export const EMPTY_STATS = (id: string): CampaignStats => ({
  campaign_id: id, total: 0, pending: 0, sent: 0, failed: 0, skipped: 0, opened: 0, clicked: 0, unsubscribed: 0, opens: 0, clicks: 0,
});

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

/** Campaign fields that can still change: everything while it's a draft or scheduled. */
const EDITABLE = ['draft', 'scheduled', 'paused'];
export const isEditable = (status: string) => EDITABLE.includes(status);

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const AUDIENCE_KEYS = ['q', 'status', 'region', 'sources', 'completeness', 'campaignId', 'surveyOnly', 'projectStatus', 'followUpOverdue', 'includePeople'] as const;

export function parseAudience(raw: unknown): Audience {
  const a = (raw ?? {}) as Record<string, unknown>;
  const out: Audience = {};
  for (const k of AUDIENCE_KEYS) {
    const v = a[k];
    if (k === 'sources') { if (Array.isArray(v)) out.sources = v.filter((s): s is string => typeof s === 'string' && !!s.trim()).slice(0, 50); }
    else if (k === 'surveyOnly' || k === 'followUpOverdue' || k === 'includePeople') { if (v === true) out[k] = true; }
    else if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 200);
  }
  return out;
}

export interface CampaignPatch {
  name?: string; subject?: string; preheader?: string | null; body_html?: string; template_id?: string | null;
  audience?: Audience; marketing_campaign_id?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseCampaignPatch(raw: unknown): { value: CampaignPatch } | { error: string } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const out: CampaignPatch = {};
  if ('name' in b) {
    const n = str(b.name).trim();
    if (!n) return { error: 'Give the campaign a name' };
    out.name = n.slice(0, 200);
  }
  if ('subject' in b) out.subject = str(b.subject).trim().slice(0, 250);
  if ('preheader' in b) out.preheader = str(b.preheader).trim().slice(0, 250) || null;
  if ('body_html' in b) {
    const body = str(b.body_html);
    if (body.length > 300_000) return { error: 'The email content is too large' };
    out.body_html = body;
  }
  for (const k of ['template_id', 'marketing_campaign_id'] as const) {
    if (k in b) {
      const v = str(b[k]).trim();
      if (v && !UUID_RE.test(v)) return { error: 'Invalid reference' };
      out[k] = v || null;
    }
  }
  if ('audience' in b) out.audience = parseAudience(b.audience);
  return { value: out };
}

export async function loadStats(admin: any, ids: string[]): Promise<Map<string, CampaignStats>> {
  const out = new Map<string, CampaignStats>();
  if (!ids.length) return out;
  const { data, error } = await admin.from('email_campaign_stats').select('*').in('campaign_id', ids);
  if (error) throw new Error(error.message);
  for (const r of (data ?? []) as CampaignStats[]) {
    out.set(r.campaign_id, Object.fromEntries(Object.entries(r).map(([k, v]) => [k, k === 'campaign_id' ? v : Number(v)])) as unknown as CampaignStats);
  }
  return out;
}

/** Tables from migration 129 missing → the page explains instead of crashing. */
export const isNotReady = (error: { message: string; code?: string }) =>
  error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message);
