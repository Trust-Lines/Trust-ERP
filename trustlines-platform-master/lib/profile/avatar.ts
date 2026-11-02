// Profile photos (migration 135): one file per person in Dropbox, overwritten on change; the
// profile row keeps its path. Shown through /api/avatar/<user id>. Used by Settings (your own
// photo, app/api/me/avatar) and the Team page (anyone's, app/api/team/[id]/avatar).
import { getDropboxClient } from '@/lib/dropbox/client';

const FOLDER = '/Team/Profile Photos';
const MAX_BYTES = 4_000_000; // the browser shrinks photos first (PhotoCropDialog → 512px square)
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

type Result = { url: string } | { error: string; status: number };

function dropboxError(e: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = e as any;
  return err?.error?.error_summary ?? (e instanceof Error ? e.message : 'Dropbox error');
}

/** Stores `file` as `userId`'s photo. `admin` = service-role client. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveAvatar(admin: any, userId: string, file: unknown): Promise<Result> {
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a photo', status: 400 };
  const ext = TYPES[file.type];
  if (!ext) return { error: 'Use a JPG, PNG or WebP image', status: 415 };
  if (file.size > MAX_BYTES) return { error: 'The photo is too large (max 4 MB)', status: 413 };

  const { data: before, error: readErr } = await admin.from('profiles').select('avatar_path').eq('id', userId).single();
  if (readErr) {
    return { error: /avatar_path/.test(readErr.message) ? 'Profile photos are not set up yet — run migration 135_profile_photo.sql.' : readErr.message, status: 409 };
  }

  const path = `${FOLDER}/${userId}.${ext}`;
  try {
    await getDropboxClient().filesUpload({ path, contents: Buffer.from(await file.arrayBuffer()), mode: { '.tag': 'overwrite' } });
  } catch (e) {
    console.error('[avatar] upload failed:', dropboxError(e));
    return { error: `Dropbox: ${dropboxError(e)}`, status: 502 };
  }
  // A different extension than last time leaves the old file behind — remove it.
  const old = (before as { avatar_path: string | null }).avatar_path;
  if (old && old !== path) await getDropboxClient().filesDeleteV2({ path: old }).catch(() => {});

  const at = new Date().toISOString();
  const { error } = await admin.from('profiles').update({ avatar_path: path, avatar_updated_at: at }).eq('id', userId);
  if (error) return { error: error.message, status: 500 };
  return { url: `/api/avatar/${userId}?v=${Date.parse(at)}` };
}

/** Removes `userId`'s photo. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function removeAvatar(admin: any, userId: string): Promise<{ error: string } | null> {
  const { data } = await admin.from('profiles').select('avatar_path').eq('id', userId).single();
  const path = (data as { avatar_path: string | null } | null)?.avatar_path;
  if (path) await getDropboxClient().filesDeleteV2({ path }).catch(() => {});
  const { error } = await admin.from('profiles').update({ avatar_path: null, avatar_updated_at: new Date().toISOString() }).eq('id', userId);
  return error ? { error: error.message } : null;
}
