// Browser-side ImageKit upload. The ERP only issues a short-lived signature
// (/api/web-cms/imagekit/auth); the file goes straight to ImageKit.

const MAX_BYTES = 15 * 1024 * 1024;

const MAX_SIDE = 2400;
const SKIP_OPTIMIZE_UNDER = 400 * 1024;

// Website photos never need to be camera-original size: shrink to 2400 px on the long side and
// re-encode before upload so pages load fast. GIF/SVG are left alone; if anything fails the
// original file is uploaded unchanged.
async function optimize(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < SKIP_OPTIMIZE_UNDER) { bmp.close(); return file; }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob: Blob | null = await new Promise(r => canvas.toBlob(r, type, 0.85));
    if (!blob || blob.size >= file.size) return file;
    const ext = type === 'image/png' ? 'png' : 'jpg';
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type });
  } catch {
    return file;
  }
}

export async function uploadToImageKit(original: File, folder: string): Promise<string> {
  if (!original.type.startsWith('image/')) throw new Error(`${original.name} is not an image`);
  if (original.size > MAX_BYTES) throw new Error(`${original.name} is over 15 MB`);
  const file = await optimize(original);

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
