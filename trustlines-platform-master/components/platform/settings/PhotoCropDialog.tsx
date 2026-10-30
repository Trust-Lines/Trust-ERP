'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';

const VIEW = 280;        // crop window on screen (px)
const OUT = 512;         // saved photo (px, square)
const MAX_ZOOM = 4;

/**
 * Pick which square part of the photo is the profile picture: drag to move, slider / wheel to zoom.
 * Returns a 512×512 JPEG.
 */
export function PhotoCropDialog({ file, onCancel, onCropped }: {
  file: File;
  onCancel: () => void;
  onCropped: (cropped: File) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });   // image top-left inside the window
  const [saving, setSaving] = useState(false);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      setImg(el);
      const s = Math.max(VIEW / el.naturalWidth, VIEW / el.naturalHeight);
      setZoom(1);
      setPos({ x: (VIEW - el.naturalWidth * s) / 2, y: (VIEW - el.naturalHeight * s) / 2 });
    };
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = img ? Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight) : 1;
  const scale = baseScale * zoom;
  const w = (img?.naturalWidth ?? 0) * scale;
  const h = (img?.naturalHeight ?? 0) * scale;

  /** Keep the window fully covered by the image. */
  const clamp = useCallback((x: number, y: number, ww = w, hh = h) => ({
    x: Math.min(0, Math.max(VIEW - ww, x)),
    y: Math.min(0, Math.max(VIEW - hh, y)),
  }), [w, h]);

  function setZoomKeepingCenter(next: number) {
    if (!img) return;
    const z = Math.min(MAX_ZOOM, Math.max(1, next));
    const s2 = baseScale * z;
    // The image point under the window's centre stays there.
    const cx = (VIEW / 2 - pos.x) / scale, cy = (VIEW / 2 - pos.y) / scale;
    setZoom(z);
    setPos(clamp(VIEW / 2 - cx * s2, VIEW / 2 - cy * s2, img.naturalWidth * s2, img.naturalHeight * s2));
  }

  async function save() {
    if (!img) return;
    setSaving(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUT; canvas.height = OUT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      const side = VIEW / scale;
      ctx.drawImage(img, -pos.x / scale, -pos.y / scale, side, side, 0, 0, OUT, OUT);
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9));
      if (!blob) throw new Error('encode');
      onCropped(new File([blob], 'profile.jpg', { type: 'image/jpeg' }));
    } finally { setSaving(false); }
  }

  return (
    <Modal open onOpenChange={o => { if (!o) onCancel(); }}>
      <ModalContent title="Profile photo" description="Drag to move, zoom to fit — this square is what everyone sees."
        footer={<><ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button loading={saving} disabled={!img} onClick={() => void save()}>Save photo</Button></>}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative cursor-grab touch-none overflow-hidden rounded-[8px] bg-ui-surface active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={e => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y }; }}
            onPointerMove={e => { const d = drag.current; if (d) setPos(clamp(d.x + e.clientX - d.px, d.y + e.clientY - d.py)); }}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
            onWheel={e => setZoomKeepingCenter(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
          >
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img.src} alt="" draggable={false}
                style={{ position: 'absolute', left: pos.x, top: pos.y, width: w, height: h, maxWidth: 'none', userSelect: 'none', pointerEvents: 'none' }} />
            )}
            {/* Thirds guide */}
            <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }, (_, i) => <span key={i} className="border border-white/25" />)}
            </div>
          </div>
          <div className="flex w-[280px] items-center gap-2">
            <button type="button" aria-label="Zoom out" onClick={() => setZoomKeepingCenter(zoom / 1.2)} className="grid size-8 place-items-center rounded-[6px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg"><ZoomOut size={16} /></button>
            <input type="range" aria-label="Zoom" min={1} max={MAX_ZOOM} step={0.01} value={zoom}
              onChange={e => setZoomKeepingCenter(Number(e.target.value))} className="flex-1 accent-[var(--color-secondary-700)]" />
            <button type="button" aria-label="Zoom in" onClick={() => setZoomKeepingCenter(zoom * 1.2)} className="grid size-8 place-items-center rounded-[6px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg"><ZoomIn size={16} /></button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
