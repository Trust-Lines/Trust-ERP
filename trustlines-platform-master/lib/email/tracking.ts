/* eslint-disable @typescript-eslint/no-explicit-any */

// Recording what recipients do with an email: opens (tracking pixel), clicks (redirect) and
// unsubscribes. Called from the public /api/public/email/* routes — the token in the link is
// the only identifier, so nothing here trusts anything else from the request.

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
export const isToken = (t: string) => TOKEN_RE.test(t);

interface MessageRef { id: string; to_email: string; campaign_id: string | null; opened_at: string | null; clicked_at: string | null; open_count: number; click_count: number; unsubscribed_at: string | null }

export async function messageByToken(admin: any, token: string): Promise<MessageRef | null> {
  if (!isToken(token)) return null;
  const { data } = await admin.from('email_messages')
    .select('id, to_email, campaign_id, opened_at, clicked_at, open_count, click_count, unsubscribed_at').eq('token', token).maybeSingle();
  return data as MessageRef | null;
}

const ua = (s: string | null) => (s ?? '').slice(0, 300) || null;

export async function recordOpen(admin: any, token: string, userAgent: string | null) {
  const m = await messageByToken(admin, token);
  if (!m) return;
  const now = new Date().toISOString();
  await admin.from('email_messages').update({ open_count: m.open_count + 1, opened_at: m.opened_at ?? now }).eq('id', m.id);
  await admin.from('email_events').insert({ message_id: m.id, type: 'open', user_agent: ua(userAgent) });
}

export async function recordClick(admin: any, token: string, url: string, userAgent: string | null) {
  const m = await messageByToken(admin, token);
  if (!m) return;
  const now = new Date().toISOString();
  // A click means it was opened, even when images (the pixel) were blocked.
  await admin.from('email_messages').update({
    click_count: m.click_count + 1, clicked_at: m.clicked_at ?? now, opened_at: m.opened_at ?? now, open_count: Math.max(1, m.open_count),
  }).eq('id', m.id);
  await admin.from('email_events').insert({ message_id: m.id, type: 'click', url: url.slice(0, 2000), user_agent: ua(userAgent) });
}

/** Adds the address to the do-not-email list. Returns the address, or null for an unknown link. */
export async function unsubscribe(admin: any, token: string, userAgent: string | null): Promise<string | null> {
  const m = await messageByToken(admin, token);
  if (!m) return null;
  const email = m.to_email.toLowerCase();
  await admin.from('email_suppressions').upsert({ email, reason: 'unsubscribed', campaign_id: m.campaign_id }, { onConflict: 'email', ignoreDuplicates: true });
  if (!m.unsubscribed_at) {
    await admin.from('email_messages').update({ unsubscribed_at: new Date().toISOString() }).eq('id', m.id);
    await admin.from('email_events').insert({ message_id: m.id, type: 'unsubscribe', user_agent: ua(userAgent) });
  }
  // Anything still queued for this address (other campaigns) won't go out.
  await admin.from('email_messages').update({ status: 'skipped', error: 'Unsubscribed' }).eq('to_email', email).eq('status', 'queued');
  return email;
}
