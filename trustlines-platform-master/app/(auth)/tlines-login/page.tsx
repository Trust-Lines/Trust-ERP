'use client';

import { LoginShell } from '@/components/auth/LoginShell';
import { StoreMakerArt, DesignBuildArt, PremiumFitoutsArt } from '@/components/auth/BranchButtons';

// Design: Figma "Tlines-Websites" → "Desktop - 15" (Select branch). Assets live in /public/login.
const INK = '#2c2c2c';

// TEMP: every branch goes to the dashboard until per-branch routing is defined.
const BRANCHES = [
  { name: 'T Lines Store Maker',            Art: StoreMakerArt,     href: '/home' },
  { name: 'T Lines Design & Build',         Art: DesignBuildArt,    href: '/home' },
  { name: 'T Lines Premium Store Fitouts',  Art: PremiumFitoutsArt, href: '/home' },
];

export default function TLinesLoginPage() {
  return (
    <LoginShell
      logo={
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/login/tlines-logo.png" alt="TLines Creativity Group" style={{ display: 'block', width: 255, height: 153, objectFit: 'cover' }} />
      }
    >
      <style>{`
        .tl-branch { display: block; container-type: inline-size; border-radius: 11px; transition: transform 150ms, box-shadow 150ms; }
        .tl-branch:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,.25); }
        .tl-branch:focus-visible { outline: 2px solid ${INK}; outline-offset: 3px; }
      `}</style>
      <h1 style={{ margin: 0, textAlign: 'center', fontSize: 22, fontWeight: 600, letterSpacing: '6.16px', textTransform: 'uppercase', color: INK, lineHeight: '38px' }}>
        Select branch
      </h1>
      <nav aria-label="Select branch" style={{ margin: '43px -6px 0', display: 'flex', flexDirection: 'column', gap: 15 }}>
        {BRANCHES.map(b => (
          <a key={b.name} href={b.href} className="tl-branch" aria-label={b.name}>
            <b.Art />
          </a>
        ))}
      </nav>
    </LoginShell>
  );
}
