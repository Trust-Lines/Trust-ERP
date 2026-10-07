'use client';

// Building blocks shared by the password screens (forgot / reset / invite) so they look exactly
// like the login screen: same Figma shell, logo, field style and button.
export const INK = '#2c2c2c';
export const PLACEHOLDER = '#a8a8a8';

export function LoginLogo() {
  return (
    <div style={{ position: 'relative', width: 255, height: 106 }} role="img" aria-label="T Holding">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src="/login/logo-top.svg" style={{ position: 'absolute', maxWidth: 'none', inset: '0 12.59% 47.7% 12.2%', width: '75.21%', height: '52.3%' }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src="/login/logo-bottom.svg" style={{ position: 'absolute', maxWidth: 'none', inset: '47.53% 0 0 0', width: '100%', height: '52.47%' }} />
    </div>
  );
}

export function AuthStyles() {
  return (
    <style>{`
      .tl-login-field { display: flex; align-items: center; gap: 14px; height: 52px; padding: 0 11px; border: 1px solid ${PLACEHOLDER}; border-radius: 8px; box-sizing: border-box; background: #fff; }
      .tl-login-field:focus-within { border-color: ${INK}; }
      .tl-login-field.tl-has-error { border-color: #b91c1c; }
      .tl-login-field input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: 500 15px var(--font-brand); letter-spacing: 1.2px; color: ${INK}; }
      .tl-login-field input::placeholder { color: ${PLACEHOLDER}; }
      .tl-auth-toggle { border: 0; background: transparent; padding: 4px; cursor: pointer; font: 500 11px var(--font-brand); letter-spacing: 0.88px; text-transform: uppercase; color: ${INK}; text-decoration: underline; }
      .tl-auth-btn { display: block; width: 100%; height: 52px; border: 0; border-radius: 8px; background: ${INK}; color: #fff; font-family: var(--font-brand); font-size: 18px; font-weight: 600; letter-spacing: 1.44px; text-transform: uppercase; cursor: pointer; text-align: center; text-decoration: none; line-height: 52px; }
      .tl-auth-btn:disabled { cursor: not-allowed; opacity: 0.6; }
      .tl-auth-link { font-size: 11px; font-weight: 500; letter-spacing: 0.88px; text-transform: uppercase; text-decoration: underline; color: ${INK}; }
    `}</style>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <h1 style={{ margin: 0, textAlign: 'center', fontSize: 22, fontWeight: 600, letterSpacing: '6.16px', textTransform: 'uppercase', color: INK, lineHeight: '38px' }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ margin: '11px auto 0', width: 343, maxWidth: '100%', textAlign: 'center', fontSize: 15, fontWeight: 500, letterSpacing: '0.75px', lineHeight: '23px', color: INK }}>
          {subtitle}
        </p>
      )}
    </>
  );
}

export function AuthAlert({ children, tone = 'error' }: { children: React.ReactNode; tone?: 'error' | 'success' }) {
  const palette = tone === 'error'
    ? { background: '#fef2f2', border: '#fecaca', color: '#b91c1c' }
    : { background: '#f0fdf4', border: '#bbf7d0', color: '#166534' };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} style={{ background: palette.background, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: palette.color }}>
      {children}
    </div>
  );
}
