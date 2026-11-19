import type { CampaignStats, EmailCampaignRow } from '@/lib/email/campaigns';

export interface Option { value: string; label: string }
export interface Recipient {
  id: string; prospect_id: string | null; to_email: string; to_name: string | null; status: string; error: string | null;
  sent_at: string | null; opened_at: string | null; open_count: number; clicked_at: string | null; click_count: number; unsubscribed_at: string | null;
}
export interface TopLink { url: string; clicks: number; people: number }
export interface Detail {
  campaign: EmailCampaignRow; stats: CampaignStats; recipients: Recipient[]; recipientTotal: number;
  topLinks: TopLink[]; sender: { full_name: string | null; email: string } | null;
}
export interface AudienceCount { matched: number; noEmail: number; suppressed: number; recipients: number; sample: string[] }
export interface Template { id: string; name: string; subject: string; body_html: string }
export interface CampaignForm { name: string; subject: string; preheader: string; body_html: string }

export interface CampaignClientProps {
  id: string;
  canEdit: boolean;
  isManager: boolean;
  userId: string;
  mailReady: boolean;
  marketingCampaigns: Option[];
  regions: Option[];
  sources: string[];
}

export const STATUS_OPTIONS: Option[] = [
  { value: '', label: 'Any classification' }, { value: 'captured', label: 'No project yet' }, { value: 'potential', label: 'Potential' },
  { value: 'opportunity_candidate', label: 'Opportunity Candidate' }, { value: 'disqualified', label: 'Disqualified' },
];
export const PROJECT_OPTIONS: Option[] = [
  { value: '', label: 'Any project status' }, { value: 'active', label: 'Has an active project' },
  { value: 'finished', label: 'Project finished' }, { value: 'none', label: 'Never had a project' },
];
export const RECIPIENT_FILTERS: Option[] = [
  { value: '', label: 'Everyone' }, { value: 'sent', label: 'Delivered' }, { value: 'opened', label: 'Opened' }, { value: 'clicked', label: 'Clicked' },
  { value: 'unsubscribed', label: 'Unsubscribed' }, { value: 'failed', label: 'Failed' }, { value: 'queued', label: 'Waiting' }, { value: 'skipped', label: 'Skipped' },
];
export const WHEN = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
// Audience dropdowns: 40px tall, 14px text, 16px chevron (same as the other dialog dropdowns).
export const AUDIENCE_SELECT = 'h-10 w-full px-3 text-[14px] rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg text-ui-heading [&_.ui-select-chevron]:size-4';
export const RECIPIENTS_PER_PAGE = 50;

const SAMPLE: Record<string, string> = { name: 'Acme Retail', first_name: 'Jordan', company: 'Acme Retail', industry: 'Retail', region: 'T-Lines North East', state: 'GA', source: 'Trade Fair', email: 'jordan@example.com' };

export const rateText = (v: number | null) => (v === null ? '—' : `${v}%`);

/** Draft, scheduled, or paused before anything went out → editor; otherwise → report. */
export const isEditable = (c: EmailCampaignRow) => c.status === 'draft' || c.status === 'scheduled' || (c.status === 'paused' && !c.started_at);

/** Rough preview of the email shell the sender adds (lib/email/compose.ts wrapCampaign). */
export function previewHtml(body: string, preheader: string | null) {
  const merged = body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (w, t: string) => SAMPLE[t.toLowerCase()] ?? w);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
${preheader ? `<div style="font-size:11px;color:#6b7280;padding:8px 12px">Preview text: ${preheader.replace(/</g, '&lt;')}</div>` : ''}
<div style="max-width:600px;margin:16px auto;background:#fff;border-radius:8px;padding:28px;font-size:14px;line-height:1.6;color:#1f2937">${merged}</div>
<p style="max-width:600px;margin:0 auto 16px;font-size:11px;color:#6b7280;padding:0 12px">You received this email from … · <u>Unsubscribe</u> (added automatically)</p></body></html>`;
}

export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
