import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_MANAGE_ROLES } from '@/lib/marketing/roles';
import { logAudit } from '@/lib/audit/log';
import { encryptToken, tokenKeyConfigured } from '@/lib/crypto/secrets';
import { fallbackRecipients, parseLeadMailSettings, PUBLIC_LEAD_MAIL_COLS, tableMissing } from '@/lib/web-cms/leadMailSettings';

// Settings → Website leads: who website submissions are emailed to, and the mailbox that sends
// them. The password is encrypted before it's stored and never returned (only whether one is saved).

const NOT_READY = 'Website lead email settings aren’t set up yet — migration 141 (web_lead_mail_settings) needs to be applied.';

export async function GET() {
  const { admin, deny } = await requireRole(MARKETING_MANAGE_ROLES);
  if (deny) return deny;
  const { data, error } = await admin.from('web_lead_mail_settings').select(`${PUBLIC_LEAD_MAIL_COLS}, smtp_pass_enc`).eq('id', true).maybeSingle();
  if (error) {
    if (tableMissing(error)) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    return NextResponse.json({ error: 'Could not load the settings' }, { status: 500 });
  }
  const { smtp_pass_enc, ...settings } = (data ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    settings: data ? settings : null,
    hasPassword: !!smtp_pass_enc,
    fallbackRecipients: fallbackRecipients(),
    encryptionReady: tokenKeyConfigured(),
  });
}

export async function PUT(req: NextRequest) {
  const { user, admin, deny } = await requireRole(MARKETING_MANAGE_ROLES);
  if (deny) return deny;

  const { data: existing, error: loadError } = await admin.from('web_lead_mail_settings').select('smtp_pass_enc').eq('id', true).maybeSingle();
  if (loadError) return NextResponse.json({ error: tableMissing(loadError) ? NOT_READY : 'Could not load the settings' }, { status: tableMissing(loadError) ? 503 : 500 });

  const parsed = parseLeadMailSettings(await req.json().catch(() => null), !!existing?.smtp_pass_enc);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { smtp_pass, clearSender, ...rest } = parsed.value;
  if (smtp_pass && !tokenKeyConfigured()) {
    return NextResponse.json({ error: 'The server is missing APP_ENCRYPTION_KEY — ask an admin to set it before saving passwords.' }, { status: 503 });
  }

  const row = {
    id: true, ...rest,
    ...(clearSender ? { smtp_pass_enc: null } : smtp_pass ? { smtp_pass_enc: encryptToken(smtp_pass) } : {}),
    verified_at: null, last_error: null, updated_by: user.id, updated_at: new Date().toISOString(),
  };
  const { data, error } = await admin.from('web_lead_mail_settings').upsert(row, { onConflict: 'id' }).select(`${PUBLIC_LEAD_MAIL_COLS}, smtp_pass_enc`).single();
  if (error) {
    console.error('[lead-mail-settings]', error.message);
    return NextResponse.json({ error: 'Could not save the settings' }, { status: 500 });
  }
  await logAudit({
    actorId: user.id, action: 'web_lead_mail_settings.saved', resource: 'web_lead_mail_settings',
    newValue: { recipients: rest.recipients, from: rest.from_email, host: rest.smtp_host, passwordChanged: !!smtp_pass },
  });
  const { smtp_pass_enc, ...settings } = data as Record<string, unknown>;
  return NextResponse.json({ settings, hasPassword: !!smtp_pass_enc });
}
