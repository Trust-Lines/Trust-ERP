'use client';

import { Loader2 } from 'lucide-react';

export function FilePreview({
  proxyUrl, selected, pdfLoading, pdfReady, zoom, selectedId, cacheBust, fileType, onLoad, fullscreen,
}: {
  proxyUrl:   string | null;
  selected:   { file_name: string } | null;
  pdfLoading: boolean;
  pdfReady:   boolean;
  zoom:       number;
  selectedId: string | null;
  cacheBust:  number;
  fileType:   (name: string) => 'pdf' | 'image' | 'other';
  onLoad:     () => void;
  fullscreen?: boolean;
}) {
  const ftype = selected ? fileType(selected.file_name) : 'other';

  const containerStyle: React.CSSProperties = {
    flex:            1,
    background:      fullscreen ? 'transparent' : 'var(--bg-sunken)',
    display:         'flex',
    alignItems:      (selected && ftype === 'image') ? 'flex-start' : (selected ? 'flex-start' : 'center'),
    justifyContent:  'center',
    overflow:        'auto',
    minHeight:       fullscreen ? undefined : 640,
    position:        'relative',
  };

  if (!selected || !proxyUrl) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', color: 'var(--fg-faint)', fontSize: 13 }}>Select a file to preview</div>
      </div>
    );
  }

  if (ftype === 'image') {
    return (
      <div style={containerStyle}>
        {pdfLoading && !pdfReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--fg-subtle)' }} />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`${selectedId ?? ''}-${cacheBust}`}
          src={proxyUrl}
          alt={selected.file_name}
          onLoad={onLoad}
          style={{
            display:    'block',
            width:      `${zoom}%`,
            height:     'auto',
            transition: 'width 150ms',
            maxWidth:   zoom <= 100 ? '100%' : 'none',
          }}
        />
      </div>
    );
  }

  if (ftype === 'pdf') {
    return (
      <div style={containerStyle}>
        {pdfLoading && !pdfReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--fg-subtle)' }} />
            <span style={{ fontSize: 12, color: 'var(--fg-faint)' }}>Loading…</span>
          </div>
        )}
        <iframe
          key={`${selectedId ?? ''}-${cacheBust}`}
          src={proxyUrl}
          onLoad={onLoad}
          style={{
            border:     'none',
            display:    'block',
            width:      `${zoom}%`,
            height:     fullscreen ? '85vh' : `${Math.max(640, Math.round(640 * zoom / 100))}px`,
            minWidth:   zoom > 100 ? `${zoom}%` : '100%',
            transition: 'width 150ms, height 150ms',
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ ...containerStyle, flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>Preview not available for this file type.</div>
      <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>{selected.file_name}</div>
    </div>
  );
}
