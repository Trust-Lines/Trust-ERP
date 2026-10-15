'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Download, ExternalLink, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { toolBtn } from './shared';

export interface Lifecycle { label: string; bg: string; fg: string; border: string }

/** Middle column header: "Viewing: …", lifecycle badge and the zoom / download / fullscreen toolbar. */
export function PreviewToolbar({ viewingLabel, lifecycle, hasSelection, zoom, setZoom, onDownload, onOpenNew, onFullscreen }: {
  viewingLabel: string | null;
  lifecycle: Lifecycle | null;
  hasSelection: boolean;
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  onDownload: () => void;
  onOpenNew: () => void;
  onFullscreen: () => void;
}) {
  return (
        <div style={{
          padding: '8px 14px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-default)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              {viewingLabel ? `Viewing: ${viewingLabel}` : 'Select a file'}
            </span>
            {lifecycle && (
              <span style={{
                fontSize: 11, fontWeight: 800, letterSpacing: 0.4, whiteSpace: 'nowrap',
                padding: '3px 10px', borderRadius: 99,
                background: lifecycle.bg, color: lifecycle.fg, border: `1.5px solid ${lifecycle.border}`,
                textTransform: 'uppercase',
              }}>
                {lifecycle.label}
              </span>
            )}
          </span>
          {hasSelection && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <button style={toolBtn} onClick={() => setZoom(z => Math.max(25, z - 10))}><ZoomOut size={12} /></button>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', minWidth: 38, textAlign: 'center' }}>{zoom}%</span>
              <button style={toolBtn} onClick={() => setZoom(z => Math.min(300, z + 10))}><ZoomIn size={12} /></button>
              <button style={{ ...toolBtn, fontSize: 9, fontWeight: 700 }} onClick={() => setZoom(100)} title="Reset zoom">1:1</button>
              <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 2px' }} />
              <button style={toolBtn} onClick={onDownload} title="Download"><Download size={12} /></button>
              <button style={toolBtn} onClick={onOpenNew} title="Open in Dropbox"><ExternalLink size={12} /></button>
              <button style={toolBtn} title="Fullscreen" onClick={onFullscreen}>
                <Maximize2 size={12} />
              </button>
            </div>
          )}
        </div>
  );
}
