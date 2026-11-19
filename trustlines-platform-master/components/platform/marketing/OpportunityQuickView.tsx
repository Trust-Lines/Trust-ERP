'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { TaskList } from '@/components/platform/shared/TaskList';
import { DealProgressPanel } from '@/components/platform/shared/DealProgressPanel';
import { OPPORTUNITY_STAGE_LABEL } from '@/lib/marketing/classification';
import type { OpportunityStage, PotentialStatus } from '@/types/database';
import { DealDocuments } from '@/components/platform/sales/DealDocuments';
import { DealDesign } from '@/components/platform/sales/DealDesign';
import { ModalPanel } from '@/components/ui/modal';
import { Card, DocumentsList, StillToFillIn, missingForDeal } from './opportunity-quick-view/parts';
import type { NeedFile, NeedNote, Tag } from './opportunity-quick-view/types';
import { dealApiBase, useDealRecord, type DealKind } from './opportunity-quick-view/useDealRecord';
import { useDealComments } from './opportunity-quick-view/useDealComments';
import { useDealFiles } from './opportunity-quick-view/useDealFiles';
import { QuickViewHeader } from './opportunity-quick-view/QuickViewHeader';
import { DealFieldCards, POTENTIAL_STATUS_LABEL } from './opportunity-quick-view/DealFieldCards';
import { FilesCard } from './opportunity-quick-view/FilesCard';
import { ActivityPanel, ImageLightbox } from './opportunity-quick-view/ActivityPanel';
import { QuickViewConfirms } from './opportunity-quick-view/QuickViewConfirms';

