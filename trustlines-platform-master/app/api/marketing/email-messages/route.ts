import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES } from '@/lib/marketing/roles';
import { canSeeAllCampaigns } from '@/lib/email/campaignAccess';
import { isNotReady } from '@/lib/email/campaigns';

/* eslint-disable @typescript-eslint/no-explicit-any */

// "Sent emails": every email the ERP sent (campaigns + one-to-one), with totals for the period.
// Managers see everyone's; anyone else sees only the emails they sent themselves.

const PAGE = 50;
const PERIODS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
const COLS = 'id, kind, campaign_id, prospect_id, sender_user_id, to_email, to_name, subject, status, error, sent_at, opened_at, open_count, clicked_at, click_count, unsubscribed_at, created_at';

export async function GET(req: NextRequest) {
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;

  const url = new URL(req.url);
  const days = PERIODS[url.searchParams.get('period') ?? '30d'] ?? 30;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const kind = url.searchParams.get('kind') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const q = (url.searchParams.get('q') ?? '').trim().replace(/[%,()\\]/g, '').slice(0, 100);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const seeAll = canSeeAllCampaigns(role);
  const sender = seeAll ? (url.searchParams.get('sender') ?? '') : user.id;

  // Everything the person may see in the period (tests are never counted).
  const scoped = (query: any) => {
    let x = query.neq('kind', 'test').gte('created_at', since);
    if (sender) x = x.eq('sender_user_id', sender);
    return x;
  };

  let list = scoped(admin.from('email_messages').select(COLS, { count: 'exact' }));
  if (kind === 'campaign' || kind === 'direct') list = list.eq('kind', kind);
  if (status === 'opened') list = list.not('opened_at', 'is', null);
  else if (status === 'clicked') list = list.not('clicked_at', 'is', null);
  else if (status === 'unsubscribed') list = list.not('unsubscribed_at', 'is', null);
  else if (['queued', 'sent', 'failed', 'skipped'].includes(status)) list = list.eq('status', status);
  if (q) list = list.or(`to_email.ilike.%${q}%,to_name.ilike.%${q}%,subject.ilike.%${q}%`);
  const listRes = await list.order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (listRes.error) {
    if (isNotReady(listRes.error)) return NextResponse.json({ error: 'Email isn’t set up yet (migration 129).' }, { status: 503 });
    console.error('[email-messages]', listRes.error.message);
    return NextResponse.json({ error: 'Could not load the emails' }, { status: 500 });
  }

  // Totals for the period, read from the delivered emails only (bounded: 20k rows is far
  // above what the daily limits allow in a year for this team).
  const { data: sentRows } = await scoped(admin.from('email_messages').select('to_email, sender_user_id, kind, opened_at, clicked_at, unsubscribed_at'))
    .eq('status', 'sent').limit(20_000);
  const rows = (sentRows ?? []) as { to_email: string; sender_user_id: string | null; kind: string; opened_at: string | null; clicked_at: string | null; unsubscribed_at: string | null }[];
  const bySender = new Map<string, number>();
  for (const r of rows) if (r.sender_user_id) bySender.set(r.sender_user_id, (bySender.get(r.sender_user_id) ?? 0) + 1);
  const [{ count: failed }, { count: queued }] = await Promise.all([
    scoped(admin.from('email_messages').select('id', { count: 'exact', head: true })).eq('status', 'failed'),
    scoped(admin.from('email_messages').select('id', { count: 'exact', head: true })).eq('status', 'queued'),
  ]);

  const pageRows = (listRes.data ?? []) as { sender_user_id: string | null; campaign_id: string | null }[];
  const peopleIds = [...new Set([...bySender.keys(), ...pageRows.map(r => r.sender_user_id).filter((v): v is string => !!v)])];
  const campaignIds = [...new Set(pageRows.map(r => r.campaign_id).filter((v): v is string => !!v))];
  const [{ data: people }, { data: campaigns }] = await Promise.all([
    peopleIds.length ? admin.from('profiles').select('id, full_name, email').in('id', peopleIds) : { data: [] },
    campaignIds.length ? admin.from('email_campaigns').select('id, name').in('id', campaignIds) : { data: [] },
  ]);
  const nameOf = new Map(((people ?? []) as { id: string; full_name: string | null; email: string }[]).map(p => [p.id, p.full_name || p.email]));

  return NextResponse.json({
    summary: {
      days,
      sent: rows.length,
      recipients: new Set(rows.map(r => r.to_email.toLowerCase())).size,
      direct: rows.filter(r => r.kind === 'direct').length,
      campaign: rows.filter(r => r.kind === 'campaign').length,
      opened: rows.filter(r => r.opened_at).length,
      clicked: rows.filter(r => r.clicked_at).length,
      unsubscribed: rows.filter(r => r.unsubscribed_at).length,
      failed: failed ?? 0,
      queued: queued ?? 0,
      bySender: [...bySender.entries()].map(([id, sent]) => ({ id, name: nameOf.get(id) ?? 'Former user', sent })).sort((a, b) => b.sent - a.sent),
    },
    emails: listRes.data ?? [],
    total: listRes.count ?? 0,
    pageSize: PAGE,
    senders: Object.fromEntries(nameOf),
    campaigns: Object.fromEntries(((campaigns ?? []) as { id: string; name: string }[]).map(c => [c.id, c.name])),
    seeAll,
  });
}
