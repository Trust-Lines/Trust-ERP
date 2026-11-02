// Product installation videos (migration 138): browser-safe constants + pure helpers.

export const PRODUCT_VIDEOS_ROOT = '/Design/Product Videos';
export const PRODUCT_VIDEOS_NOT_READY = 'Product videos are not set up yet — run migration 138_product_videos.sql.';

/** Video files the player can show (the browser plays mp4 / webm / mov). */
export const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v';

/** Short, unguessable, URL-safe id for the public link — printed on stickers, so it never changes. */
export function newVideoSlug(): string {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789'; // no 0/o/1/l — easy to read off a printout
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, b => abc[b % abc.length]).join('');
}

export const isVideoSlug = (s: string) => /^[a-z0-9]{6,32}$/.test(s);

/** The page the QR code opens. */
export function installPath(slug: string): string {
  return `/install/${slug}`;
}

export const IMAGE_ACCEPT = 'image/png,image/jpeg,.png,.jpg,.jpeg';
export const PRODUCT_IMAGES_ROOT = `${PRODUCT_VIDEOS_ROOT}/Images`;

/** The sticker's text fields from a request body → table columns (only the keys that were sent). */
export function stickerFieldsFrom(body: Record<string, unknown>): Record<string, unknown> {
  const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max) || null;
  const out: Record<string, unknown> = {};
  if ('title' in body) out.title = text(body.title, 200);
  if ('category' in body) out.category = text(body.category, 200);
  if ('collection' in body) out.collection = text(body.collection, 80);
  if ('colorName' in body) out.color_name = text(body.colorName, 80);
  if ('colorHex' in body) {
    const m = String(body.colorHex ?? '').trim().match(/^#?([0-9a-f]{6})$/i);
    out.color_hex = m ? `#${m[1].toLowerCase()}` : null;
  }
  if ('specs' in body) {
    const raw = Array.isArray(body.specs) ? body.specs.map(String) : String(body.specs ?? '').split(/\n/);
    out.specs = raw.map(s => s.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean).slice(0, 4).map(s => s.slice(0, 80));
  }
  return out;
}
