'use client';

import Image from 'next/image';
import { BranchSelectLogin } from '@/components/auth/BranchSelectLogin';
import { DsbArt, DsbAltArt, ConceptualArchitectArt, TrustLinesLockup } from '@/components/auth/TrustLinesBranchButtons';

// TODO: wire each branch's destination once the Trust-Lines flow is defined.
const BRANCHES = [
  { name: 'Trust Lines D.S.B — Design | Supply | Build', Art: DsbArt,               href: '#' },
  { name: 'Trust Lines D.S.B — Design | Supply | Build', Art: DsbAltArt,            href: '#' },
  { name: 'Trust Lines C.A — Conceptual Architect',      Art: ConceptualArchitectArt, href: '#' },
];

export default function TrustLinesLoginPage() {
  return (
    <BranchSelectLogin
      branches={BRANCHES}
      logo={
        <>
          <Image
            src="/login/trustlines-logo-light.svg"
            alt="Trust-Lines Creative Group"
            width={316}
            height={100.221}
            priority
            className="h-auto w-[175px] lg:w-[316px] dark:hidden"
          />
          {/* 175px on mobile, 255px on desktop */}
          <div className="hidden lg:[zoom:1.457] dark:block">
            <TrustLinesLockup width={175} />
          </div>
        </>
      }
    />
  );
}
