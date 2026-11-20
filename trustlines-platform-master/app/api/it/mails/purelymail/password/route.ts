import { NextRequest, NextResponse } from 'next/server';
import { itApi } from '@/lib/it/server';
import { logAudit } from '@/lib/audit/log';
import { changePurelymailPassword, isMailboxAddress, passwordError } from '@/lib/it/purelymail';
import { purelymailFailure } from '@/lib/it/purelymailHttp';

export const dynamic = 'force-dynamic';

// Change a Purelymail mailbox password (edit.it). { address, newPassword } → 200 { ok: true }.
// The password goes straight to Purelymail: not stored, not logged; the audit says who and which box.
export async function POST(req: NextRequest) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const b = await req.json().catch(() => null) as { address?: unknown; newPassword?: unknown } | null;
  const address = typeof b?.address === 'string' ? b.address.trim().toLowerCase() : '';
  if (!isMailboxAddress(address)) return NextResponse.json({ error: 'Which mailbox?' }, { status: 400 });
  const pw = passwordError(b?.newPassword);
  if (pw) return NextResponse.json({ error: pw }, { status: 400 });

  const r = await changePurelymailPassword(address, b!.newPassword as string);
  if (!r.ok) return purelymailFailure(r);
  await logAudit({ actorId: ctx.userId, action: 'it.mailbox_password_changed', resource: `purelymail:${address}`, newValue: { address } });
  return NextResponse.json({ ok: true });
}
