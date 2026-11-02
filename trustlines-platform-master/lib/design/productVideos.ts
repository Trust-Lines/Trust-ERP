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
