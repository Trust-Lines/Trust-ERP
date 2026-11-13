'use client';

import { Building2, CircleCheck, CircleDashed, CircleX, X, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DetailCard } from '@/components/platform/customers/customer-detail/ui';
import { cn } from '@/lib/utils';
import type { NeedClassification } from '@/types/database';
import { NEED_CLASSIFICATION_LABEL } from './types';

export const HEADING = 'text-[var(--color-secondary-700)] dark:text-[var(--color-secondary-50)]';
/** Small status/tag chip, same shape as the customer page's project stage chips. */
// Figma status chip: 12px, 3px / 8–10px padding (same as the opportunity stage chip).
export const CHIP = 'inline-flex items-center rounded-[4px] py-[3px] pl-2 pr-2.5 text-[12px] font-medium leading-4';

const NEED_TONE: Record<NeedClassification, { tone: string; icon: LucideIcon }> = {
  unclassified: { tone: 't0', icon: CircleDashed },
  potential: { tone: 't7', icon: CircleCheck },
  opportunity: { tone: 't2', icon: CircleCheck },
  disqualified: { tone: 't10', icon: CircleX },
};

export function NeedClassificationPill({ c }: { c: NeedClassification }) {
  const { tone, icon: Icon } = NEED_TONE[c];
  return (
    <span className={cn(CHIP, 'gap-1')} style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}>
      <Icon size={14} aria-hidden /> {NEED_CLASSIFICATION_LABEL[c]}
    </span>
  );
}

export function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>{label}</div>
      <div>{value || '—'}</div>
    </div>
  );
}

export function FormShell({ title, onCancel, children, footer }: { title: string; onCancel: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <DetailCard
      title={title}
      action={<Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel"><X aria-hidden /></Button>}
    >
      <div>{children}</div>
      <div className="flex gap-2">{footer}</div>
    </DetailCard>
  );
}

/** One choice in a pill row (project type, timing): navy when chosen, outline otherwise. */
export function OptionButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      variant={active ? 'primary' : 'outline'}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function FieldSection({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 rounded-[6px] border border-ui-divider bg-ui-surface p-3.5">
      <div className="mb-3 flex items-center gap-1.5">
        <Icon size={13} className="text-ui-nav-active" />
        <span className="text-[11px] font-bold uppercase tracking-[0.4px] text-ui-text-secondary">{title}</span>
      </div>
      {children}
    </div>
  );
}

