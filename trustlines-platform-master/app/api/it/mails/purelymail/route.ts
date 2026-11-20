import { NextResponse } from 'next/server';
import { itApi } from '@/lib/it/server';
import { listPurelymailMailboxes } from '@/lib/it/purelymail';

export const dynamic = 'force-dynamic';

// IT → Mails → Purelymail section: the account's mailbox addresses (read-only, not stored).
// Same permission as the Mails page (page.it). The provider is only called after that check.
//   200 { mailboxes: { address }[] }            — may be an empty list
//   503 { code: 'not_configured' }              — PURELYMAIL_API_KEY isn't set on the server
//   502 { code: 'unauthorized' | 'unavailable' } — key refused / provider unreachable or timed out
export async function GET() {
  const { deny } = await itApi('manage');
  if (deny) return deny;

  const r = await listPurelymailMailboxes();
  if (r.ok) return NextResponse.json({ mailboxes: r.addresses.map(address => ({ address })) });
  return NextResponse.json({ code: r.reason }, { status: r.reason === 'not_configured' ? 503 : 502 });
}
