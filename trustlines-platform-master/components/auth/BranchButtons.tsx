// Vector re-creations of the three Figma branch buttons ("Desktop - 15": 7:52, 7:80, 7:90).
// Built at the design's 391x103 size, with every length in cqw of the enclosing .tl-branch link so they scale crisply.
export const u = (px: number) => `${((px / 391) * 100).toFixed(3)}cqw`;

export const base: React.CSSProperties = {
  position: 'relative', display: 'block', width: '100%', aspectRatio: '391 / 103',
  overflow: 'hidden', borderRadius: u(11), boxSizing: 'border-box',
};

/* eslint-disable @next/next/no-img-element */
export const layer = (src: string, style: React.CSSProperties) => (
  <img alt="" src={src} style={{ position: 'absolute', display: 'block', maxWidth: 'none', ...style }} />
);
// Rotated group, centred on (cx, cy) of the button's padding box.
export const rotated = (src: string, cx: number, cy: number, deg: number, w = 193.6, h = 196.6) => (
  <div style={{ position: 'absolute', left: u(cx), top: u(cy), width: u(w), height: u(h), transform: `translate(-50%, -50%) rotate(${deg}deg)` }}>
    {layer(src, { inset: 0, width: '100%', height: '100%' })}
  </div>
);

export function StoreMakerArt() {
  return (
    <span style={{ ...base, background: '#204631', border: `${u(4)} solid #1e3c2b` }}>
      {rotated('/login/g359.svg', 32.5, 82.3, 13.5)}
      {rotated('/login/g360.svg', 363.98, 11.5, -150)}
      {layer('/login/g361.svg', {
        top: `calc(28.16% - ${u(1.75)})`, right: `calc(31.11% - ${u(1.51)})`,
        bottom: `calc(33.01% - ${u(1.36)})`, left: `calc(31.3% - ${u(1.5)})`,
      })}
    </span>
  );
}

export function DesignBuildArt() {
  return (
    <span style={{ ...base, border: 0 }}>
      {layer('/login/frame.svg', { inset: 0, width: '100%', height: '100%' })}
    </span>
  );
}

export function PremiumFitoutsArt() {
  return (
    <span style={{ ...base, background: '#46284a', border: `${u(4)} solid #3c243f` }}>
      {layer('/login/g350.svg', { left: u(-29.17 - 142.83), top: u(-1.84), width: u(285.651), height: u(164.4) })}
      {layer('/login/g349.svg', { left: u(405.83 - 142.83), top: u(-79.1), width: u(285.651), height: u(178.2) })}
      {layer('/login/asset4.png', { left: u(126), top: u(32), width: u(148), height: u(45), objectFit: 'cover', objectPosition: 'bottom' })}
    </span>
  );
}
