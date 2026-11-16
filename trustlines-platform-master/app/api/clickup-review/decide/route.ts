import { NextResponse } from 'next/server';
import { requireApiPage } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { REVIEW_DECISION_ACTION } from '@/lib/clickup/dailySync';

export const dynamic = 'force-dynamic';
const TABLES = ['prospects', 'prospect_contacts'] as const;
const REF = /^[a-z0-9]{5,30}$/i;

// ClickUp Review → a decision on one held ClickUp contact.
//   POST { ref, decision: 'link', matchTable, matchId, name }  same person: the app record gets the
//        ClickUp id (only if it has none), so the nightly sync treats it as imported and brings in
//        the projects waiting for it. Nothing else on the record changes.
//   POST { ref, decision: 'add_new', name }  someone else: the next nightly sync adds it as new.
// Every decision is written to the audit log (the sync reads the add_new ones from there).
export async function POST(req: Request) {
  const { user, admin, deny } = await requireApiPage('page.clickup_review');
  if (deny) return deny;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const ref = typeof body?.ref === 'string' ? body.ref.trim() : '';
  const decision = body?.decision;
  const name = typeof body?.name === 'string' ? body.name.slice(0, 200) : null;
  if (!REF.test(ref) || (decision !== 'link' && decision !== 'add_new')) return NextResponse.json({ error: 'Missing ClickUp item or decision' }, { status: 400 });

  let matchTable: (typeof TABLES)[number] | null = null;
  let matchId: string | null = null;
  if (decision === 'link') {
    matchTable = TABLES.find(t => t === body?.matchTable) ?? null;
    matchId = typeof body?.matchId === 'string' && /^[0-9a-f-]{36}$/i.test(body.matchId) ? body.matchId : null;
    if (!matchTable || !matchId) return NextResponse.json({ error: 'Which app record is it?' }, { status: 400 });

    // The ClickUp item must not be in the app already (linked or imported meanwhile).
    const [p, c] = await Promise.all([
      admin.from('prospects').select('id').eq('external_source', 'clickup').eq('external_ref', ref).limit(1),
      admin.from('prospect_contacts').select('id').eq('external_source', 'clickup').eq('external_ref', ref).limit(1),
    ]);
    if ((p.data ?? []).length || (c.data ?? []).length) return NextResponse.json({ error: 'This ClickUp contact is already in the app.' }, { status: 409 });

    // Only a record without a ClickUp id of its own.
    const { data: updated, error } = await admin.from(matchTable).update({ external_source: 'clickup', external_ref: ref })
      .eq('id', matchId).is('external_ref', null).select('id');
    if (error) return NextResponse.json({ error: 'Could not link the record' }, { status: 500 });
    if (!(updated ?? []).length) return NextResponse.json({ error: 'That app record is already linked to another ClickUp item.' }, { status: 409 });
  }

  await logAudit({ actorId: user.id, action: REVIEW_DECISION_ACTION, resource: `clickup:${ref}`, newValue: { ref, decision, name, matchTable, matchId } });
  return NextResponse.json({ ok: true });
}
