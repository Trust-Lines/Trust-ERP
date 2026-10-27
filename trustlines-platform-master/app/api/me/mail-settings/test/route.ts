import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { friendlySmtpError, loadSender, transportFor } from '@/lib/email/mailSettings';
import { sendTestEmail } from '@/lib/email/sender';

/* eslint-disable @typescript-eslint/no-explicit-any */

// "Send test email": logs in to the person's SMTP server and sends them an email, then marks
// the settings verified (or stores the reason it failed).
export async function POST() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const admin = createAdminClient() as any;
  const sender = await loadSender(admin, user.id).catch(() => null);
  if (!sender) return NextResponse.json({ error: 'Save your email settings first' }, { status: 400 });

  const transport = transportFor(sender);
  try {
    await transport.verify();
  } catch (e) {
    const message = friendlySmtpError(e);
    await admin.from('user_mail_settings').update({ last_error: message, verified_at: null }).eq('user_id', user.id);
    return NextResponse.json({ error: message }, { status: 422 });
  } finally {
    transport.close();
  }

  try {
    const { to } = await sendTestEmail(admin, user.id, {
      subject: 'Your ERP email is connected',
      html: '<p>Hi {{first_name}},</p><p>This is a test from the Trust-Lines ERP. Emails you send from Contacts and the email campaigns you launch will come from this mailbox.</p>',
      campaign: false,
    });
    await admin.from('user_mail_settings').update({ verified_at: new Date().toISOString(), last_error: null }).eq('user_id', user.id);
    return NextResponse.json({ ok: true, to });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sending failed';
    await admin.from('user_mail_settings').update({ last_error: message, verified_at: null }).eq('user_id', user.id);
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
