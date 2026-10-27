import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { encryptToken, tokenKeyConfigured } from '@/lib/crypto/secrets';
import { parseMailSettings, PUBLIC_MAIL_SETTINGS_COLS } from '@/lib/email/mailSettings';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Settings → Email sending: everyone manages their OWN mailbox login. The password is
// encrypted before it's stored and is never returned (only whether one is saved).

const notReady = (e: { message: string; code?: string }) => e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message);

export async function GET() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const admin = createAdminClient() as any;
  const { data, error } = await admin.from('user_mail_settings').select(PUBLIC_MAIL_SETTINGS_COLS).eq('user_id', user.id).maybeSingle();
  if (error) {
    if (notReady(error)) return NextResponse.json({ error: 'Email sending isn’t set up yet (migration 129).' }, { status: 503 });
    console.error('[mail-settings]', error.message);
    return NextResponse.json({ error: 'Could not load your email settings' }, { status: 500 });
  }
  return NextResponse.json({ settings: data ?? null, hasPassword: !!data, encryptionReady: tokenKeyConfigured() });
}

export async function PUT(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  if (!tokenKeyConfigured()) return NextResponse.json({ error: 'The server is missing APP_ENCRYPTION_KEY — ask an admin to set it before saving passwords.' }, { status: 503 });
  const admin = createAdminClient() as any;

  const { data: existing } = await admin.from('user_mail_settings').select('user_id').eq('user_id', user.id).maybeSingle();
  const parsed = parseMailSettings(await req.json().catch(() => null), !!existing);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { smtp_pass, ...rest } = parsed.value;

  const row = {
    ...rest,
    ...(smtp_pass ? { smtp_pass_enc: encryptToken(smtp_pass) } : {}),
    // Any change to the login means it has to be tested again.
    verified_at: null, last_error: null,
  };
  const { data, error } = existing
    ? await admin.from('user_mail_settings').update(row).eq('user_id', user.id).select(PUBLIC_MAIL_SETTINGS_COLS).single()
    : await admin.from('user_mail_settings').insert({ ...row, user_id: user.id }).select(PUBLIC_MAIL_SETTINGS_COLS).single();
  if (error) {
    console.error('[mail-settings]', error.message);
    return NextResponse.json({ error: 'Could not save your email settings' }, { status: 500 });
  }
  await logAudit({ actorId: user.id, action: 'mail_settings.saved', resource: `user:${user.id}`, newValue: { host: rest.smtp_host, from: rest.from_email, passwordChanged: !!smtp_pass } });
  return NextResponse.json({ settings: data, hasPassword: true });
}

export async function DELETE() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const admin = createAdminClient() as any;
  const { error } = await admin.from('user_mail_settings').delete().eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Could not remove your email settings' }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'mail_settings.removed', resource: `user:${user.id}` });
  return NextResponse.json({ ok: true });
}
