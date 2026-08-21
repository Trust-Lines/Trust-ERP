'use client';

const style: React.CSSProperties = {
  fontSize: 12, padding: '3px 6px', border: '1px solid var(--border-subtle)',
  borderRadius: 6, background: 'var(--bg-surface)',
};

export function InlineDateInput({ value, onChange, style: extra }: {
  value: string | null;
  onChange: (v: string | null) => void;
  style?: React.CSSProperties;
}) {
  return (
    <input
      type="date"
      value={value ?? ''}
      onChange={e => onChange(e.target.value || null)}
      style={{ ...style, ...extra }}
      onClick={e => e.stopPropagation()}
    />
  );
}
