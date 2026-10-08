import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { canAccessProspect } from '@/lib/marketing/prospectAccess';
import { createGroup, mergeGroup, sanitizeGroup, type CommitResult } from '@/lib/marketing/import/commit';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const maxDuration = 60;

// The browser sends the approved groups in small batches (progress bar); each group is written
// independently, so one bad row never blocks the rest. Anyone who may edit Contacts can import;
// merging into an existing Contact additionally needs write access to THAT Contact (same rule as editing it).
const MAX_BATCH = 40;

export async function POST(req: NextRequest) {
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as { fileLabel?: string; campaignId?: string; groups?: any[] } | null;
  const rawGroups = Array.isArray(body?.groups) ? body!.groups! : [];
  if (!rawGroups.length) return NextResponse.json({ error: 'Nothing to import' }, { status: 400 });
  if (rawGroups.length > MAX_BATCH) return NextResponse.json({ error: `Send at most ${MAX_BATCH} rows per request` }, { status: 413 });

  if (!body?.campaignId) return NextResponse.json({ error: 'Choose the event / campaign these leads belong to' }, { status: 400 });
  const { data: campaignRow } = await admin.from('marketing_campaigns').select('id, name, source').eq('id', body.campaignId).is('deleted_at', null).maybeSingle();
  if (!campaignRow) return NextResponse.json({ error: 'Campaign not found' }, { status: 400 });
  const campaign = campaignRow as { id: string; name: string; source: string };
  const ctx = { userId: user.id, fileLabel: String(body?.fileLabel ?? 'Excel file').slice(0, 160), campaign };

  const results: CommitResult[] = [];
  for (const raw of rawGroups) {
    const g = sanitizeGroup(raw);
    if (!g) { results.push({ id: String(raw?.id ?? '?'), action: 'skip', prospectId: null, contactsAdded: 0, error: 'Invalid row' }); continue; }
    if (g.action === 'skip') { results.push({ id: g.id, action: 'skip', prospectId: null, contactsAdded: 0 }); continue; }
    try {
      if (g.action === 'merge' && !(g.targetProspectId && await canAccessProspect(admin, g.targetProspectId, user.id, role))) {
        throw new Error('You can only merge into Contacts you are allowed to edit — choose "Add as new" or "Skip"');
      }
      results.push(g.action === 'merge' ? await mergeGroup(admin, ctx, g) : await createGroup(admin, ctx, g));
    } catch (e) {
      console.error('[import/commit]', g.id, e instanceof Error ? e.message : e);
      results.push({ id: g.id, action: g.action, prospectId: null, contactsAdded: 0, error: e instanceof Error ? e.message : 'Failed' });
    }
  }

  await logAudit({
    actorId: user.id, action: 'prospect.import_batch', resource: `campaign:${campaign.id}`,
    newValue: {
      file: ctx.fileLabel,
      notLinkedToCampaign: results.filter(r => r.linked === false).length,
      created: results.filter(r => r.action === 'create' && !r.error).length,
      merged: results.filter(r => r.action === 'merge' && !r.error).length,
      failed: results.filter(r => r.error).length,
    },
  });
  return NextResponse.json({ results });
}
