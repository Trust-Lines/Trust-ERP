'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Download, ExternalLink, ZoomIn, ZoomOut } from 'lucide-react';
import { FilePreview } from './FilePreview';
import { toolBtn } from './shared';

/** Full-screen overlay for the selected file (Esc closes, + / − zoom — the key handler lives in PlanLayoutTab). */
export function FullscreenViewer({ fileName, proxyUrl, selectedId, cacheBust, fileType, zoom, setZoom, onDownload, onOpenNew, onClose }: {
  fileName: string;
  proxyUrl: string;
  selectedId: string | null;
  cacheBust: number;
  fileType: (name: string) => 'pdf' | 'image' | 'other';
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  onDownload: () => void;
  onOpenNew: () => void;
  onClose: () => void;
}) {
  return (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.95)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px', background: 'rgba(0,0,0,0.6)', flexShrink: 0,
          }}>
            <span style={{ color: 'white', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40vw' }}>
              {fileName}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button style={{ ...toolBtn, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                onClick={() => setZoom(z => Math.max(25, z - 10))}><ZoomOut size={14} /></button>
              <span style={{ color: 'white', fontSize: 12, fontWeight: 700, minWidth: 42, textAlign: 'center' }}>{zoom}%</span>
              <button style={{ ...toolBtn, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                onClick={() => setZoom(z => Math.min(300, z + 10))}><ZoomIn size={14} /></button>
              <button style={{ ...toolBtn, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: 9, fontWeight: 700 }}
                onClick={() => setZoom(100)}>1:1</button>
              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
              <button style={{ ...toolBtn, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                onClick={onDownload}><Download size={14} /></button>
              <button style={{ ...toolBtn, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                onClick={onOpenNew}><ExternalLink size={14} /></button>
              <button
                onClick={onClose}
                style={{
                  marginLeft: 8, padding: '4px 12px', borderRadius: 5, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                  color: 'white', fontSize: 12, fontWeight: 700,
                }}
              >
                ✕ Close
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16 }}>
            <FilePreview
              proxyUrl={proxyUrl}
              selected={{ file_name: fileName }}
              pdfLoading={false}
              pdfReady={true}
              zoom={zoom}
              selectedId={selectedId}
              cacheBust={cacheBust}
              fileType={fileType}
              onLoad={() => {}}
              fullscreen
            />
          </div>

          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 10, padding: '4px 0 8px' }}>
            Esc to close · + / − to zoom
          </div>
        </div>
  );
}
