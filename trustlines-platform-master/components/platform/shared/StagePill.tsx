export type StageTone = 1 | 2 | 3 | 4 | 5 | 6 | 'done' | 'neutral';

interface StagePillProps {
  tone: StageTone;
  children: React.ReactNode;
}

const TONE_STYLES: Record<StageTone, { bg: string; fg: string }> = {
  1:        { bg: 'var(--phase-1-bg)',    fg: 'var(--phase-1)' },
  2:        { bg: 'var(--phase-2-bg)',    fg: 'var(--phase-2)' },
  3:        { bg: 'var(--phase-3-bg)',    fg: 'var(--phase-3)' },
  4:        { bg: 'var(--phase-4-bg)',    fg: 'var(--phase-4)' },
  5:        { bg: 'var(--phase-5-bg)',    fg: 'var(--phase-5)' },
  6:        { bg: 'var(--phase-6-bg)',    fg: 'var(--phase-6)' },
  done:     { bg: 'var(--phase-done-bg)', fg: 'var(--phase-done)' },
  neutral:  { bg: 'var(--bg-sunken)',     fg: 'var(--fg-muted)' },
};

export function StagePill({ tone, children }: StagePillProps) {
  const s = TONE_STYLES[tone];
  return <span className="pill" style={{ background: s.bg, color: s.fg }}>{children}</span>;
}
