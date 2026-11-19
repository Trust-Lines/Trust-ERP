'use client';

import { ConfirmModal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { STATUS_META, type Lead } from '../types';
import type { StatusMove } from './useLeadMutations';

/** Status-change reason prompt (Marketing-origin deals) and the move-to-trash confirm. */
export function LeadDialogs({ statusMove, onCloseStatus, statusReason, onReasonChange, onConfirmStatus, trashing, onCloseTrash, onConfirmTrash }: {
  statusMove: StatusMove | null;
  onCloseStatus: () => void;
  statusReason: string;
  onReasonChange: (v: string) => void;
  onConfirmStatus: () => void;
  trashing: Lead | null;
  onCloseTrash: () => void;
  onConfirmTrash: (lead: Lead) => Promise<void>;
}) {
  return (
    <>
      <ConfirmModal
        open={!!statusMove} onOpenChange={o => { if (!o) onCloseStatus(); }}
        title={statusMove ? `Move "${statusMove.name}" to "${STATUS_META[statusMove.status].label}"?` : 'Change status?'}
        description="The reason is saved with the status change."
        confirmLabel="Change status"
        onConfirm={onConfirmStatus}
      >
        <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-ui-heading">
          Reason (required)
          <Textarea rows={3} className="min-h-0" value={statusReason} onChange={e => onReasonChange(e.target.value)} placeholder="Why is the status changing?" autoFocus />
        </label>
      </ConfirmModal>
      <ConfirmModal
        open={!!trashing} onOpenChange={o => { if (!o) onCloseTrash(); }} tone="destructive"
        title={trashing ? `Move "${trashing.name}" to trash?` : 'Move to trash?'}
        description="It stays in Trash for 30 days and can be restored from there."
        confirmLabel="Move to trash"
        onConfirm={async () => { if (trashing) await onConfirmTrash(trashing); }}
      />
    </>
  );
}
