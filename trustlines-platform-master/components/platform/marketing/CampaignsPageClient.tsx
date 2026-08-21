'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Megaphone, AlertTriangle, Copy, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Pill } from '@/components/platform/shared/Pill';
import type { CampaignStatus, CampaignType } from '@/types/database';

export interface CampaignRow {
  id: string;
  name: string;
  code: string | null;
  slug: string;
  campaign_type: CampaignType;
  source: string;
  city: string | null;
  state: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  status: CampaignStatus;
  owner_user_id: string | null;
  owner_name: string | null;
  created_at: string;
  submission_count: number;
  publicUrl: string;
}

interface Props {
  initialCampaigns: CampaignRow[];
  canEdit?: boolean;
  canSeeAll?: boolean;
  loadError?: boolean;
}

const CAMPAIGN_TYPE_LABEL: Record<CampaignType, string> = { trade_fair: 'Trade Fair', event: 'Event' };
const STATUS_VARIANT: Record<CampaignStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  draft: 'neutral', active: 'success', paused: 'warning', closed: 'danger',
};
const STATUS_LABEL: Record<CampaignStatus, string> = { draft: 'Draft', active: 'Active', paused: 'Paused', closed: 'Closed' };

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          toast.success('Survey link copied');
          setTimeout(() => setCopied(false), 1500);
        } catch { toast.error('Could not copy link'); }
      }}
      title={url}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

export function CampaignsPageClient({ initialCampaigns, canEdit, canSeeAll, loadError }: Props) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>(initialCampaigns);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  async function trashCampaign(e: React.MouseEvent, c: CampaignRow) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${c.name}"? Its public survey link stops working immediately. It stays in the database (recoverable), but disappears everywhere in the UI.`)) return;
    const res = await fetch(`/api/marketing/campaigns/${c.id}/trash`, { method: 'POST' });
    if (!res.ok) { const body = await res.json().catch(() => ({})); toast.error(body.error ?? 'Could not delete'); return; }
    setCampaigns(prev => prev.filter(x => x.id !== c.id));
    toast.success('Deleted');
  }

  const filtered = useMemo(() => {
    return campaigns.filter(c => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (typeFilter && c.campaign_type !== typeFilter) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return c.name.toLowerCase().includes(q)
        || (c.code ?? '').toLowerCase().includes(q)
        || (c.city ?? '').toLowerCase().includes(q)
        || (c.state ?? '').toLowerCase().includes(q)
        || (c.owner_name ?? '').toLowerCase().includes(q);
    });
  }, [campaigns, query, statusFilter, typeFilter]);

  if (loadError) {
    return (
      <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
        <AlertTriangle size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
        <div>Campaigns & Surveys isn&apos;t ready yet. Migration 086 needs to be applied.</div>
      </div></div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Campaigns & Surveys</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}{canSeeAll ? '' : ' — yours'}
          </p>
        </div>
        {canEdit && (
          <Link href="/marketing/campaigns/new" className="btn btn-primary">+ New Campaign</Link>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)' }} />
          <input
            className="form-input" style={{ paddingLeft: 32, fontSize: 13 }}
            placeholder="Search campaigns…" value={query} onChange={e => setQuery(e.target.value)}
            aria-label="Search campaigns"
          />
        </div>
        <select className="form-input" style={{ maxWidth: 160, fontSize: 13 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {(['draft', 'active', 'paused', 'closed'] as CampaignStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select className="form-input" style={{ maxWidth: 160, fontSize: 13 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Filter by type">
          <option value="">All types</option>
          {(['trade_fair', 'event'] as CampaignType[]).map(t => <option key={t} value={t}>{CAMPAIGN_TYPE_LABEL[t]}</option>)}
        </select>
      </div>

      {campaigns.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
          <Megaphone size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <div>No campaigns yet.{canEdit && ' Click "New Campaign" to create the first one.'}</div>
        </div></div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--fg-subtle)' }}>
          No campaigns match your filters.
        </div></div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 1100 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--fg-subtle)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Campaign</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>City / State</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Dates</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Submissions</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Created</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Public Link</th>
                {canEdit && <th style={{ padding: '10px 12px', fontWeight: 600 }}></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/marketing/campaigns/${c.id}`)}
                  style={{ borderTop: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    {c.code && <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{c.code}</div>}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--fg-subtle)' }}>{CAMPAIGN_TYPE_LABEL[c.campaign_type]}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--fg-subtle)' }}>
                    {[c.city, c.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--fg-subtle)' }}>
                    {c.start_date ? `${c.start_date}${c.end_date ? ` → ${c.end_date}` : ''}` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}><Pill variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Pill></td>
                  <td style={{ padding: '10px 12px', color: 'var(--fg-subtle)' }}>{c.submission_count}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--fg-subtle)' }}>{new Date(c.created_at).toLocaleDateString('en-US')}</td>
                  <td style={{ padding: '10px 12px' }}><CopyLinkButton url={c.publicUrl} /></td>
                  {canEdit && (
                    <td style={{ padding: '10px 12px' }}>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-danger)' }} onClick={e => trashCampaign(e, c)} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
