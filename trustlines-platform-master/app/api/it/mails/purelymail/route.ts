import { NextRequest, NextResponse } from 'next/server';
import { itApi } from '@/lib/it/server';
import { logAudit } from '@/lib/audit/log';
import { cleanNewMailbox, createPurelymailMailbox, listPurelymailMailboxes } from '@/lib/it/purelymail';
import { purelymailFailure } from '@/lib/it/purelymailHttp';

export const dynamic = 'force-dynamic';

// IT → Mails → Purelymail section. Nothing is stored here; passwords never touch our database or logs.
//   GET  (page.it)  → 200 { mailboxes: { address }[] } (may be empty)
//   POST (edit.it)  { userName, domainName, password, recoveryEmail? } → 201 { address }
// Failures: 503 { code: 'not_configured' } (no PURELYMAIL_API_KEY), 502 { code: 'unauthorized' |
// 'unavailable' }, 422 { code: 'rejected', providerCode } (Purelymail said no, e.g. name taken).
// The provider is only called after the permission check.
export async function GET() {
  const { deny } = await itApi('manage');
  if (deny) return deny;
  const r = await listPurelymailMailboxes();
  if (r.ok) return NextResponse.json({ mailboxes: r.addresses.map(address => ({ address })) });
  return purelymailFailure(r);
}

export async function POST(req: NextRequest) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const input = cleanNewMailbox(await req.json().catch(() => null));
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });

  const r = await createPurelymailMailbox(input.value);
  if (!r.ok) return purelymailFailure(r);
  const address = `${input.value.userName}@${input.value.domainName}`;
  await logAudit({ actorId: ctx.userId, action: 'it.mailbox_created', resource: `purelymail:${address}`, newValue: { address, recovery_email: !!input.value.recoveryEmail } });
  return NextResponse.json({ address }, { status: 201 });
}
