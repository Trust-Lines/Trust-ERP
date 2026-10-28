import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { decryptToken } from '@/lib/crypto/secrets';
import { googleConfigured } from '@/lib/google/oauth';

/* eslint-disable @typescript-eslint/no-explicit-any */

// The person's own Google connection: status (GET) and disconnect (DELETE). Tokens never leave the server.
export async function GET() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const admin = createAdminClient() as any;
  const { data, error } = await admin.from('user_google_connections')
    .select('google_email, scopes, last_sync_at, last_error, created_at').eq('user_id', user.id).maybeSingle();
  if (error) {
    const notReady = error.code === 'PGRST205' || error.code === '42P01';
    return NextResponse.json({ error: notReady ? 'Google connection isn’t set up yet (migration 130).' : 'Could not load the Google connection' }, { status: notReady ? 503 : 500 });
  }
  return NextResponse.json({
    configured: googleConfigured(),
    connection: data ? { ...data, recordings: (data.scopes as string[]).some(s => s.includes('meetings.space')) } : null,
  });
}

export async function DELETE() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const admin = createAdminClient() as any;
  const { data } = await admin.from('user_google_connections').select('refresh_token_enc, access_token_enc').eq('user_id', user.id).maybeSingle();
  if (data) {
    // Tell Google to drop the access too (best effort — the stored tokens are deleted either way).
    try {
      const token = decryptToken(data.refresh_token_enc ?? data.access_token_enc);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST', signal: AbortSignal.timeout(10_000) });
    } catch { /* already revoked, or key changed */ }
  }
  await admin.from('google_calendar_events').delete().eq('user_id', user.id);
  const { error } = await admin.from('user_google_connections').delete().eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Could not disconnect' }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'google.disconnected', resource: `user:${user.id}` });
  return NextResponse.json({ ok: true });
}
