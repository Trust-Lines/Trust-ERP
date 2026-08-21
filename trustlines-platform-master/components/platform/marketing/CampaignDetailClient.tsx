'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, Check, Download, Pencil, Play, Pause, Lock } from 'lucide-react';
import { Pill } from '@/components/platform/shared/Pill';
import { SOURCE_LABEL } from '@/lib/marketing/classification';
import { SURVEY_TEMPLATE_LABELS, type SurveyTemplate } from '@/lib/marketing/surveyTemplates';
import type { RecentSubmissionRow } from '@/lib/marketing/campaigns';
import type { CampaignStatus, CampaignType, LeadSource } from '@/types/database';

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
const STATUS_VARIANT: Record<CampaignStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  draft: 'neutral', active: 'success', paused: 'warning', closed: 'danger',
};
const STATUS_LABEL: Record<CampaignStatus, string> = { draft: 'Draft', active: 'Active', paused: 'Paused', closed: 'Closed' };
const SUBMISSION_STATUS_LABEL: Record<string, string> = {
  processed: 'Processed', needs_review: 'Needs review', rejected_spam: 'Rejected (spam)', failed: 'Failed',
};

function StatCard({ label, value, tone }: { label: string; value: number | string; tone?: 'warning' | 'danger' }) {
  return (
    <div className="card"><div className="card-body" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--fg-subtle)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: tone === 'warning' ? 'var(--status-warning-fg)' : tone === 'danger' ? 'var(--status-danger-fg)' : 'var(--fg-default)' }}>{value}</div>
    </div></div>
  );
}

export function CampaignDetailClient({ campaign, ownerName, canEdit, stats, recentSubmissions }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function changeStatus(action: 'activate' | 'pause' | 'close', confirmMessage: string) {
    if (!window.confirm(confirmMessage)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaign.id}/${action}`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Could not update campaign'); setBusy(false); return; }
      toast.success('Campaign updated');
      router.refresh();
    } catch {
      toast.error('Could not update campaign');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: 0 }}>{campaign.name}</h1>
            <Pill variant={STATUS_VARIANT[campaign.status]}>{STATUS_LABEL[campaign.status]}</Pill>
          </div>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
            {CAMPAIGN_TYPE_LABEL[campaign.campaign_type]} · {SOURCE_LABEL[campaign.source]}
            {campaign.city ? ` · ${[campaign.city, campaign.state].filter(Boolean).join(', ')}` : ''}
            {ownerName ? ` · Owner: ${ownerName}` : ''}
          </p>
        </div>
        {canEdit && campaign.status !== 'closed' && (
          <Link href={`/marketing/campaigns/${campaign.id}/edit`} className="btn btn-ghost btn-sm">
            <Pencil size={13} /> Edit
          </Link>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--fg-subtle)', marginBottom: 8 }}>Public survey link</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <code style={{ fontSize: 12.5, background: 'var(--bg-sunken)', padding: '6px 10px', borderRadius: 6, wordBreak: 'break-all', flex: 1 }}>{campaign.publicUrl}</code>
              <button className="btn btn-ghost btn-sm" onClick={copyLink} title="Copy link">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', marginBottom: 10 }}>
              This link never changes, even if the campaign is renamed.
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>
              Survey template: <strong style={{ color: 'var(--fg-default)' }}>{SURVEY_TEMPLATE_LABELS[campaign.survey_template as SurveyTemplate] ?? campaign.survey_template}</strong>
              {canEdit && campaign.status !== 'closed' && campaign.survey_template === 'none' && (
                <> — <Link href={`/marketing/campaigns/${campaign.id}/edit`} style={{ color: 'var(--brand-teal-600)' }}>pick one</Link></>
              )}
            </div>

            {canEdit && campaign.status !== 'closed' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                {campaign.status !== 'active' && (
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => changeStatus('activate', 'Activate this campaign? The survey link will start accepting responses.')}>
                    <Play size={13} /> Activate
                  </button>
                )}
                {campaign.status === 'active' && (
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => changeStatus('pause', 'Pause this campaign? The survey link will stop accepting responses until reactivated.')}>
                    <Pause size={13} /> Pause
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-danger-fg)' }} disabled={busy}
                  onClick={() => changeStatus('close', 'Close this campaign permanently? This cannot be undone — the survey link will stop accepting responses for good.')}>
                  <Lock size={13} /> Close
                </button>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--fg-subtle)', marginBottom: 8 }}>QR code</div>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt={`QR code linking to ${campaign.publicUrl}`} width={140} height={140} style={{ borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
            ) : (
              <div style={{ width: 140, height: 140, background: 'var(--bg-subtle)', borderRadius: 8 }} />
            )}
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={downloadQr} disabled={!qrDataUrl}>
                <Download size={13} /> Download PNG
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--fg-subtle)', marginBottom: 8 }}>Results</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        <StatCard label="Total submissions" value={stats.totalSubmissions} />
        <StatCard label="New prospects" value={stats.newProspects} />
        <StatCard label="Existing prospects" value={stats.existingProspects} />
        <StatCard label="Needs created" value={stats.needsCreated} />
        <StatCard label="Needs review" value={stats.needsReview} tone={stats.needsReview > 0 ? 'warning' : undefined} />
        <StatCard label="Rejected (spam)" value={stats.rejectedSpam} tone={stats.rejectedSpam > 0 ? 'danger' : undefined} />
        <StatCard label="Potentials" value={stats.potentials} />
        <StatCard label="Opportunities" value={stats.opportunities} />
        <StatCard label="Conversion rate" value={`${stats.conversionRate}%`} />
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--fg-subtle)', marginBottom: 8 }}>Recent submissions</div>
      {recentSubmissions.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '24px', color: 'var(--fg-subtle)', fontSize: 13 }}>
          No submissions yet.
        </div></div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--fg-subtle)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Submitted</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Email</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Phone</th>
              </tr>
            </thead>
            <tbody>
              {recentSubmissions.map(s => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--fg-subtle)' }}>{new Date(s.submitted_at).toLocaleString()}</td>
                  <td style={{ padding: '10px 12px' }}>{SUBMISSION_STATUS_LABEL[s.status] ?? s.status}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--fg-subtle)' }}>{s.normalized_email ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--fg-subtle)' }}>{s.normalized_phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
