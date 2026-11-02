'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { uploadViaLink } from '@/lib/client/designUpload';
import { downloadQr } from '@/lib/client/qrDownload';
import { VIDEO_ACCEPT } from '@/lib/design/productVideos';

// No-login uploader for the production floor (app/video-upload/[token]). Plain styles — it sits
// outside the app shell and its theme.
const GREEN = '#2f4639';
const API = '/api/public/product-videos/upload';

const field: React.CSSProperties = { width: '100%', height: 44, borderRadius: 8, border: '1px solid #b9c2bb', padding: '0 12px', fontSize: 16, background: '#fff', color: '#1c1c1c', boxSizing: 'border-box' };
const button = (primary: boolean, disabled = false): React.CSSProperties => ({
  height: 44, borderRadius: 8, padding: '0 16px', fontSize: 15, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
  border: primary ? 'none' : `1px solid ${GREEN}`, background: primary ? (disabled ? '#9aa7a0' : GREEN) : '#fff', color: primary ? '#fff' : GREEN,
});

export function PublicVideoUploader({ token, valid }: { token: string; valid: boolean }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ productCode: string; link: string; replaced: boolean } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (done) void QRCode.toDataURL(done.link, { margin: 2, width: 480 }).then(setQr);
    else setQr(null);
  }, [done]);

  async function submit() {
    if (!file || !code.trim()) return;
    setError(null);
    try {
      setBusy('Uploading the video… keep this page open');
      const path = await uploadViaLink(API, file, { token, productCode: code.trim() });
      setBusy('Creating the QR code…');
      const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action: 'save', productCode: code.trim(), title: name, path }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? 'Could not save the video');
      setDone({ productCode: b.productCode, link: b.link, replaced: !!b.replaced });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not upload the video'); }
    finally { setBusy(null); }
  }

  const shell = (children: React.ReactNode) => (
    <main style={{ minHeight: '100dvh', background: '#f4f5f2', color: GREEN, fontFamily: 'var(--font-montserrat), system-ui, sans-serif' }}>
      <header style={{ background: '#fff', borderBottom: `4px solid ${GREEN}`, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/TLINES%20LOGOS%20PNG/Store%20Maker.png" alt="T Lines Store Maker" width={64} height={64} style={{ objectFit: 'cover' }} />
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Upload installation video</span>
      </header>
      <section style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</section>
    </main>
  );

  if (!valid) return shell(<p style={{ fontSize: 16, fontWeight: 600 }}>This upload link is not valid any more. Ask the design team for a new one.</p>);

  if (done) {
    return shell(<>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{done.productCode}</h1>
      <p style={{ margin: 0, fontSize: 15, color: '#4b4b4b' }}>
        {done.replaced ? 'The video is updated. The product’s QR code stays the same — stickers already printed play the new video.' : 'Done. Scanning this QR code plays the video.'}
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr && <img src={qr} alt={`QR code for ${done.productCode}`} width={240} height={240} style={{ alignSelf: 'center', background: '#fff', borderRadius: 8 }} />}
      <a href={done.link} target="_blank" rel="noreferrer" style={{ color: GREEN, fontWeight: 600, wordBreak: 'break-all', textAlign: 'center' }}>{done.link}</a>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={{ ...button(true), flex: 1 }} onClick={() => void downloadQr(done.link, done.productCode, 'png')}>Download QR (PNG)</button>
        <button type="button" style={{ ...button(false), flex: 1 }} onClick={() => void downloadQr(done.link, done.productCode, 'svg')}>Download QR (SVG)</button>
      </div>
      <button type="button" style={button(false)} onClick={() => { setDone(null); setCode(''); setName(''); setFile(null); }}>Upload another video</button>
    </>);
  }

  return shell(<>
    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Installation video</h1>
    <p style={{ margin: 0, fontSize: 15, color: '#4b4b4b' }}>Upload the product’s video and get the QR code for its sticker. If the product already has a video, it is replaced and its QR code stays the same.</p>
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600 }}>Product code
      <input style={field} value={code} onChange={e => setCode(e.target.value)} placeholder="IN-FC-48/ F12 BODY" autoCapitalize="characters" />
    </label>
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600 }}>Product name (optional)
      <input style={field} value={name} onChange={e => setName(e.target.value)} placeholder={'FRONT SHELVES 48"'} />
    </label>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600 }}>Video
      <button type="button" style={button(false)} onClick={() => inputRef.current?.click()}>{file ? `${file.name} · ${(file.size / 1048576).toFixed(1)} MB` : 'Choose video (MP4, MOV, WEBM)'}</button>
      <input ref={inputRef} type="file" accept={VIDEO_ACCEPT} hidden onChange={e => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
    </div>
    {error && <p role="alert" style={{ margin: 0, color: '#b42318', fontWeight: 600 }}>{error}</p>}
    <button type="button" style={button(true, !file || !code.trim() || !!busy)} disabled={!file || !code.trim() || !!busy} onClick={() => void submit()}>
      {busy ?? 'Upload and get the QR code'}
    </button>
  </>);
}
