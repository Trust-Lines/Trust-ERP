// Browser-side ImageKit upload. The ERP only issues a short-lived signature
// (/api/web-cms/imagekit/auth); the file goes straight to ImageKit.

const MAX_BYTES = 15 * 1024 * 1024;

export async function uploadToImageKit(file: File, folder: string): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image`);
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is over 15 MB`);

  const authRes = await fetch('/api/web-cms/imagekit/auth', { cache: 'no-store' });
  const auth = await authRes.json().catch(() => ({}));
  if (!authRes.ok) throw new Error(auth.error ?? 'Could not get an upload signature');

  const form = new FormData();
  form.append('file', file);
  form.append('fileName', file.name);
  form.append('folder', folder);
  form.append('useUniqueFileName', 'true');
  form.append('publicKey', auth.publicKey);
  form.append('signature', auth.signature);
  form.append('expire', String(auth.expire));
  form.append('token', auth.token);

  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url) throw new Error(body.message ?? 'ImageKit upload failed');
  return body.url as string;
}

export async function uploadMany(files: File[], folder: string): Promise<{ urls: string[]; errors: string[] }> {
  const urls: string[] = [];
  const errors: string[] = [];
  for (const f of files) {
    try { urls.push(await uploadToImageKit(f, folder)); }
    catch (e) { errors.push(e instanceof Error ? e.message : String(e)); }
  }
  return { urls, errors };
}
