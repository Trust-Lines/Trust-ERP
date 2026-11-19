'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { compressImage, MAX_UPLOAD_BYTES } from '@/lib/client/compressImage';
import { uploadImageDirect } from '@/lib/client/directDropboxUpload';
import type { NeedNote } from './types';

/**
 * The Activity composer (text + one optional photo), comment delete, and Dropbox links for note images.
 * A photo goes straight to Dropbox at full quality when it can; otherwise the compressed copy is uploaded with the note.
 */
export function useDealComments(apiBase: string, notes: NeedNote[], setNotes: Dispatch<SetStateAction<NeedNote[]>>) {
  const [draft, setDraft] = useState('');
  const [draftImage, setDraftImage] = useState<File | null>(null);
  const originalImageRef = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [posting, setPosting] = useState(false);
  const [imageLinks, setImageLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    const missing = notes.filter(n => n.image_path && !imageLinks[n.image_path]);
    if (!missing.length) return;
    (async () => {
      const entries = await Promise.all(missing.map(async n => {
        const res = await fetch(`${apiBase}/dropbox-link?path=${encodeURIComponent(n.image_path!)}`);
        const body = await res.json().catch(() => ({}));
        return res.ok && body.link ? [n.image_path as string, body.link as string] as const : null;
      }));
      const found = Object.fromEntries(entries.filter((e): e is readonly [string, string] => e !== null));
      if (Object.keys(found).length) setImageLinks(prev => ({ ...prev, ...found }));
    })();
  }, [notes, apiBase]);

  function clearImage() {
    setDraftImage(null);
    originalImageRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function pickImage(picked: File | undefined) {
    originalImageRef.current = picked ?? null; // full-quality original for the direct Dropbox upload
    setDraftImage(picked ? await compressImage(picked) : null); // small copy = fallback upload
  }

  async function postComment() {
    if (!draft.trim() && !draftImage) return;
    setPosting(true);
    try {
      let res: Response;
      // Preferred: original photo straight to Dropbox. Any failure falls back to the classic upload.
      const directPath = draftImage ? await uploadImageDirect(`${apiBase}/notes`, originalImageRef.current ?? draftImage) : null;
      let direct: Response | null = null;
      if (directPath) {
        direct = await fetch(`${apiBase}/notes`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: draft.trim(), imagePath: directPath }),
        });
      }
      if (direct?.ok) {
        res = direct;
      } else if (draftImage) {
        // Direct upload unavailable, or the note could not be saved from it: classic upload of the compressed copy.
        if (draftImage.size > MAX_UPLOAD_BYTES) { toast.error('This photo is too large to upload (max 4 MB). Try a smaller one.'); return; }
        const form = new FormData();
        form.set('body', draft.trim());
        form.set('image', draftImage);
        res = await fetch(`${apiBase}/notes`, { method: 'POST', body: form });
      } else {
        res = await fetch(`${apiBase}/notes`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: draft.trim() }),
        });
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(res.status === 413 ? 'The photo is too large to upload (max 4 MB).' : (body.error ?? 'Could not post')); return; }
      setNotes(prev => [...prev, body.note]);
      setDraft('');
      clearImage();
    } finally { setPosting(false); }
  }

  // Called from the confirm popup; throwing keeps the popup open so the user can retry.
  async function deleteNote(n: NeedNote) {
    const res = await fetch(`${apiBase}/notes/${n.id}`, { method: 'DELETE' });
    if (!res.ok) { const body = await res.json().catch(() => ({})); toast.error(body.error ?? 'Could not delete'); throw new Error('delete failed'); }
    setNotes(prev => prev.filter(x => x.id !== n.id));
  }

  return { draft, setDraft, draftImage, pickImage, clearImage, fileInputRef, posting, postComment, deleteNote, imageLinks };
}

export type DealComments = ReturnType<typeof useDealComments>;
