'use client';

import { Trash2 } from 'lucide-react';
import { ROLE_SURFACE, ROLE_TEXT, roleVars, type RoleDefinition } from './roleShared';

/** One row in the role list: select button, unsaved-changes dot, optional delete. */
export function RoleItem({ role, isSelected, isDirty, onSelect, onDelete, deleting }: {
  role: RoleDefinition; isSelected: boolean; isDirty: boolean;
  onSelect: () => void; onDelete?: () => void; deleting?: boolean;
}) {
  return (
    <div
      className={`flex min-h-14 items-center border-b border-ui-divider pr-4 last:border-b-0 ${ROLE_SURFACE} ${isSelected ? 'shadow-[inset_4px_0_0_var(--role-strong)] dark:shadow-[inset_4px_0_0_var(--role-tint)]' : ''}`}
      style={roleVars(role)}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 self-stretch border-0 bg-transparent py-2 pl-4 pr-3 text-left text-[14px] font-semibold leading-4 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ui-focus-ring ${ROLE_TEXT}`}
      >
        <span className="min-w-0">{role.label}</span>
        {isDirty && <span className="size-1.5 shrink-0 rounded-full bg-warning-normal" aria-label="Unsaved changes" />}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          title="Delete"
          aria-label={`Delete role ${role.label}`}
          className="flex shrink-0 cursor-pointer items-center justify-center rounded-[6px] border-0 bg-ui-surface-elevated p-1 text-[var(--status-t10-fg)] outline-none hover:bg-[var(--status-t10-bg)] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring disabled:opacity-60"
        >
          <Trash2 size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}
