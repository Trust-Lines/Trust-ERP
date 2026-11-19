'use client';

import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { feedback } from '@/components/ui/feedback-toast';
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
    try {
      const form = new FormData();
      form.set('file', f);
      const res = await fetch(`${apiBase}/files`, { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { fail(body.error ?? (res.status === 413 ? 'File is too large' : 'Upload failed')); return; }
      setFiles(prev => [body.file, ...prev]);
      setUploads(prev => prev.filter(u => u.key !== key));
    } catch { fail('Network error'); }
  }

  function uploadMany(list: FileList | null) {
    if (!list) return;
    for (const f of Array.from(list)) void uploadFile(f);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const dismissUpload = (key: string) => setUploads(prev => prev.filter(x => x.key !== key));

  // Called from the confirm popup; throwing keeps the popup open so the user can retry.
  async function deleteFile(f: NeedFile) {
    const res = await fetch(`${apiBase}/files/${f.id}`, { method: 'DELETE' });
    if (!res.ok) { const body = await res.json().catch(() => ({})); toast.error(body.error ?? 'Could not remove'); throw new Error('remove failed'); }
    setFiles(prev => prev.filter(x => x.id !== f.id));
  }

  async function viewFile(f: NeedFile) {
    const res = await fetch(`${apiBase}/dropbox-link?path=${encodeURIComponent(f.dropbox_path)}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.link) { toast.error(body.error ?? 'Could not open file'); return; }
    window.open(body.link, '_blank', 'noopener,noreferrer');
  }

  return { uploads, uploadMany, dismissUpload, deleteFile, viewFile, fileInputRef };
}

export type DealFiles = ReturnType<typeof useDealFiles>;
