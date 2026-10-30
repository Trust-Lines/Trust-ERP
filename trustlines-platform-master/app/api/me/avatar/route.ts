import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDropboxClient } from '@/lib/dropbox/client';

// Settings → Profile photo. One file per person in Dropbox, overwritten on change; the profile
// row keeps its path (migration 135). Shown through /api/avatar/<user id>.

const FOLDER = '/Team/Profile Photos';
const MAX_BYTES = 4_000_000; // the browser shrinks photos first (lib/client/compressImage.ts)
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function dropboxError(e: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = e as any;
  return err?.error?.error_summary ?? (e instanceof Error ? e.message : 'Dropbox error');
}

// multipart: file
export async function POST(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Choose a photo' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'Use a JPG, PNG or WebP image' }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'The photo is too large (max 4 MB)' }, { status: 413 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: before, error: readErr } = await admin.from('profiles').select('avatar_path').eq('id', user.id).single();
  if (readErr) {
    return NextResponse.json({ error: /avatar_path/.test(readErr.message) ? 'Profile photos are not set up yet — run migration 135_profile_photo.sql.' : readErr.message }, { status: 409 });
  }

  const path = `${FOLDER}/${user.id}.${ext}`;
  try {
    await getDropboxClient().filesUpload({ path, contents: Buffer.from(await file.arrayBuffer()), mode: { '.tag': 'overwrite' } });
  } catch (e) {
    console.error('[me/avatar] upload failed:', dropboxError(e));
    return NextResponse.json({ error: `Dropbox: ${dropboxError(e)}` }, { status: 502 });
  }
  // A different extension than last time leaves the old file behind — remove it.
  const old = (before as { avatar_path: string | null }).avatar_path;
  if (old && old !== path) await getDropboxClient().filesDeleteV2({ path: old }).catch(() => {});

  const at = new Date().toISOString();
  const { error } = await admin.from('profiles').update({ avatar_path: path, avatar_updated_at: at }).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: `/api/avatar/${user.id}?v=${Date.parse(at)}` });
}

export async function DELETE() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin.from('profiles').select('avatar_path').eq('id', user.id).single();
  const path = (data as { avatar_path: string | null } | null)?.avatar_path;
  if (path) await getDropboxClient().filesDeleteV2({ path }).catch(() => {});
  const { error } = await admin.from('profiles').update({ avatar_path: null, avatar_updated_at: new Date().toISOString() }).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
