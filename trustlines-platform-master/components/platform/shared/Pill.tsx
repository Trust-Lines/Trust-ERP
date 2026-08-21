type PillVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface PillProps {
  variant?: PillVariant;
  children: React.ReactNode;
  dot?: boolean;
}

const VARIANT_STYLES: Record<PillVariant, React.CSSProperties> = {
  success: { background: 'var(--status-success-bg)', color: 'var(--status-success-fg)' },
  warning: { background: 'var(--status-warning-bg)', color: 'var(--status-warning-fg)' },
  danger:  { background: 'var(--status-danger-bg)',  color: 'var(--status-danger-fg)' },
  info:    { background: 'var(--status-info-bg)',    color: 'var(--status-info-fg)' },
  neutral: { background: 'var(--bg-sunken)',         color: 'var(--fg-muted)' },
};

const DOT_COLORS: Record<PillVariant, string> = {
  success: 'var(--status-success)',
  warning: 'var(--status-warning)',
  danger:  'var(--status-danger)',
  info:    'var(--status-info)',
  neutral: 'var(--fg-subtle)',
};

export function Pill({ variant = 'neutral', children, dot = false }: PillProps) {
  return (
    <span className="pill" style={VARIANT_STYLES[variant]}>
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: DOT_COLORS[variant],
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
