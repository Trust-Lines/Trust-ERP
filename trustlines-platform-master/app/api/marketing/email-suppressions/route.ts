import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_MANAGE_ROLES, MARKETING_READ_ROLES, MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { isEmail, normalizeEmail } from '@/lib/email/compose';

// "Do not email" list: unsubscribes (automatic), bounces and addresses added by hand.
export async function GET(req: NextRequest) {
  const { admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().toLowerCase().replace(/[%,()\\]/g, '');
  let query = admin.from('email_suppressions').select('email, reason, campaign_id, note, created_at').order('created_at', { ascending: false }).limit(500);
  if (q) query = query.ilike('email', `%${q}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Could not load the list' }, { status: 500 });
  return NextResponse.json({ suppressions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const b = await req.json().catch(() => ({})) as { email?: string; note?: string };
  if (!isEmail(b.email)) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  const email = normalizeEmail(b.email);
  const { error } = await admin.from('email_suppressions')
    .upsert({ email, reason: 'manual', note: b.note?.trim().slice(0, 300) || null, created_by: user.id }, { onConflict: 'email', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: 'Could not add the address' }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'email_suppression.added', resource: `email:${email}` });
  return NextResponse.json({ ok: true });
}

// Removing an unsubscribe means emailing someone who said no — managers only, with a reason in the audit log.
export async function DELETE(req: NextRequest) {
  const { user, admin, deny } = await requireRole(MARKETING_MANAGE_ROLES, 'Only a Marketing manager can remove an address from the list');
  if (deny) return deny;
  const b = await req.json().catch(() => ({})) as { email?: string; reason?: string };
  if (!isEmail(b.email)) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  if (!b.reason?.trim()) return NextResponse.json({ error: 'Say why (e.g. “asked to be re-added by email on …”)' }, { status: 400 });
  const email = normalizeEmail(b.email);
  const { error } = await admin.from('email_suppressions').delete().eq('email', email);
  if (error) return NextResponse.json({ error: 'Could not remove the address' }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'email_suppression.removed', resource: `email:${email}`, newValue: { reason: b.reason.trim() } });
  return NextResponse.json({ ok: true });
}
