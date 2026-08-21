'use client';

const style: React.CSSProperties = {
  fontSize: 12, padding: '3px 6px', border: '1px solid var(--border-subtle)',
  borderRadius: 6, background: 'var(--bg-surface)', maxWidth: 160,
};

export function InlineSelect({ value, onChange, options, style: extra, disabled }: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      style={{ ...style, ...extra }}
      onClick={e => e.stopPropagation()}
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
