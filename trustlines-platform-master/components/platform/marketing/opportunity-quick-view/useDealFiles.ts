'use client';

import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { feedback } from '@/components/ui/feedback-toast';
import { ApiError, errorText, fetchJson } from '@/lib/client/fetchJson';
import type { NeedFile, UploadItem } from './types';

/** Deal files: parallel uploads with per-file progress and retry, remove (link only — the file stays in Dropbox), open. */
export function useDealFiles(apiBase: string, setFiles: Dispatch<SetStateAction<NeedFile[]>>) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(f: File) {
    const key = `${f.name}-${f.size}-${Date.now()}`;
    // A retry replaces the failed row for the same file.
    setUploads(prev => [...prev.filter(u => !(u.error && u.name === f.name)), { key, name: f.name, size: f.size }]);
    const fail = (msg: string) => {
      setUploads(prev => prev.map(u => (u.key === key ? { ...u, error: msg } : u)));
      feedback.error('Upload interrupted', {
        description: `${f.name} could not be uploaded. ${msg}`,
        action: { label: 'Retry upload', onClick: () => void uploadFile(f) },
      });
    };
    const form = new FormData();
    form.set('file', f);
    try {
      const body = await fetchJson<{ file: NeedFile }>(`${apiBase}/files`, { method: 'POST', body: form });
      setFiles(prev => [body.file, ...prev]);
      setUploads(prev => prev.filter(u => u.key !== key));
    } catch (e) {
      if (!(e instanceof ApiError) || e.status === 0) { fail('Network error'); return; }
      const serverMessage = typeof e.body.error === 'string' && e.body.error ? e.body.error : null;
      fail(serverMessage ?? (e.status === 413 ? 'File is too large' : 'Upload failed'));
    }
  }

  function uploadMany(list: FileList | null) {
    if (!list) return;
    for (const f of Array.from(list)) void uploadFile(f);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const dismissUpload = (key: string) => setUploads(prev => prev.filter(x => x.key !== key));

  // Called from the confirm popup; throwing keeps the popup open so the user can retry.
  async function deleteFile(f: NeedFile) {
    try {
      await fetchJson(`${apiBase}/files/${f.id}`, { method: 'DELETE', errorMessage: 'Could not remove' });
    } catch (e) { toast.error(errorText(e, 'Could not remove')); throw new Error('remove failed'); }
    setFiles(prev => prev.filter(x => x.id !== f.id));
  }

  // Opens the tab only after the link arrives — Safari can block that as a pop-up (fixed by useDropboxLink, next).
  async function viewFile(f: NeedFile) {
    let link: string | undefined;
    try {
      ({ link } = await fetchJson<{ link?: string }>(`${apiBase}/dropbox-link?path=${encodeURIComponent(f.dropbox_path)}`, { errorMessage: 'Could not open file' }));
    } catch (e) { toast.error(errorText(e, 'Could not open file')); return; }
    if (!link) { toast.error('Could not open file'); return; }
    window.open(link, '_blank', 'noopener,noreferrer');
  }

  return { uploads, uploadMany, dismissUpload, deleteFile, viewFile, fileInputRef };
}

export type DealFiles = ReturnType<typeof useDealFiles>;
