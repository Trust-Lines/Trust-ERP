'use client';

import Image from 'next/image';
import { headerLogo } from '@/lib/demo/logos';
import type { Region4 } from '@/lib/demo/execData';

export function HeaderMark({ region, allRegions }: { region: Region4; allRegions: boolean }) {
  const src = headerLogo(region, allRegions);
  return (
    <div style={{ width: 150, height: 46, position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
      <Image
        key={src}
        src={src}
        alt="T Lines"
        width={148}
        height={148}
        unoptimized
        style={{ position: 'absolute', left: '50%', top: '49%', width: 148, height: 148, transform: 'translate(-50%, -50%)', objectFit: 'contain' }}
      />
    </div>
  );
}
