'use client';

import Image from 'next/image';
import { BranchSelectLogin } from '@/components/auth/BranchSelectLogin';
import { StoreMakerArt, DesignBuildArt, PremiumFitoutsArt } from '@/components/auth/BranchButtons';

// TEMP: every branch goes to the dashboard until per-branch routing is defined.
const BRANCHES = [
  { name: 'T Lines Store Maker',            Art: StoreMakerArt,     href: '/home' },
  { name: 'T Lines Design & Build',         Art: DesignBuildArt,    href: '/home' },
  { name: 'T Lines Premium Store Fitouts',  Art: PremiumFitoutsArt, href: '/home' },
];

export default function TLinesLoginPage() {
  return (
    <BranchSelectLogin
      branches={BRANCHES}
      logo={
        // Figma 123-24546 "Group 364": 225.6px wide at x=164 of 1440. Only a white logo exists;
        // light mode darkens it until a light-mode asset is supplied.
        <Image
          src="/login/tlines-logo.svg"
          alt="TLines Creativity Group"
          width={225.587}
          height={132.87}
          priority
          className="h-auto w-[175px] brightness-0 lg:mr-[4vw] lg:w-[226px] dark:brightness-100"
        />
      }
    />
  );
}
