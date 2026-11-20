import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { isUuid } from '@/lib/it/validate';
import { decryptToken } from '@/lib/crypto/secrets';
import { SECRET_COLUMN, type PhoneSecretKind } from '@/lib/it/phones';

// Reveal one secret of a phone line — password, PIN or account number (edit.it). One value per
// request, never cached, every reveal audit-logged (who, which line, which field — not the value).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const { id } = await params;
  const kind = req.nextUrl.searchParams.get('kind') as PhoneSecretKind | null;
  if (!isUuid(id) || !kind || !Object.hasOwn(SECRET_COLUMN, kind)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const col = SECRET_COLUMN[kind];
  const { data } = await ctx.admin.from('it_phone_lines').select(col).eq('id', id).is('deleted_at', null).maybeSingle();
  const stored = (data as Record<string, string | null> | null)?.[col] ?? null;
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!stored) return NextResponse.json({ error: 'Nothing saved for this field' }, { status: 404 });

  let value: string;
  try { value = decryptToken(stored); } catch {
    return NextResponse.json({ error: 'Could not unlock this value (APP_ENCRYPTION_KEY changed or missing)' }, { status: 500 });
  }
  await logAudit({ actorId: ctx.userId, action: 'it.phone_secret_revealed', resource: `it_phone:${id}`, newValue: { field: kind } });
  return NextResponse.json({ value }, { headers: { 'Cache-Control': 'private, no-store' } });
}
