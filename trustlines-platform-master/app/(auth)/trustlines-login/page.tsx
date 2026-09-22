'use client';

import { LoginShell } from '@/components/auth/LoginShell';
import { DsbArt, DsbAltArt, ConceptualArchitectArt, TrustLinesLockup } from '@/components/auth/TrustLinesBranchButtons';

// Design: Figma "Tlines-Websites" → "Desktop - 16" (Select branch, Trust-Lines). Assets live in /public/login.
const INK = '#2c2c2c';

// TODO: wire each branch's destination once the Trust-Lines flow is defined.
const BRANCHES = [
  { name: 'Trust Lines D.S.B — Design | Supply | Build', Art: DsbArt,               href: '#' },
  { name: 'Trust Lines D.S.B — Design | Supply | Build', Art: DsbAltArt,            href: '#' },
  { name: 'Trust Lines C.A — Conceptual Architect',      Art: ConceptualArchitectArt, href: '#' },
];

export default function TrustLinesLoginPage() {
  return (
    <LoginShell logo={<TrustLinesLockup />}>
      <style>{`
        .tl-branch { display: block; container-type: inline-size; border-radius: 11px; transition: transform 150ms, box-shadow 150ms; }
        .tl-branch:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,.25); }
        .tl-branch:focus-visible { outline: 2px solid ${INK}; outline-offset: 3px; }
      `}</style>
      <h1 style={{ margin: 0, textAlign: 'center', fontSize: 22, fontWeight: 600, letterSpacing: '6.16px', textTransform: 'uppercase', color: INK, lineHeight: '38px' }}>
        Select branch
      </h1>
      <nav aria-label="Select branch" style={{ margin: '43px -6px 0', display: 'flex', flexDirection: 'column', gap: 15 }}>
        {BRANCHES.map((b, i) => (
          <a key={i} href={b.href} className="tl-branch" aria-label={b.name}>
            <b.Art />
          </a>
        ))}
      </nav>
    </LoginShell>
  );
}
