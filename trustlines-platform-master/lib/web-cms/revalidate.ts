import { WEBSITE_URL } from './config';

// Asks the public site to refresh right away. Never throws: the site also self-refreshes within
// 60 s, so a failed ping only means "not instant" — the save itself already succeeded.
export async function pingWebsite(): Promise<boolean> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return false;
  try {
    const res = await fetch(`${WEBSITE_URL}/api/revalidate`, {
      method: 'POST',
      headers: { 'x-revalidate-secret': secret },
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
