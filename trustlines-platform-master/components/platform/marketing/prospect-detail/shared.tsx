'use client';

import { Building2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DetailCard, FORM_SUBMIT } from '@/components/platform/customers/customer-detail/ui';
import { cn } from '@/lib/utils';
import { Pill } from '@/components/platform/shared/Pill';
import type { NeedClassification } from '@/types/database';
import { NEED_CLASSIFICATION_LABEL, NEED_CLASSIFICATION_VARIANT } from './types';

export function NeedClassificationPill({ c }: { c: NeedClassification }) {
  return <Pill variant={NEED_CLASSIFICATION_VARIANT[c]}>{NEED_CLASSIFICATION_LABEL[c]}</Pill>;
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
      className={cn('rounded-[6px] font-medium', active && FORM_SUBMIT, active && 'h-8 px-3')}
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

