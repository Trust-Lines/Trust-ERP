'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { X, Trash2, Upload, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  existingBase64?: string | null;
  onSaved: (base64: string) => void;
  onClose: () => void;
}

async function removeBackground(src: string): Promise<string> {
  const { removeBackground: removeBg } = await import('@imgly/background-removal');
  const blob = await removeBg(src, { output: { format: 'image/png', quality: 0.95 } });
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target!.result as string);
    reader.readAsDataURL(blob);
  });
}

export function SignaturePad({ existingBase64, onSaved, onClose }: Props) {
  const [mode, setMode]             = useState<'draw' | 'upload'>('draw');
  const [saving, setSaving]         = useState(false);
  const [rawUpload, setRawUpload]   = useState<string | null>(null);
  const [processed, setProcessed]   = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const canvasRef                   = useRef<HTMLCanvasElement>(null);
  const isDrawing                   = useRef(false);
  const lastPt                      = useRef<{ x: number; y: number } | null>(null);
  const hasDrawn                    = useRef(false);

  useEffect(() => {
    if (mode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1a237e';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    hasDrawn.current = false;
  }, [mode]);

  const reprocess = useCallback(async (src: string) => {
    setProcessing(true);
    try {
      const result = await removeBackground(src);
      setProcessed(result);
    } catch (e) {
      console.error('[SignaturePad] bg removal failed:', e);
      toast.error('Background removal failed — check your connection');
    } finally {
      setProcessing(false);
    }
  }, []);

  useEffect(() => {
    if (rawUpload) void reprocess(rawUpload);
  }, [rawUpload, reprocess]);

  function pt(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const r  = canvas.getBoundingClientRect();
    const sx = canvas.width  / r.width;
    const sy = canvas.height / r.height;
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: (t.clientX - r.left) * sx, y: (t.clientY - r.top) * sy };
    }
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  function onDown(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    isDrawing.current = true;
    lastPt.current    = pt(e);
  }
  function onMove(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!isDrawing.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    const p   = pt(e);
    if (lastPt.current) {
      ctx.beginPath();
      ctx.moveTo(lastPt.current.x, lastPt.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      hasDrawn.current = true;
    }
    lastPt.current = p;
  }
  function onUp() { isDrawing.current = false; lastPt.current = null; }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setRawUpload(ev.target?.result as string);
      setProcessed(null);
    };
    reader.readAsDataURL(file);
  }

  function cropToContent(canvas: HTMLCanvasElement): string {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const { width, height } = canvas;
    const d = ctx.getImageData(0, 0, width, height).data;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (d[(y * width + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (minX > maxX || minY > maxY) return canvas.toDataURL('image/png');
    const pad = 10;
    const sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad);
    const sw = Math.min(width, maxX + pad + 1) - sx;
    const sh = Math.min(height, maxY + pad + 1) - sy;
    const out = document.createElement('canvas');
    out.width = sw; out.height = sh;
    out.getContext('2d')!.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return out.toDataURL('image/png');
  }

  async function save() {
    let base64: string | null = null;

    if (mode === 'draw') {
      if (!hasDrawn.current) { toast.error('Please draw your signature first'); return; }
      const canvas = canvasRef.current;
      base64 = canvas ? cropToContent(canvas) : null;
    } else {
      if (!processed) { toast.error('Please upload a signature image'); return; }
      base64 = processed;
    }

    if (!base64) return;
    setSaving(true);
    try {
      const res = await fetch('/api/user/signature', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64 }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Signature saved!');
      onSaved(base64);
    } catch {
      toast.error('Failed to save signature');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', width: 500, maxWidth: '95vw', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Your Signature</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>Saved once — stamped on PDFs when you approve</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={16} color="#666" /></button>
        </div>

        {existingBase64 && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>Current:</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={existingBase64} alt="signature" style={{ height: 34, maxWidth: 180, objectFit: 'contain' }} />
            <div style={{ fontSize: 10, color: '#888' }}>Drawing a new one will replace this</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: '#f3f4f6', borderRadius: 6, padding: 3 }}>
          {(['draw', 'upload'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '6px 0', borderRadius: 4, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: mode === m ? '#fff' : 'none',
              color:      mode === m ? '#111' : '#888',
              boxShadow:  mode === m ? '0 1px 4px rgba(0,0,0,.12)' : 'none',
            }}>
              {m === 'draw' ? '✏️ Draw' : '📷 Upload Photo'}
            </button>
          ))}
        </div>

        {mode === 'draw' && (
          <div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Draw your signature below (mouse or touch):</div>
            <div style={{
              border: '1.5px solid #d0d0d0', borderRadius: 5, overflow: 'hidden',
              backgroundImage: 'linear-gradient(45deg,#f0f0f0 25%,transparent 25%),linear-gradient(-45deg,#f0f0f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f0f0f0 75%),linear-gradient(-45deg,transparent 75%,#f0f0f0 75%)',
              backgroundSize: '12px 12px',
              backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
              backgroundColor: '#fff',
            }}>
              <canvas
                ref={canvasRef}
                width={456} height={140}
                onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
                onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
                style={{ width: '100%', height: 140, cursor: 'crosshair', display: 'block', touchAction: 'none' }}
              />
            </div>
            <button onClick={clearCanvas} style={{ marginTop: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#888', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Trash2 size={11} /> Clear
            </button>
          </div>
        )}

        {mode === 'upload' && (
          <div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
              Take a photo of your signature — AI will automatically remove the background. First use may take a moment to load.
            </div>

            {!rawUpload && (
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                border: '1.5px dashed #d0d0d0', borderRadius: 6, padding: '24px 16px',
                cursor: 'pointer', background: '#fafafa', marginBottom: 10,
              }}>
                <Upload size={24} color="#aaa" />
                <span style={{ fontSize: 12, color: '#888', marginTop: 8 }}>Click to upload signature photo</span>
                <span style={{ fontSize: 10, color: '#bbb', marginTop: 3 }}>PNG, JPG, HEIC — white or light background works best</span>
                <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
              </label>
            )}

            {rawUpload && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#888', marginBottom: 4 }}>Original</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={rawUpload} alt="original" style={{ width: '100%', maxHeight: 100, objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: 4, background: '#f9f9f9', padding: 4 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#1a6b6b', marginBottom: 4 }}>Background removed</div>
                    <div style={{
                      width: '100%', maxHeight: 100, border: '1px solid #e5e7eb', borderRadius: 4, padding: 4,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundImage: 'linear-gradient(45deg,#e8e8e8 25%,transparent 25%),linear-gradient(-45deg,#e8e8e8 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e8e8e8 75%),linear-gradient(-45deg,transparent 75%,#e8e8e8 75%)',
                      backgroundSize: '10px 10px', backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
                      backgroundColor: '#fff',
                    }}>
                      {processing
                        ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: '#1a6b6b' }} />
                            <span style={{ fontSize: 9, color: '#888' }}>AI removing background…</span>
                          </div>
                        : processed
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={processed} alt="processed" style={{ maxWidth: '100%', maxHeight: 90, objectFit: 'contain' }} />
                          : null
                      }
                    </div>
                  </div>
                </div>

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, fontSize: 11, color: '#888', cursor: 'pointer', textDecoration: 'underline' }}>
                  <Upload size={11} /> Upload a different image
                  <input type="file" accept="image/*" onChange={e => { setRawUpload(null); setProcessed(null); handleUpload(e); }} style={{ display: 'none' }} />
                </label>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 18px', borderRadius: 5, border: '1px solid #d0d0d0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving || processing} style={{
            padding: '7px 20px', borderRadius: 5, border: 'none',
            background: '#1a6b6b', color: '#fff',
            cursor: (saving || processing) ? 'default' : 'pointer',
            fontSize: 13, fontWeight: 700,
            opacity: (saving || processing) ? 0.75 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {saving
              ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />Saving…</>
              : processing
                ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />Processing…</>
                : <><Check size={13} />Save Signature</>
            }
          </button>
        </div>

      </div>
    </div>
  );
}
