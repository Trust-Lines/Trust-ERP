'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Images, Trash2, Loader2, UploadCloud } from 'lucide-react';
import { thumb } from '@/lib/web-cms/config';
import { uploadMany } from './imagekitClient';
import { MediaPicker } from './MediaPicker';

interface Props {
  /** Current image URL ('' = none). */
  value: string;
  onChange: (url: string) => void;
  /** ImageKit folder new uploads go to, e.g. /store-maker/projects/teddy-milford/cover */
  folder: string;
  disabled?: boolean;
  height?: number;
  label?: string;
}

// One image slot: drop/upload a file, or pick an existing one from the ImageKit library.
export function ImageField({ value, onChange, folder, disabled, height = 180, label = 'Image' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [drag, setDrag] = useState(false);

  async function upload(files: File[]) {
    if (!files.length || disabled) return;
    setBusy(true);
    const { urls, errors } = await uploadMany(files.slice(0, 1), folder);
    setBusy(false);
    errors.forEach(e => toast.error(e));
    if (urls[0]) onChange(urls[0]);
  }

  return (
    <>
      <div
        onDragOver={e => { e.preventDefault(); if (!disabled) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); upload(Array.from(e.dataTransfer.files)); }}
        style={{
          position: 'relative', height, borderRadius: 12, overflow: 'hidden',
          border: `2px dashed ${drag ? 'var(--brand-teal-600, #0d9488)' : 'var(--border-subtle)'}`,
          background: value ? '#0f172a' : 'var(--bg-subtle, #f8fafc)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb(value, 900)} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 12.5, padding: 12 }}>
            <UploadCloud size={26} style={{ opacity: .5, marginBottom: 6 }} />
            <div>{disabled ? 'No image' : 'Drop an image here'}</div>
          </div>
        )}

        {busy && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={22} className="animate-spin" />
          </div>
        )}

        {!disabled && !busy && (
          <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()}>
              <ImagePlus size={13} style={{ marginRight: 4 }} /> Upload
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPicking(true)}>
              <Images size={13} style={{ marginRight: 4 }} /> Library
            </button>
            {value && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange('')} aria-label="Remove image">
                <Trash2 size={13} style={{ color: '#dc2626' }} />
              </button>
            )}
          </div>
        )}
      </div>

      <input
        ref={inputRef} type="file" accept="image/*" hidden
        onChange={e => { upload(Array.from(e.target.files ?? [])); e.target.value = ''; }}
      />
      {picking && <MediaPicker onClose={() => setPicking(false)} onPick={urls => { setPicking(false); if (urls[0]) onChange(urls[0]); }} />}
    </>
  );
}
