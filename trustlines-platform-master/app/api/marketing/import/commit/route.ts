import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_MANAGE_ROLES } from '@/lib/marketing/roles';
import { createGroup, mergeGroup, sanitizeGroup, type CommitResult } from '@/lib/marketing/import/commit';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const maxDuration = 60;

// The browser sends the approved groups in small batches (progress bar); each group is written
// independently, so one bad row never blocks the rest. Managers only (bulk write).
const MAX_BATCH = 40;

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole(MARKETING_MANAGE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as { fileLabel?: string; campaignId?: string; groups?: any[] } | null;
  const rawGroups = Array.isArray(body?.groups) ? body!.groups! : [];
  if (!rawGroups.length) return NextResponse.json({ error: 'Nothing to import' }, { status: 400 });
  if (rawGroups.length > MAX_BATCH) return NextResponse.json({ error: `Send at most ${MAX_BATCH} rows per request` }, { status: 413 });

  let campaign: { id: string; name: string; source: string } | null = null;
  if (body?.campaignId) {
    const { data } = await admin.from('marketing_campaigns').select('id, name, source').eq('id', body.campaignId).is('deleted_at', null).maybeSingle();
    if (!data) return NextResponse.json({ error: 'Campaign not found' }, { status: 400 });
    campaign = data as { id: string; name: string; source: string };
  }
  const ctx = { userId: user.id, fileLabel: String(body?.fileLabel ?? 'Excel file').slice(0, 160), campaign };

  const results: CommitResult[] = [];
  for (const raw of rawGroups) {
    const g = sanitizeGroup(raw);
    if (!g) { results.push({ id: String(raw?.id ?? '?'), action: 'skip', prospectId: null, contactsAdded: 0, error: 'Invalid row' }); continue; }
    if (g.action === 'skip') { results.push({ id: g.id, action: 'skip', prospectId: null, contactsAdded: 0 }); continue; }
    try {
      results.push(g.action === 'merge' ? await mergeGroup(admin, ctx, g) : await createGroup(admin, ctx, g));
    } catch (e) {
      console.error('[import/commit]', g.id, e instanceof Error ? e.message : e);
      results.push({ id: g.id, action: g.action, prospectId: null, contactsAdded: 0, error: e instanceof Error ? e.message : 'Failed' });
    }
  }

  await logAudit({
    actorId: user.id, action: 'prospect.import_batch', resource: `campaign:${campaign?.id ?? 'none'}`,
    newValue: {
      file: ctx.fileLabel,
      created: results.filter(r => r.action === 'create' && !r.error).length,
      merged: results.filter(r => r.action === 'merge' && !r.error).length,
      failed: results.filter(r => r.error).length,
    },
  });
  return NextResponse.json({ results });
}
