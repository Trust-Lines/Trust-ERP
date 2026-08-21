import fs from 'fs';
import path from 'path';

let cached: string | null = null;

export function blackLogoBase64(): string {
  if (cached) return cached;
  let buf: Buffer;
  try { buf = fs.readFileSync(path.join(process.cwd(), 'public', 'logo-black.png')); }
  catch { buf = fs.readFileSync(path.join(process.cwd(), 'public', 'logo.png')); }
  cached = `data:image/png;base64,${buf.toString('base64')}`;
  return cached;
}
