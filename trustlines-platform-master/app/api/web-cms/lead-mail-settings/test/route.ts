import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_MANAGE_ROLES } from '@/lib/marketing/roles';
import { friendlySmtpError } from '@/lib/email/mailSettings';
import { hasOwnSender, leadTransport, loadLeadMailSettings } from '@/lib/web-cms/leadMailSettings';
import { sendLeadMail, webLeadEmail, webLeadRecipients } from '@/lib/web-cms/leadEmail';

// "Send test email": a sample website lead, exactly as a real one looks, to every saved
// recipient through the saved sender. Marks the settings verified, or stores why it failed.
export async function POST() {
  const { admin, deny } = await requireRole(MARKETING_MANAGE_ROLES);
  if (deny) return deny;
  const settings = await loadLeadMailSettings(admin);
  if (!settings) return NextResponse.json({ error: 'Save the settings first' }, { status: 400 });

  const fail = async (message: string) => {
    await admin.from('web_lead_mail_settings').update({ last_error: message, verified_at: null }).eq('id', true);
    return NextResponse.json({ error: message }, { status: 422 });
  };

  if (hasOwnSender(settings)) {
    let transport;
    try { transport = leadTransport(settings); } catch {
      return fail('The saved password can’t be read on this server (APP_ENCRYPTION_KEY changed or is missing). Enter the password again and save.');
    }
    try { await transport.verify(); } catch (e) { return fail(friendlySmtpError(e)); } finally { transport.close(); }
  }

  const { subject, html } = webLeadEmail({
    kind: 'contact', name: 'Test Lead', phone: '+1 (555) 010-0000', email: null, company: 'TEST — Website lead',
    store_location: '123 Main St, Phoenix, AZ', store_condition: 'New Store', store_type: 'C-store',
    message: 'This is a test from Settings → Website leads. Real website submissions will look like this.',
    notes: 'Test note.', consent_accepted: true, consent_text_version: null, source_page: '/contact', utm: null,
  }, new Date());

  const to = webLeadRecipients(settings);
  try {
    for (const r of to) await sendLeadMail(settings, r, `[TEST] ${subject}`, html);
  } catch (e) {
    return fail(friendlySmtpError(e));
  }
  await admin.from('web_lead_mail_settings').update({ verified_at: new Date().toISOString(), last_error: null }).eq('id', true);
  return NextResponse.json({ ok: true, to });
}
