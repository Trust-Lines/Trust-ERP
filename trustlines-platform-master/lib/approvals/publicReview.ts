import { hashReviewToken } from './reviewToken';

export interface ResolvedOk { link: Record<string, unknown>; error?: undefined }
export interface ResolvedErr { link?: undefined; error: string; status: number }

export async function resolveLink(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any, token: string,
): Promise<ResolvedOk | ResolvedErr> {
  if (!token || token.length < 20) return { error: 'This link is invalid.', status: 404 };
  const hash = hashReviewToken(token);
  const { data: link } = await admin.from('approval_links').select('*').eq('token_hash', hash).maybeSingle();
  if (!link) return { error: 'This link is invalid.', status: 404 };
  if (link.status === 'revoked') return { error: 'This link has been revoked.', status: 410 };
  if (link.status !== 'completed' && link.expires_at && new Date(link.expires_at) < new Date()) {
    await admin.from('approval_links').update({ status: 'expired' }).eq('id', link.id);
    return { error: 'This link has expired.', status: 410 };
  }
  if (link.status !== 'completed' && link.max_views != null && link.view_count >= link.max_views) {
    return { error: 'This link has reached its view limit.', status: 410 };
  }
  return { link };
}

export function requestMeta(headers: Headers): { ip: string | null; user_agent: string | null } {
  const ip = headers.get('x-forwarded-for')?.split(',')[0].trim()
    || headers.get('x-real-ip')
    || null;
  return { ip, user_agent: headers.get('user-agent') };
}
