type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  name: string;
  size?: AvatarSize;
  colorIndex?: number;
}

const ALT_COLORS = [
  'var(--brand-teal)',
  'var(--brand-navy-600)',
  '#7C3AED',
  '#0891B2',
  '#C7572B',
];

const SIZE_STYLES: Record<AvatarSize, React.CSSProperties> = {
  sm: { width: '24px', height: '24px', fontSize: '10px' },
  md: { width: '32px', height: '32px', fontSize: '11px' },
  lg: { width: '40px', height: '40px', fontSize: '14px' },
};

export function Avatar({ name, size = 'md', colorIndex }: AvatarProps) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const idx =
    colorIndex !== undefined
      ? colorIndex % ALT_COLORS.length
      : (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % ALT_COLORS.length;

  return (
    <span
      className="avatar"
      style={{
        ...SIZE_STYLES[size],
        background: ALT_COLORS[idx],
        fontWeight: 700,
        fontFamily: 'var(--font-ui)',
        color: 'white',
        userSelect: 'none',
      }}
      title={name}
    >
      {initials}
    </span>
  );
}