/** Opportunity / Potential detail pop-up (Figma "Lead detail", node 305:10279): fields + files on the left, Activity on the right. */
export function OpportunityQuickView({ opportunityId, kind = 'opportunity', assignees, onClose, onChanged, canEdit = true, focusFields = [] }: {
  opportunityId: string;
  kind?: DealKind;
  assignees: { id: string; full_name: string }[];
  onClose: () => void;
  onChanged?: (patch: Record<string, unknown>) => void;
  canEdit?: boolean;
  /** Fields to point at while they're empty ('region', 'state', 'contact') — e.g. from a
   *  "needs region/state" notification. Highlighted until filled; the panel scrolls to the first. */
  focusFields?: string[];
}) {
  const apiBase = dealApiBase(kind, opportunityId);
  const rec = useDealRecord({ apiBase, kind, opportunityId, onChanged });
  const comments = useDealComments(apiBase, rec.notes, rec.setNotes);
  const dealFiles = useDealFiles(apiBase, rec.setFiles);
  const { opp, saveField } = rec;

  // Stage change waiting for its reason, the Convert question, and the two removals — all asked in platform popups.
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [stageReason, setStageReason] = useState('');
  const [askConvert, setAskConvert] = useState(false);
  const [deletingNote, setDeletingNote] = useState<NeedNote | null>(null);
  const [removingFile, setRemovingFile] = useState<NeedFile | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const popupOpen = pendingStage !== null || askConvert || !!deletingNote || !!removingFile;

  // Opened to fill something in: bring the first highlighted field into view once the data is here.
  const scrolledToFocus = useRef(false);
  const focusKey = focusFields.join(',');
  useEffect(() => {
    if (!focusKey || !opp || scrolledToFocus.current) return;
    scrolledToFocus.current = true;
    requestAnimationFrame(() => document.querySelector('[data-focus-field="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }, [focusKey, opp]);

  function changeStage(next: string) {
    if (next === opp?.stage) return;
    setStageReason('');
    setPendingStage(next);
  }

  // Called from the stage popup; throwing keeps it open until a reason is typed.
  async function confirmStage() {
    if (!pendingStage) return;
    if (!stageReason.trim()) { toast.error('Add a reason for the stage change'); throw new Error('reason required'); }
    await saveField('stage', pendingStage, { admin_correction_reason: stageReason.trim() });
  }

  // Imported ClickUp Docs live in their own section; everything else is the comment thread.
  const docNotes = rec.notes.filter(n => n.external_source === 'clickup_doc');
  const activityNotes = rec.notes.filter(n => n.external_source !== 'clickup_doc');

  const tags = (opp?.tags as Tag[] | null) ?? [];
  const title = (opp?.title as string) || rec.prospect?.display_name || (kind === 'potential' ? 'Potential' : 'Opportunity');
  const statusLabel = kind === 'opportunity'
    ? OPPORTUNITY_STAGE_LABEL[String(opp?.stage ?? '') as OpportunityStage]
    : POTENTIAL_STATUS_LABEL[(String(opp?.status || 'identified')) as PotentialStatus];

  return (
    // Escape / dimmed-area click: an open confirm closes itself first, then an open image, then the panel.
    <ModalPanel
      onOpenChange={o => { if (o || popupOpen) return; if (lightbox) { setLightbox(null); return; } onClose(); }}
      aria-label={title}
      layerClassName="z-[10000]"
      containerClassName="px-4 py-[3vh]"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="qv-root flex h-[94vh] w-[96vw] max-w-[1616px] flex-col gap-6 overflow-hidden rounded-card bg-ui-page-bg p-8 shadow-04"
      >
        <style>{`
          .qv-root{--qv-value:var(--color-secondary-700)}
          .dark .qv-root{--qv-value:var(--ui-heading)}
          .qv-spin{animation:qv-spin 1s linear infinite}
          @keyframes qv-spin{to{transform:rotate(360deg)}}
          .qv-input::placeholder{color:var(--ui-text-disabled);font-weight:500}
          .qv-input:focus-visible{outline:2px solid var(--ui-focus-ring);outline-offset:1px}
          .qv-indeterminate{animation:qv-slide 1.2s ease-in-out infinite}
          @keyframes qv-slide{0%{left:-40%}100%{left:100%}}
        `}</style>

        <QuickViewHeader
          title={title} kind={kind} opp={opp} project={rec.project} statusLabel={statusLabel}
          tags={tags} tagOptions={rec.tagOptions} canEdit={canEdit} saving={rec.saving} converting={rec.converting}
          onTagsChange={next => saveField('tags', next)} onConvert={() => setAskConvert(true)} onClose={onClose}
        />

        <div className="flex min-h-0 flex-1 gap-4">
          <div className="min-w-0 flex-1 overflow-y-auto pr-1">
            {!rec.loaded ? (
              <div className="flex items-center justify-center gap-2 p-12 text-[13px] text-ui-body"><Loader2 size={18} className="qv-spin" /> Loading…</div>
            ) : !opp ? (
              <div className="p-12 text-center text-[13px] text-ui-body">Couldn&apos;t load this {kind === 'potential' ? 'Potential' : 'Opportunity'}.</div>
            ) : (
              <div className="flex flex-col gap-4">
                {kind === 'opportunity' && (
                  <>
                    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                      <Card title="Start here">
                        <StillToFillIn missing={missingForDeal(opp)} stage={String(opp.stage)} />
                        <TaskList apiBasePath={apiBase} assignees={assignees} />
                      </Card>
                      <Card title="Progress">
                        <DealProgressPanel stage={String(opp.stage) as OpportunityStage} progress={rec.progress} />
                      </Card>
                    </div>
                    {/* System drawing: Design → Estimate → Contract → Closed Deal (migration 131). */}
                    <Card title="Design">
                      <DealDesign opportunityId={opportunityId} />
                    </Card>
                    <Card title="Estimate & Contract">
                      <DealDocuments opportunityId={opportunityId} dealTitle={title} defaultCurrency={(opp.currency as string | null) ?? null} canEdit={canEdit} />
                    </Card>
                  </>
                )}

                <DealFieldCards
                  kind={kind} opp={opp} need={rec.need} contacts={rec.contacts} contactLabel={rec.contactLabel}
                  assignees={assignees} canEdit={canEdit} focusFields={focusFields}
                  saveField={saveField} onStageChange={changeStage}
                  onContactChange={(id, name) => { rec.setContactLabel(name ?? ''); saveField('primary_contact_id', id); }}
                />

                {docNotes.length > 0 && (
                  <Card title="Documents"><DocumentsList docs={docNotes} /></Card>
                )}
                {!!opp.source_description_raw && (
                  <Card title="Description">
                    <div className="whitespace-pre-wrap text-[13px] leading-[1.6] text-ui-body">{String(opp.source_description_raw)}</div>
                  </Card>
                )}

                <FilesCard files={rec.files} project={rec.project} canEdit={canEdit} dealFiles={dealFiles} onRemove={setRemovingFile} />
              </div>
            )}
          </div>

          <ActivityPanel
            notes={activityNotes} loaded={rec.loaded} canEdit={canEdit} comments={comments}
            onDeleteNote={setDeletingNote} onOpenImage={setLightbox}
          />
        </div>
      </div>

      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}

      <QuickViewConfirms
        kind={kind}
        pendingStage={pendingStage} onCloseStage={() => setPendingStage(null)} stageReason={stageReason} onReasonChange={setStageReason} onConfirmStage={confirmStage}
        askConvert={askConvert} onAskConvertChange={setAskConvert} onConvert={rec.convert}
        deletingNote={deletingNote} onCloseNote={() => setDeletingNote(null)} onDeleteNote={comments.deleteNote}
        removingFile={removingFile} onCloseFile={() => setRemovingFile(null)} onRemoveFile={dealFiles.deleteFile}
      />
    </ModalPanel>
  );
}
