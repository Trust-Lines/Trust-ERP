export function EntityCountBadge({ count, tone = 'neutral' }: { count: number; tone?: 'neutral' | 'warning' | 'indigo' }) {
  if (count === 0) {
    return <span style={{ color: 'var(--fg-subtle)' }}>—</span>;
  }
  const style = tone === 'warning'
    ? { bg: 'var(--status-warning-bg, #fef3c7)', fg: 'var(--status-warning-fg, #92400e)' }
    : tone === 'indigo'
      ? { bg: '#e0e7ff', fg: '#4338ca' }
      : { bg: 'var(--bg-subtle)', fg: 'var(--fg-default)' };
  return (
    <span className="pill" style={{ background: style.bg, color: style.fg, fontSize: 11, fontWeight: 600 }}>
      {count}
    </span>
  );
}
