'use client';

import { useEffect, useState } from 'react';

// Shared chrome for the login screens: Figma 1440x1024 dark background frame, scaled to cover any
// viewport, with the brand logo and a white card laid out responsively on top.
const BG_LAYERS: { src: string; w: number; h: number; left: number; top: number; iw: number; ih: number; inset?: string; blend?: boolean }[] = [
  { src: 'ellipse-1', w: 1215.922, h: 1128.882, left: 245.04, top: -23.88, iw: 1172.319, ih: 585.549, inset: '-50.7% -24.02% -48.85% -22.14%', blend: true },
  { src: 'ellipse-2', w: 2159.928, h: 1564.119, left: -723.42, top: -217.01, iw: 1434.043, ih: 1413.331 },
  { src: 'ellipse-3', w: 2118.459, h: 1544.336, left: -723.41, top: -207.6, iw: 1421.571, ih: 1377.528 },
  { src: 'ellipse-4', w: 2076.281, h: 1523.492, left: -723.41, top: -198.19, iw: 1407.824, ih: 1341.724 },
];

export function LoginShell({ logo, children }: { logo: React.ReactNode; children: React.ReactNode }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => setScale(Math.max(window.innerWidth / 1440, window.innerHeight / 1024));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <div className="tl-login" style={{ '--tl-zoom': Math.min(Math.max(scale, 1), 1.6) } as React.CSSProperties}>
      <style>{`
        .tl-login {
          min-height: 100vh; position: relative; overflow: hidden; background: #2c2c2c;
          display: flex; align-items: center; justify-content: space-around; gap: 48px; padding: 32px 5vw;
          font-family: var(--font-brand);
        }
        .tl-login-stage { position: absolute; left: 50%; top: 50%; width: 1440px; height: 1024px; transform: translate(-50%, -50%) scale(var(--tl-scale, 1)); transform-origin: center; pointer-events: none; }
        .tl-login-stage > * { position: absolute; }
        .tl-login-rot { flex: none; transform: rotate(-123.73deg) scaleY(0.95) skewX(-18.49deg); position: relative; }
        .tl-login-logo { position: relative; flex: none; }
        .tl-login-card { position: relative; width: 424px; max-width: 100%; min-height: 483px; border-radius: 16px; background: #fff; box-shadow: 0 20px 60px rgba(0,0,0,.35); padding: 61px 21px 21px; box-sizing: border-box; }
        @media (min-width: 901px) { .tl-login-logo, .tl-login-card { zoom: var(--tl-zoom, 1); } }
        @media (max-width: 900px) {
          .tl-login { flex-direction: column; justify-content: center; }
          .tl-login-card { min-height: 0; padding-bottom: 32px; }
        }
      `}</style>

      <div aria-hidden className="tl-login-stage" style={{ '--tl-scale': scale } as React.CSSProperties}>
        <div style={{ left: -144, top: -102, width: 1728, height: 1228, background: '#333', filter: 'blur(22.6px)' }} />
        {BG_LAYERS.map(l => (
          <div key={l.src} style={{ left: l.left, top: l.top, width: l.w, height: l.h, display: 'flex', alignItems: 'center', justifyContent: 'center', mixBlendMode: l.blend ? 'screen' : undefined }}>
            <div className="tl-login-rot" style={{ width: l.iw, height: l.ih }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" src={`/login/${l.src}.svg`} style={{ position: 'absolute', maxWidth: 'none', ...(l.inset ? { inset: l.inset } : { inset: 0, width: '100%', height: '100%' }) }} />
            </div>
          </div>
        ))}
      </div>

      <div className="tl-login-logo">{logo}</div>
      <div className="tl-login-card">{children}</div>
    </div>
  );
}
