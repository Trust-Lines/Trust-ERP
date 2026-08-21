'use client';

interface ViewToggleProps {
  value: 'trustlines' | 'tlines';
  onChange: (v: 'trustlines' | 'tlines') => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="view-toggle">
      <button
        className={value === 'trustlines' ? 'active' : ''}
        onClick={() => onChange('trustlines')}
      >
        Trust-Lines
      </button>
      <button
        className={value === 'tlines' ? 'active' : ''}
        onClick={() => onChange('tlines')}
      >
        T-Lines
      </button>
    </div>
  );
}
