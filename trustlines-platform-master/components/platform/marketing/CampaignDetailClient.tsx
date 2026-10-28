'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, Check, Download, Pencil, Lock, Inbox, Info, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SOURCE_LABEL } from '@/lib/marketing/classification';
import { SURVEY_TEMPLATE_LABELS, type SurveyTemplate } from '@/lib/marketing/surveyTemplates';
import type { RecentSubmissionRow } from '@/lib/marketing/campaigns';
import type { CampaignStatus, CampaignType, LeadSource } from '@/types/database';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDateTime } from '@/lib/formatDate';

export interface CampaignDetail {
  id: string;
  name: string;
  code: string | null;
  slug: string;
  campaign_type: CampaignType;
  source: LeadSource;
  city: string | null;
  state: string | null;
  country: string | null;
  venue: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  default_language: string;
  owner_user_id: string | null;
  status: CampaignStatus;
  public_title: string | null;
  public_description: string | null;
  consent_text_version: string;
  survey_template: string;
  created_at: string;
  closed_at: string | null;
  publicUrl: string;
  publicPath: string;
}

export interface CampaignStatsShape {
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

interface Props {
  campaign: CampaignDetail;
  ownerName: string | null;
  canEdit: boolean;
  stats: CampaignStatsShape;
  recentSubmissions: RecentSubmissionRow[];
}

const CAMPAIGN_TYPE_LABEL: Record<CampaignType, string> = { trade_fair: 'Trade Fair', event: 'Event' };
const STATUS_LABEL: Record<CampaignStatus, string> = { draft: 'Draft', active: 'Active', paused: 'Paused', closed: 'Closed' };
const STATUS_TONE: Record<CampaignStatus, string> = { draft: 't0', active: 't6', paused: 't7', closed: 't10' };
const SUBMISSION_STATUS_LABEL: Record<string, string> = {
  processed: 'Processed', needs_review: 'Needs review', rejected_spam: 'Rejected (spam)', failed: 'Failed',
};

// Figma "Campaign detail" (node 276:20806).
const HEADING_TEXT = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const CARD = 'rounded-[8px] border border-ui-divider bg-ui-page-bg p-5';
const LABEL = 'mb-[7px] block text-[12px] font-medium leading-4 text-ui-body';
const READONLY_FIELD = 'flex min-h-[42px] min-w-0 flex-1 items-center rounded-[6px] bg-ui-hover-bg px-3 text-[14px] leading-[1.4] text-ui-body';
const NAVY_BTN = 'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[6px] border-0 bg-[var(--color-secondary-700)] px-4 text-[13px] font-medium text-white no-underline hover:brightness-110 disabled:opacity-50 dark:bg-[var(--ui-tab-badge)] [&_svg]:size-4';
const TONE_BTN = 'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[6px] border-0 px-4 text-[13px] font-medium no-underline hover:brightness-95 disabled:opacity-50 [&_svg]:size-4';
const DATE_SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Nice axis maximum: the next multiple of 10 (or 5 below 10) at or above the largest bar. */
function axisMax(n: number): number {
  if (n <= 0) return 10;
  const step = n < 10 ? 5 : 10;
  return Math.ceil(n / step) * step;
}

export function CampaignDetailClient({ campaign, ownerName, canEdit, stats, recentSubmissions }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [today] = useState(() => DATE_SHORT.format(new Date()));

  useEffect(() => {
    let cancelled = false;
    import('qrcode').then(QRCode => QRCode.toDataURL(campaign.publicUrl, { width: 320, margin: 1 }))
      .then(url => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); });
    return () => { cancelled = true; };
  }, [campaign.publicUrl]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(campaign.publicUrl);
      setCopied(true);
      toast.success('Survey link copied');
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error('Could not copy link'); }
  }

  function downloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `${campaign.slug}-qr.png`;
    a.click();
  }

  // Same endpoints as before (activate / pause / close) plus the list page's trash endpoint.
  async function runAction(action: 'activate' | 'pause' | 'close' | 'trash', confirmMessage: string) {
    if (!window.confirm(confirmMessage)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaign.id}/${action}`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Could not update campaign'); return; }
      if (action === 'trash') {
        toast.success('Campaign deleted');
        router.push('/marketing/campaigns');
      } else {
        toast.success('Campaign updated');
      }
      router.refresh();
    } catch {
      toast.error('Could not update campaign');
    } finally {
      setBusy(false);
    }
  }

  const isClosed = campaign.status === 'closed';
  const tone = STATUS_TONE[campaign.status];
  const subtitle = [
    CAMPAIGN_TYPE_LABEL[campaign.campaign_type],
    SOURCE_LABEL[campaign.source] !== CAMPAIGN_TYPE_LABEL[campaign.campaign_type] ? SOURCE_LABEL[campaign.source] : null,
    campaign.city ? [campaign.city, campaign.state].filter(Boolean).join(', ') : null,
    ownerName ? `Owner: ${ownerName}` : null,
  ].filter(Boolean).join(' · ');

  const bars = [
    { label: 'New Prospects', value: stats.newProspects },
    { label: 'Existing Prospects', value: stats.existingProspects },
    { label: 'Needs Created', value: stats.needsCreated },
    { label: 'Needs Review', value: stats.needsReview },
    { label: 'Rejected (Spam)', value: stats.rejectedSpam },
    { label: 'Potentials', value: stats.potentials },
    { label: 'Opportunities', value: stats.opportunities },
  ];
  const max = axisMax(Math.max(0, ...bars.map(b => b.value)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(max * f));
  const share = (n: number) => (stats.totalSubmissions > 0 ? `${((n / stats.totalSubmissions) * 100).toFixed(1)}%` : '—');

  return (
    <div className="flex flex-col gap-5">
      {/* Heading + actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-[5px] leading-[1.35]">
          <div className="flex items-center gap-3">
            <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING_TEXT)}>{campaign.name}</h1>
            <span
              className="inline-flex items-center rounded-[4px] px-2.5 py-[3px] text-[11px] font-medium uppercase leading-4"
              style={{ background: `var(--status-${tone}-fg)`, color: '#fff' }}
            >
              {STATUS_LABEL[campaign.status]}
            </span>
          </div>
          <p className="m-0 text-[13px] text-ui-body">{subtitle}</p>
        </div>
        {canEdit && !isClosed && (
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button" className={TONE_BTN} disabled={busy}
              style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}
              onClick={() => runAction('trash', `Delete "${campaign.name}"? Its public survey link stops working immediately. It stays in the database (recoverable), but disappears everywhere in the UI.`)}
            >
              <Trash2 aria-hidden /> Delete
            </button>
            {campaign.status === 'active' ? (
              <button
                type="button" className={TONE_BTN} disabled={busy}
                style={{ background: 'var(--status-t7-bg)', color: 'var(--status-t7-fg)' }}
                onClick={() => runAction('pause', 'Make this campaign inactive? The survey link stops accepting responses until it is made active again.')}
              >
                <ToggleLeft aria-hidden /> Make Inactive
              </button>
            ) : (
              <button
                type="button" className={TONE_BTN} disabled={busy}
                style={{ background: 'var(--status-t6-bg)', color: 'var(--status-t6-fg)' }}
                onClick={() => runAction('activate', 'Make this campaign active? The survey link will start accepting responses.')}
              >
                <ToggleRight aria-hidden /> Make Active
              </button>
            )}
            <button
              type="button" className={cn(TONE_BTN, 'border border-ui-input-border bg-ui-input-bg text-ui-body')} disabled={busy}
              title="Close permanently — the survey link stops accepting responses for good"
              onClick={() => runAction('close', 'Close this campaign permanently? This cannot be undone — the survey link will stop accepting responses for good.')}
            >
              <Lock aria-hidden /> Close
            </button>
            <Link href={`/marketing/campaigns/${campaign.id}/edit`} className={NAVY_BTN}>
              <Pencil aria-hidden /> Edit Campaign
            </Link>
          </div>
        )}
      </div>

      {/* Link + QR */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_305px]">
        <div className={cn(CARD, 'flex flex-col gap-8')}>
          <div>
            <span className={LABEL}>Public Survey Link</span>
            <div className="flex items-stretch gap-2">
              <code className={cn(READONLY_FIELD, 'break-all font-[inherit]')}>{campaign.publicUrl}</code>
              <button type="button" className={NAVY_BTN} onClick={copyLink} aria-label="Copy public survey link">
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <span
              className="mt-3.5 inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-[11px] leading-4"
              style={{ background: 'var(--status-t2-bg)', color: 'var(--status-t2-fg)' }}
            >
              <Info size={13} aria-hidden /> This link never changes, even if the campaign is renamed.
            </span>
          </div>
          <div>
            <span className={LABEL}>Survey Template</span>
            <div className={READONLY_FIELD}>
              {SURVEY_TEMPLATE_LABELS[campaign.survey_template as SurveyTemplate] ?? campaign.survey_template}
            </div>
            {canEdit && !isClosed && campaign.survey_template === 'none' && (
              <Link href={`/marketing/campaigns/${campaign.id}/edit`} className="mt-2 inline-block text-[12px] text-ui-link">
                Pick a survey template →
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-7 rounded-[8px] border border-ui-divider bg-ui-surface p-6">
          <div className="rounded-[8px] bg-white p-4">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt={`QR code linking to ${campaign.publicUrl}`} width={188} height={188} className="block" />
            ) : (
              <div className="size-[188px] rounded-[6px] bg-ui-surface" aria-hidden />
            )}
          </div>
          <button type="button" className={cn(NAVY_BTN, 'px-7')} onClick={downloadQr} disabled={!qrDataUrl}>
            <Download aria-hidden /> Download as PNG
          </button>
        </div>
      </div>

      {/* Results + recent submissions */}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className={cn(CARD, 'flex flex-col gap-4')} aria-labelledby="campaign-submissions-title">
          <div>
            <h2 id="campaign-submissions-title" className={cn('m-0 text-[17px] font-semibold', HEADING_TEXT)}>Submissions</h2>
            <p className="m-0 text-[11px] text-ui-text-secondary">Current pipeline · {today}</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className={cn('text-[24px] font-semibold', HEADING_TEXT)}>{stats.totalSubmissions} Total</span>
            <span
              className="rounded-[6px] px-3 py-1.5 text-[13px] font-semibold"
              style={{ background: 'var(--status-t6-bg)', color: 'var(--status-t6-fg)' }}
            >
              {stats.conversionRate}% Conversion
            </span>
          </div>

          <div role="table" aria-label="Submissions by outcome" className="flex flex-col gap-2 text-[11px]">
            <div role="row" className="grid grid-cols-[120px_minmax(0,1fr)_40px_48px] items-center gap-3 text-ui-text-secondary">
              <span role="columnheader">Type</span>
              <span role="columnheader">Count Graph</span>
              <span role="columnheader" className="text-right">Count</span>
              <span role="columnheader" className="text-right">Share</span>
            </div>
            {bars.map(b => (
              <div key={b.label} role="row" className="grid grid-cols-[120px_minmax(0,1fr)_40px_48px] items-center gap-3">
                <span role="cell" className="truncate text-[12px] text-ui-body">{b.label}</span>
                <span role="cell" className="h-5 overflow-hidden rounded-[2px] bg-ui-surface">
                  <span
                    className="block h-full rounded-[2px] bg-[var(--color-secondary-700)] dark:bg-[var(--ui-tab-badge)]"
                    style={{ width: `${(b.value / max) * 100}%` }}
                  />
                </span>
                <span role="cell" className={cn('text-right text-[13px] font-semibold', HEADING_TEXT)}>{b.value}</span>
                <span role="cell" className="text-right text-ui-text-secondary">{share(b.value)}</span>
              </div>
            ))}
            <div className="grid grid-cols-[120px_minmax(0,1fr)_40px_48px] gap-3 text-[10px] text-ui-text-secondary" aria-hidden>
              <span />
              <span className="flex justify-between">{ticks.map(t => <span key={t}>{t}</span>)}</span>
              <span />
              <span />
            </div>
          </div>
        </section>

        <section className={cn(CARD, 'flex min-w-0 flex-col gap-4')} aria-labelledby="campaign-recent-title">
          <h2 id="campaign-recent-title" className={cn('m-0 text-[17px] font-semibold', HEADING_TEXT)}>Recent Submissions</h2>
          {recentSubmissions.length === 0 ? (
            <EmptyState size="sm" className="justify-center px-4 py-6" icon={<Inbox />} title="No submissions yet." />
          ) : (
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full border-collapse text-[11px]">
                <thead className="sticky top-0 bg-ui-page-bg">
                  <tr className="border-b border-ui-divider text-left text-ui-text-secondary">
                    <th className="py-2 pr-2 font-normal">Submitted</th>
                    <th className="px-2 py-2 font-normal">Status</th>
                    <th className="px-2 py-2 font-normal">Email</th>
                    <th className="py-2 pl-2 font-normal">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSubmissions.map(s => (
                    <tr key={s.id} className="border-b border-ui-divider last:border-b-0 text-ui-body">
                      <td className="whitespace-nowrap py-3 pr-2">{formatDateTime(s.submitted_at)}</td>
                      <td className="px-2 py-3">{SUBMISSION_STATUS_LABEL[s.status] ?? s.status}</td>
                      <td className="max-w-[200px] truncate px-2 py-3">{s.normalized_email ?? '—'}</td>
                      <td className="whitespace-nowrap py-3 pl-2">{s.normalized_phone ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
