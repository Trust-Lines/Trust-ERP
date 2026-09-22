import { u, base, layer, rotated } from './BranchButtons';

// Vector re-creations of the Trust-Lines branch buttons (Figma "Desktop - 16": 7:111, 7:121, 7:131).
const red: React.CSSProperties = { ...base, background: '#bd363e', border: `${u(4)} solid #9b2f36` };

// The brand lockup is one big sprite PNG; each use crops it with a percentage window.
/* eslint-disable @next/next/no-img-element */
const logo = (src: string, box: React.CSSProperties, crop: React.CSSProperties) => (
  <span style={{ position: 'absolute', overflow: 'hidden', pointerEvents: 'none', ...box }}>
    <img alt="" src={src} style={{ position: 'absolute', maxWidth: 'none', ...crop }} />
  </span>
);
const dsbLogo = () =>
  logo('/login/trustlines-logo-1.png',
    { left: u(103), top: u(16), width: u(177), height: u(61) },
    { height: '228.6%', left: '-7.82%', top: '-64.3%', width: '110.72%' });

export function DsbArt() {
  return (
    <span style={red}>
      {rotated('/login/tr-g359.svg', -16.88, 42.75, 11.56, 268.9, 273.1)}
      {rotated('/login/tr-g360.svg', 408.42, 52.28, -150, 291.5, 296)}
      {dsbLogo()}
    </span>
  );
}

export function DsbAltArt() {
  return (
    <span style={red}>
      {layer('/login/tr-g354.svg', { left: u(310), top: u(-120), width: u(148), height: u(297) })}
      {layer('/login/tr-g355.svg', { left: u(-68), top: u(-108), width: u(141.301), height: u(391.6) })}
      {dsbLogo()}
    </span>
  );
}

export function ConceptualArchitectArt() {
  return (
    <span style={red}>
      {layer('/login/tr-g350.svg', { left: u(-172), top: u(-94.08), width: u(285.651), height: u(256.6) })}
      {layer('/login/tr-g349.svg', { left: u(263), top: u(-79.1), width: u(285.651), height: u(270.1) })}
      {logo('/login/trustlines-logo-4.png',
        { left: u(107), top: u(15), width: u(169), height: u(61) },
        { height: '238.37%', left: '-7.23%', top: '-69.18%', width: '114.47%' })}
    </span>
  );
}

// Left-hand brand lockup: cropped logo + "Creative group" tagline, 337x131 design units.
export function TrustLinesLockup({ width = 255 }: { width?: number }) {
  return (
    <div role="img" aria-label="Trust-Lines Creative Group" style={{ width, aspectRatio: '337 / 131', position: 'relative', containerType: 'inline-size' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: `${(91 / 131) * 100}%`, overflow: 'hidden' }}>
        <img alt="" src="/login/trustlines-logo-1.png" style={{ position: 'absolute', maxWidth: 'none', height: '394.13%', left: '-8.42%', top: '-124.82%', width: '149.07%' }} />
      </span>
      <span style={{ position: 'absolute', left: 0, right: 0, top: `${(102 / 131) * 100}%`, textAlign: 'center', color: '#fff', fontSize: '5.045cqw', letterSpacing: '3.43cqw', lineHeight: 1, textTransform: 'uppercase', fontFamily: 'var(--font-brand)', paddingLeft: '3.43cqw' }}>
        Creative group
      </span>
    </div>
  );
}
