import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { isUuid } from '@/lib/it/validate';
import { decryptToken } from '@/lib/crypto/secrets';

// Reveal a subscription's login password (edit.it). Never cached; every reveal audit-logged (who,
// which subscription — not the value).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data } = await ctx.admin.from('it_subscriptions').select('password_enc').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const stored = (data as { password_enc: string | null }).password_enc;
  if (!stored) return NextResponse.json({ error: 'No password saved' }, { status: 404 });

  let value: string;
  try { value = decryptToken(stored); } catch {
    return NextResponse.json({ error: 'Could not unlock this value (APP_ENCRYPTION_KEY changed or missing)' }, { status: 500 });
  }
  await logAudit({ actorId: ctx.userId, action: 'it.subscription_secret_revealed', resource: `it_subscription:${id}` });
  return NextResponse.json({ value }, { headers: { 'Cache-Control': 'private, no-store' } });
}
