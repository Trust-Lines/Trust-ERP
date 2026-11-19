'use client';

import { ConfirmModal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { OPPORTUNITY_STAGE_LABEL } from '@/lib/marketing/classification';
import type { OpportunityStage } from '@/types/database';
import type { NeedFile, NeedNote } from './types';
import type { DealKind } from './useDealRecord';

// Above the quick view's own z-index 10000.
const LAYER = 'z-[10002]';

/**
 * The quick view's four confirm popups. Each onConfirm throws on failure (or a missing reason),
 * which keeps its popup open.
 */
export function QuickViewConfirms({
  kind, pendingStage, onCloseStage, stageReason, onReasonChange, onConfirmStage,
  askConvert, onAskConvertChange, onConvert,
  deletingNote, onCloseNote, onDeleteNote,
  removingFile, onCloseFile, onRemoveFile,
}: {
  kind: DealKind;
  pendingStage: string | null; onCloseStage: () => void; stageReason: string; onReasonChange: (v: string) => void; onConfirmStage: () => Promise<void>;
  askConvert: boolean; onAskConvertChange: (open: boolean) => void; onConvert: () => Promise<void>;
  deletingNote: NeedNote | null; onCloseNote: () => void; onDeleteNote: (n: NeedNote) => Promise<void>;
  removingFile: NeedFile | null; onCloseFile: () => void; onRemoveFile: (f: NeedFile) => Promise<void>;
}) {
  return (
    <>
      <ConfirmModal
        open={pendingStage !== null} onOpenChange={o => { if (!o) onCloseStage(); }}
        layerClassName={LAYER}
        title={pendingStage ? `Move to "${OPPORTUNITY_STAGE_LABEL[pendingStage as OpportunityStage]}"?` : 'Change stage?'}
        description="The reason is saved with the stage change."
        confirmLabel="Change stage"
        onConfirm={onConfirmStage}
      >
        <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-ui-heading">
          Reason (required)
          <Textarea rows={3} className="min-h-0" value={stageReason} onChange={e => onReasonChange(e.target.value)} placeholder="Why is the stage changing?" autoFocus />
        </label>
      </ConfirmModal>
      <ConfirmModal
        open={askConvert} onOpenChange={onAskConvertChange}
        layerClassName={LAYER}
        title="Convert this Potential to an Opportunity?"
        description="It goes to Sales → Handoffs to be accepted."
        confirmLabel="Convert"
        onConfirm={onConvert}
      />
      <ConfirmModal
        open={!!deletingNote} onOpenChange={o => { if (!o) onCloseNote(); }} tone="destructive"
        layerClassName={LAYER}
        title="Delete this comment?"
        description="It is removed permanently. This can't be undone."
        confirmLabel="Delete"
        onConfirm={async () => { if (deletingNote) await onDeleteNote(deletingNote); }}
      />
      <ConfirmModal
        open={!!removingFile} onOpenChange={o => { if (!o) onCloseFile(); }} tone="destructive"
        layerClassName={LAYER}
        title={removingFile ? `Remove "${removingFile.file_name}"?` : 'Remove this file?'}
        description={`It is taken off this ${kind === 'potential' ? 'Potential' : 'Opportunity'}. The file itself stays in Dropbox.`}
        confirmLabel="Remove"
        onConfirm={async () => { if (removingFile) await onRemoveFile(removingFile); }}
      />
    </>
  );
}
