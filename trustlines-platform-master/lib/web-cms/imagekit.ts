import { createHmac, randomUUID } from 'crypto';

function keys() {
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

export function imageKitConfigured(): boolean {
  return keys() !== null;
}

// Client-side upload signature: the browser posts the file straight to ImageKit (bypasses the
// serverless body limit); only this short-lived signature is issued by the ERP.
export function createUploadAuth() {
  const k = keys();
  if (!k) return null;
  const token = randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 30 * 60;
  const signature = createHmac('sha1', k.privateKey).update(token + expire).digest('hex');
  return { token, expire, signature, publicKey: k.publicKey };
}

export interface IkEntry {
  type: 'file' | 'folder';
  name: string;
  path: string;
  url?: string;
}

// Read-only listing (files + subfolders) of one ImageKit folder.
export async function listFolder(path: string): Promise<IkEntry[]> {
  const k = keys();
  if (!k) throw new Error('ImageKit is not configured');
  const clean = '/' + path.replace(/^\/+|\/+$/g, '');
  const qs = new URLSearchParams({ path: clean, type: 'all', limit: '200', sort: 'ASC_NAME' });
  const res = await fetch(`https://api.imagekit.io/v1/files?${qs}`, {
    headers: { Authorization: 'Basic ' + Buffer.from(k.privateKey + ':').toString('base64') },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`ImageKit responded ${res.status}`);
  const rows = (await res.json()) as Array<{
    type: string; name: string; filePath?: string; folderPath?: string; url?: string; fileType?: string;
  }>;
  const out: IkEntry[] = [];
  for (const r of rows) {
    if (r.type === 'folder') {
      out.push({ type: 'folder', name: r.name, path: r.folderPath ?? `${clean}/${r.name}` });
    } else if (r.type === 'file' && r.fileType === 'image' && r.url) {
      out.push({ type: 'file', name: r.name, path: r.filePath ?? `${clean}/${r.name}`, url: r.url });
    }
  }
  out.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1));
  return out;
}
