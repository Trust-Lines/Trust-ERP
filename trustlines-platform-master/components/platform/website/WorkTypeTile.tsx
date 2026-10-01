'use client';

import { useState } from 'react';
import { Shapes } from 'lucide-react';
import { builtInIconUrl } from '@/lib/web-cms/workTypes';

interface Props {
  slug: string;
  label: string;
  iconUrl: string | null;
  siteUrl: string;
  selected?: boolean;
  dimmed?: boolean;
  size?: number;
  onClick?: () => void;
  title?: string;
}

// The website's filter tile (Figma 650:10316): chamfered sage-green square, cream icon above an
// uppercase label; forest green when selected. Used so marketing sees what visitors will see.
export function WorkTypeTile({ slug, label, iconUrl, siteUrl, selected, dimmed, size = 120, onClick, title }: Props) {
  const [broken, setBroken] = useState(false);
  const src = iconUrl || builtInIconUrl(siteUrl, slug);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      style={{
        width: size, height: size, border: 0, padding: 8, cursor: onClick ? 'pointer' : 'default',
        background: selected ? '#2E4437' : '#547255', color: '#FFF4E0', opacity: dimmed ? 0.45 : 1,
        clipPath: 'polygon(0 14%, 14% 0, 100% 0, 100% 86%, 86% 100%, 0 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: size * 0.1,
        transition: 'background .15s',
      }}
    >
      {broken ? (
        <Shapes size={size * 0.34} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setBroken(true)} style={{ width: size * 0.38, height: size * 0.38, objectFit: 'contain' }} />
      )}
      <span style={{ fontSize: Math.max(9, size * 0.095), fontWeight: 600, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.15, letterSpacing: 0.2 }}>
        {label}
      </span>
    </Tag>
  );
}
