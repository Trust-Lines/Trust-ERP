import { Dropbox } from 'dropbox';

// One client per server instance. A new client had no access token yet, so every request first
// refreshed it with Dropbox (~400 ms on top of the real call). The SDK refreshes the shared
// client's token by itself when it expires.
let shared: Dropbox | null = null;

export function getDropboxClient(): Dropbox {
  shared ??= new Dropbox({
    clientId:     process.env.DROPBOX_APP_KEY!,
    clientSecret: process.env.DROPBOX_APP_SECRET!,
    refreshToken: process.env.DROPBOX_REFRESH_TOKEN!,
    fetch:        globalThis.fetch.bind(globalThis),
  });
  return shared;
}

// Temporary links live 4 hours; reusing one for an hour skips a Dropbox call when a file is opened
// again (viewer back / forward, the same PDF opened by several people on one instance).
const LINK_TTL_MS = 60 * 60 * 1000;
const links = new Map<string, { link: string; until: number }>();

export async function cachedTemporaryLink(path: string): Promise<string> {
  const key = path.toLowerCase();
  const hit = links.get(key);
  if (hit && hit.until > Date.now()) return hit.link;
  const link = (await getDropboxClient().filesGetTemporaryLink({ path })).result.link;
  if (links.size > 2000) links.clear();
  links.set(key, { link, until: Date.now() + LINK_TTL_MS });
  return link;
}
