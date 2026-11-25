'use client';

import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

// "Held by" on the item forms: an account, or — for someone with no account yet — a typed name.

/** The Select value that switches to a typed name. */
export const TYPED_HOLDER = '__typed';

export interface HolderValue { assigneeId: string; holderName: string }

/** What the item API takes: an account id or a typed name (both null when not assigned). */
export function holderBody(v: HolderValue & { status: string }): { assigneeId: string | null; holderName: string | null } {
  if (v.status !== 'assigned') return { assigneeId: null, holderName: null };
  if (v.assigneeId === TYPED_HOLDER) return { assigneeId: null, holderName: v.holderName.trim() || null };
  return { assigneeId: v.assigneeId || null, holderName: null };
}

/** The form's starting value from what's saved. */
export const holderInitial = (assigneeId: string | null, holderName: string | null): HolderValue =>
  ({ assigneeId: assigneeId ?? (holderName ? TYPED_HOLDER : ''), holderName: holderName ?? '' });

export function HolderPicker({ id, className, value, assignees, onChange }: {
  id: string;
  className: string;
  value: HolderValue;
  assignees: { id: string; name: string }[];
  onChange: (patch: Partial<HolderValue>) => void;
}) {
  const typed = value.assigneeId === TYPED_HOLDER;
  return (
    <div className="flex flex-col gap-2">
      <Select
        id={id} className={className} value={value.assigneeId} placeholder="Choose a person…"
        options={[...assignees.map(a => ({ value: a.id, label: a.name })), { value: TYPED_HOLDER, label: 'No account — type a name…' }]}
        onValueChange={v => onChange({ assigneeId: v ?? '' })}
      />
      {typed && (
        <Input
          aria-label="Holder name" autoFocus maxLength={120} className={className} placeholder="Full name"
          value={value.holderName} onChange={e => onChange({ holderName: e.target.value })}
        />
      )}
    </div>
  );
}
