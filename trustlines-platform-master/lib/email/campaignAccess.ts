import { NextResponse } from 'next/server';
import { MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';
import { EMAIL_CAMPAIGN_COLS, type EmailCampaignRow } from '@/lib/email/campaigns';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Same rule as marketing campaigns' stats route: managers see every email campaign; anyone
// else sees the ones they created or sent (their recipient lists hold Contacts' addresses).
export const canSeeAllCampaigns = (role: string) => MARKETING_SEE_ALL_ROLES.includes(role);

export async function loadCampaignFor(admin: any, id: string, userId: string, role: string):
  Promise<{ campaign: EmailCampaignRow; deny: null } | { campaign: null; deny: NextResponse }> {
  const { data, error } = await admin.from('email_campaigns').select(EMAIL_CAMPAIGN_COLS).eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) {
    console.error('[email campaign]', error.message);
    return { campaign: null, deny: NextResponse.json({ error: 'Could not load the campaign' }, { status: 500 }) };
  }
  const c = data as EmailCampaignRow | null;
  if (!c || (!canSeeAllCampaigns(role) && c.created_by !== userId && c.sender_user_id !== userId)) {
    return { campaign: null, deny: NextResponse.json({ error: 'Campaign not found' }, { status: 404 }) };
  }
  return { campaign: c, deny: null };
}
