import { NextResponse } from 'next/server';
import { requireApiPage } from '@/lib/permissions/requireApi';
import { REVIEW_DECISION_ACTION, type SyncReport } from '@/lib/clickup/dailySync';

export const dynamic = 'force-dynamic';

// Admin → ClickUp Review: what the ClickUp sync couldn't bring in on its own.
//   GET → { checkedAt, source, held, skipped, decisions }
// held    = ClickUp contacts that look like a record added by hand in the app (or share an email);
// skipped = ClickUp projects waiting for such a contact. From the latest nightly run or "Check now"
// (both stored in audit_log), plus the decisions already taken here.
const SYNC_ACTIONS = ['clickup.daily_sync', 'clickup.review_check'];

interface ReviewMatch { table: 'prospects' | 'prospect_contacts'; id: string; name: string; email: string | null; phone: string | null; prospectId: string | null }

export async function GET() {
  const { admin, deny } = await requireApiPage('page.clickup_review');
  if (deny) return deny;

  const { data: runs, error } = await admin.from('audit_log').select('created_at, action, new_value')
    .in('action', SYNC_ACTIONS).order('created_at', { ascending: false }).limit(1);
  if (error) return NextResponse.json({ error: 'Could not read the ClickUp sync report' }, { status: 500 });
  const run = (runs ?? [])[0] as { created_at: string; action: string; new_value: { report?: SyncReport } | null } | undefined;
  const report = run?.new_value?.report;

  const { data: decisionRows } = await admin.from('audit_log').select('created_at, new_value')
    .eq('action', REVIEW_DECISION_ACTION).order('created_at', { ascending: true }).limit(5000);
  const decisions: Record<string, { decision: 'link' | 'add_new'; at: string }> = {};
  for (const d of (decisionRows ?? []) as { created_at: string; new_value: { ref?: string; decision?: 'link' | 'add_new' } | null }[]) {
    if (d.new_value?.ref && d.new_value.decision) decisions[d.new_value.ref] = { decision: d.new_value.decision, at: d.created_at };
  }

  const held = report?.contacts.held ?? [];
  // The app records the held contacts look like, to show side by side.
  const ids = (t: 'prospects' | 'prospect_contacts') => [...new Set(held.filter(h => h.match?.table === t).map(h => h.match!.id))];
  const [pRes, cRes] = await Promise.all([
    ids('prospects').length ? admin.from('prospects').select('id, display_name, main_email, main_phone').in('id', ids('prospects')) : { data: [] },
    ids('prospect_contacts').length ? admin.from('prospect_contacts').select('id, prospect_id, name, email, phone').in('id', ids('prospect_contacts')) : { data: [] },
  ]);
  const records = new Map<string, ReviewMatch>();
  for (const p of (pRes.data ?? []) as { id: string; display_name: string | null; main_email: string | null; main_phone: string | null }[]) {
    records.set(`prospects:${p.id}`, { table: 'prospects', id: p.id, name: p.display_name ?? '—', email: p.main_email, phone: p.main_phone, prospectId: p.id });
  }
  for (const c of (cRes.data ?? []) as { id: string; prospect_id: string; name: string | null; email: string | null; phone: string | null }[]) {
    records.set(`prospect_contacts:${c.id}`, { table: 'prospect_contacts', id: c.id, name: c.name ?? '—', email: c.email, phone: c.phone, prospectId: c.prospect_id });
  }

  return NextResponse.json({
    checkedAt: run?.created_at ?? null,
    source: run ? (run.action === 'clickup.review_check' ? 'check' : 'nightly') : null,
    held: held.map(h => ({ ...h, matchRecord: h.match ? records.get(`${h.match.table}:${h.match.id}`) ?? null : null })),
    skipped: (report?.deals.skipped ?? []),
    decisions,
  });
}
