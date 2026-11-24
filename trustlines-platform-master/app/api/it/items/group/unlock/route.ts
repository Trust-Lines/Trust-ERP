import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { GROUP_COOKIE, GROUP_UNLOCK_SECONDS, groupPasswordOk, makeGroupToken } from '@/lib/it/groupLock';

// Item → Add to Set: unlock grouping with the IT group password (edit.it first). A correct password
// sets a signed httpOnly cookie for 30 minutes; a wrong one is audited and slowed down.
export async function POST(req: NextRequest) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const body = await req.json().catch(() => null) as { password?: unknown } | null;

  if (!groupPasswordOk(body?.password)) {
    await new Promise(r => setTimeout(r, 800));
    await logAudit({ actorId: ctx.userId, action: 'it.group_unlock_failed', resource: 'it_items:group' });
    return NextResponse.json({ error: 'Wrong password' }, { status: 403 });
  }
  const token = makeGroupToken(ctx.userId);
  if (!token) return NextResponse.json({ error: 'Grouping is not available: APP_ENCRYPTION_KEY is not set' }, { status: 503 });

  await logAudit({ actorId: ctx.userId, action: 'it.group_unlocked', resource: 'it_items:group' });
  const res = NextResponse.json({ ok: true, expiresIn: GROUP_UNLOCK_SECONDS });
  res.cookies.set(GROUP_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: GROUP_UNLOCK_SECONDS,
  });
  return res;
}
