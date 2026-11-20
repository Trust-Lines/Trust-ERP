'use client';

import { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2, Circle, Clock, XCircle, ExternalLink,
  ThumbsUp, Loader2, ChevronDown, ChevronRight, RefreshCw, Check, X,
  DraftingCompass, FileBox, Factory, Package, Hammer, ShelvingUnit, LampCeiling, Palette,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  PHASE1_STEPS, PHASE2_STEPS, CATEGORY_STEPS, DELIVERY_STEPS,
  CAT_GROUP_LABELS, getActiveCategoryGroups,
  findStep, findAllDocsForStep,
  type StepDef, type StepRecord, type StepPhase, type CategoryGroup,
} from '@/lib/workflow/steps';
import { cn } from '@/lib/utils';
import type { ProjectCategory } from '@/types/database';
import { Select } from '@/components/platform/shared/Select';
import { EmptyState } from '@/components/ui/empty-state';
import { feedback } from '@/components/ui/feedback-toast';
import { Button } from '@/components/ui/button';
import { useDropboxLink } from '@/hooks/use-dropbox-link';
import { errorText } from '@/lib/client/fetchJson';
import { openLinkInNewTab } from '@/lib/client/openLink';

export interface DocSummary {
  id: string;
  doc_type: string;
  step_key: string | null;
  cat_group: string | null;
  version: number;
  dropbox_version: number | null;
  status: string;
  file_name: string;
}

interface WorkflowProps {
  projectId:       string;
  projectCode:     string;
  dropboxRootPath: string | null;
  categories:      ProjectCategory[];
  userRole:        string;
  userId:          string;
  initialSteps:    StepRecord[];
  documents:       DocSummary[];
  onRequestUpload: (stepKey: string, phase: string, catGroup: string | null, docType?: string) => void;
  onStepsChanged:  () => void;
}

function ViewBtn({ documentId, dropboxVersion }: { documentId: string; dropboxVersion: number | null }) {
  const { open, opening } = useDropboxLink();
  return (
    <Button variant="secondary" size="xs" onClick={() => void open(`/api/files/view?documentId=${documentId}`, { errorMessage: 'Could not open file from Dropbox' })} disabled={opening}>
      {opening ? <Loader2 className="animate-spin" /> : <ExternalLink />}
      View V{dropboxVersion ?? 0}
    </Button>
  );
}

function ApproveArea({
  stepDef, stepRecord, onApprove,
}: {
  stepDef: StepDef;
  stepRecord: StepRecord | undefined;
  onApprove: (version?: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [ver, setVer]   = useState(1);

  if (stepRecord?.status === 'approved') {
    return (
      <span style={{ fontSize: 11, color: 'var(--phase-done)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
        <CheckCircle2 size={11} />
        Approved{stepRecord.version_approved ? ` v${stepRecord.version_approved}` : ''}
      </span>
    );
  }

  if (open) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {stepDef.requiresVersionSelect && (
          <>
            <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>v</span>
            <Select
              value={ver}
              onChange={e => setVer(Number(e.target.value))}
              style={{
                padding: '2px 6px', fontSize: 11, borderRadius: 4,
                border: '1px solid var(--border-default)', background: 'var(--bg-surface)',
                width: 52,
              }}
            >
              {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
            </Select>
          </>
        )}
        <Button size="xs" onClick={() => { onApprove(stepDef.requiresVersionSelect ? ver : undefined); setOpen(false); }}>
          <Check /> Confirm
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={() => setOpen(false)} aria-label="Cancel approval"><X /></Button>
      </span>
    );
  }

  return (
    <Button size="xs" onClick={() => setOpen(true)}>
      <ThumbsUp />
      {stepDef.requiresVersionSelect ? 'Select & Approve' : 'Approve'}
    </Button>
  );
}

type FoundFile = { name: string; path: string; dropboxId: string };
type FoundGroup = { version: number; files: FoundFile[] };

export function DropboxSyncBtn({
  projectId, dropboxRootPath, docType, catGroup, stepKey,
  linkedVersions, onSynced,
}: {
  projectId:       string;
  dropboxRootPath: string;
  docType:         string;
  catGroup:        string | null;
  stepKey:         string;
  linkedVersions:  Set<number>;
  onSynced:        () => void;
}) {
  const [open, setOpen]         = useState(false);
  const [scanning, setScanning] = useState(false);
  const [results, setResults]   = useState<FoundGroup[] | null>(null);
  const [syncing, setSyncing]   = useState<string | null>(null);
  const [pos, setPos]           = useState({ top: 0, right: 0 });
  const triggerRef              = useRef<HTMLButtonElement>(null);
  const dropdownRef             = useRef<HTMLDivElement>(null);
  const [localLinked, setLocalLinked] = useState<Set<number>>(new Set(linkedVersions));

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function handleOpen() {
    const next = !open;
    if (next && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen(next);
    if (!next || results !== null) return;
    setScanning(true);
    try {
      const params = new URLSearchParams({
        projectRoot: dropboxRootPath,
        docType,
        ...(catGroup ? { prodType: catGroup.charAt(0).toUpperCase() + catGroup.slice(1) } : {}),
      });
      const res  = await fetch(`/api/dropbox/scan-step-files?${params}`);
      const data = await res.json() as { results?: FoundGroup[] };
      setResults(data.results ?? []);
    } catch { setResults([]); }
    finally { setScanning(false); }
  }

  async function linkFile(f: FoundFile, version: number) {
    setSyncing(f.path);
    try {
      const res = await fetch('/api/dropbox/link-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId, docType,
          dropboxPath: f.path, dropboxId: f.dropboxId, fileName: f.name,
          dropboxVersion: version, catGroup: catGroup ?? undefined, stepKey,
        }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      setLocalLinked(prev => new Set([...prev, version]));
      onSynced();
      setResults(null);
      setOpen(false);
    } catch (err) {
      feedback.error('Sync failed', {
        description: `${f.name} could not be linked.${err instanceof Error && err.message ? ` ${err.message}` : ''}`,
        action: { label: 'Retry sync', onClick: () => void linkFile(f, version) },
      });
    } finally { setSyncing(null); }
  }

  // Used to fail silently; now says so.
  async function openInDropbox(path: string) {
    try {
      await openLinkInNewTab(`/api/files/view-by-path?path=${encodeURIComponent(path)}&projectId=${encodeURIComponent(projectId)}`, 'Could not open file from Dropbox');
    } catch (e) { toast.error(errorText(e, 'Could not open file from Dropbox')); }
  }

  const totalFiles = results ? results.reduce((s, g) => s + g.files.length, 0) : 0;

  return (
    <>
      <Button
        ref={triggerRef} variant="secondary" size="xs" aria-expanded={open}
        onClick={handleOpen}
        title="Dropbox versiyonlarını gör"
        className={open ? 'bg-ui-hover-bg' : undefined}
      >
        {scanning ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Dropbox
        {results !== null && totalFiles > 0 && (
          <span className="ml-0.5 rounded-full bg-[var(--color-secondary-700)] px-1.5 text-[9px] font-extrabold text-white dark:bg-primary-50 dark:text-primary-950">{totalFiles}</span>
        )}
      </Button>

      {open && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 7,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            minWidth: 280, maxWidth: 360,
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)',
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--fg-faint)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>Dropbox Versions</span>
            {results !== null && (
              <button
                onClick={() => { setResults(null); handleOpen(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)', padding: 0, fontSize: 10 }}
              >
                ↺ Refresh
              </button>
            )}
          </div>

          {scanning && (
            <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12, color: 'var(--fg-subtle)' }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginBottom: 6 }} />
              <br />Scanning Dropbox…
            </div>
          )}

          {!scanning && results !== null && results.length === 0 && (
            <EmptyState size="sm" className="justify-center px-3" title="No files found in Dropbox." />
          )}

          {!scanning && results && results.length > 0 && results.map(group => (
            <div key={group.version}>
              <div style={{
                padding: '5px 12px 3px',
                fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: 'var(--brand-teal)',
                background: 'var(--brand-teal-100)',
                borderTop: '1px solid var(--border-subtle)',
              }}>
                V{group.version}
              </div>

              {group.files.map(f => {
                const alreadyLinked = localLinked.has(group.version);
                const isSyncing     = syncing === f.path;
                return (
                  <div
                    key={f.path}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 12px',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: alreadyLinked ? 'color-mix(in srgb, var(--status-success) 8%, var(--bg-surface))' : 'var(--bg-surface)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 500, color: 'var(--fg-default)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {f.name}
                      </div>
                      {alreadyLinked && (
                        <div style={{ fontSize: 10, color: 'var(--status-success-fg)', marginTop: 1 }}>✓ Linked</div>
                      )}
                    </div>

                    {alreadyLinked ? (
                      <button
                        onClick={() => openInDropbox(f.path)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '3px 8px', borderRadius: 4,
                          fontSize: 10, fontWeight: 600, cursor: 'pointer',
                          background: 'var(--status-success-bg)', color: 'var(--status-success-fg)',
                          border: '1px solid color-mix(in srgb, var(--status-success-fg) 45%, transparent)', flexShrink: 0,
                        }}
                      >
                        <ExternalLink size={9} /> View
                      </button>
                    ) : (
                      <button
                        onClick={() => linkFile(f, group.version)}
                        disabled={isSyncing}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '3px 8px', borderRadius: 4,
                          fontSize: 10, fontWeight: 600, cursor: isSyncing ? 'wait' : 'pointer',
                          background: 'var(--brand-teal-100)', color: 'var(--brand-teal)',
                          border: '1px solid color-mix(in srgb, var(--brand-teal) 45%, transparent)', flexShrink: 0,
                        }}
                      >
                        {isSyncing
                          ? <Loader2 size={9} style={{ animation: 'spin 1s linear infinite' }} />
                          : <RefreshCw size={9} />}
                        Link
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function StepRow({
  num, stepDef, stepRecord, docs, canAct,
  onMarkDone, onApprove, onSynced,
  projectId, dropboxRootPath, catGroup,
}: {
  num: number;
  stepDef:         StepDef;
  stepRecord:      StepRecord | undefined;
  docs:            { id: string; version: number; dropbox_version: number | null }[];
  canAct:          boolean;
  onMarkDone:      () => void;
  onApprove:       (version?: number) => void;
  onSynced:        () => void;
  projectId:       string;
  dropboxRootPath: string | null;
  catGroup:        string | null;
}) {
  const status = stepRecord?.status ?? 'pending';
  const isApproved = status === 'approved';
  const isWaiting  = status === 'done' && !!stepRecord?.notes;
  const isDone     = isApproved || (status === 'done' && !stepRecord?.notes);
  const isRejected = status === 'rejected';
  const hasDoc = docs.length > 0;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 20px',
        borderBottom: '1px solid var(--ui-divider)',
        background: (isDone || isApproved) ? 'var(--status-t9-bg)'
          : isWaiting  ? 'rgba(245,158,11,0.04)'
          : isRejected ? 'rgba(220,38,38,0.03)'
          : 'var(--bg-surface)',
        transition: 'background 120ms',
      }}
    >
      <span style={{ fontSize: 10, color: (isDone || isApproved) ? 'var(--status-t9-fg)' : 'var(--fg-faint)', fontWeight: 700, width: 14, textAlign: 'right', flexShrink: 0, marginTop: 2 }}>
        {num}
      </span>

      <span style={{ flexShrink: 0, lineHeight: 0, marginTop: 1 }}>
        {(isDone || isApproved)
          ? <CheckCircle2 size={15} color="var(--phase-done)" strokeWidth={2} />
          : isWaiting
            ? <Clock size={15} color="var(--status-warning-fg)" strokeWidth={1.5} />
            : isRejected
              ? <XCircle size={15} color="var(--status-danger-fg)" strokeWidth={1.5} />
              : <Circle size={15} color="var(--border-strong)" strokeWidth={1.5} />}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, color: (isDone || isApproved) ? 'var(--status-t9-fg)' : 'var(--fg-default)', fontWeight: (isDone || isApproved) ? 400 : 500 }}>
          {stepDef.label}
          {stepDef.isOptional && (
            <span style={{ fontSize: 10, color: 'var(--fg-faint)', fontWeight: 400, marginLeft: 5 }}>optional</span>
          )}
        </span>
        {isDone && (stepRecord?.completed_at || stepRecord?.approved_at) && (
          <div style={{ fontSize: 11, color: 'var(--status-t9-fg)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            {new Date((stepRecord.approved_at ?? stepRecord.completed_at)!).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
            {stepRecord?.version_approved != null && (
              <span style={{ fontWeight: 700, color: 'var(--phase-done)', fontSize: 10 }}>V{stepRecord.version_approved}</span>
            )}
          </div>
        )}
        {isWaiting && stepRecord?.notes && (
          <div style={{ fontSize: 11, color: 'var(--status-warning-fg)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={9} />
            {stepRecord.notes}
          </div>
        )}
        {isRejected && stepRecord?.notes && (
          <div style={{ fontSize: 11, color: 'var(--status-danger-fg)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
            <XCircle size={9} />
            {stepRecord.notes}
          </div>
        )}
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>

        {docs.length > 0 && (
          <ViewBtn documentId={docs[docs.length - 1].id} dropboxVersion={docs[docs.length - 1].dropbox_version} />
        )}

        {canAct && (
          <>
            {stepDef.hasDocument && stepDef.docType && dropboxRootPath && (
              <DropboxSyncBtn
                projectId={projectId}
                dropboxRootPath={dropboxRootPath}
                docType={stepDef.docType}
                catGroup={catGroup}
                stepKey={stepDef.key}
                linkedVersions={new Set(docs.map(d => d.dropbox_version ?? d.version))}
                onSynced={onSynced}
              />
            )}

            {(stepDef.requiresApproval && hasDoc || stepDef.requiresVersionSelect) && status !== 'approved' && (
              <ApproveArea stepDef={stepDef} stepRecord={stepRecord} onApprove={onApprove} />
            )}

            {!stepDef.hasDocument && !stepDef.requiresApproval && !stepDef.requiresVersionSelect && !isDone && (
              <Button variant="secondary" size="xs" onClick={onMarkDone}>
                <CheckCircle2 /> Done
              </Button>
            )}
          </>
        )}
      </span>
    </div>
  );
}

type Tone = { fg: string; bg: string };

// Figma "Project Detail" (1029:28628): one Process colour per phase bar.
const PHASE_TONE: Record<'phase1' | 'phase2' | 'phase3' | 'delivery', Tone> = {
  phase1:   { fg: 'var(--board-finalization-fg)', bg: 'var(--board-finalization-bg)' },
  phase2:   { fg: 'var(--board-technical-fg)', bg: 'var(--board-technical-bg)' },
  phase3:   { fg: 'var(--board-opportunity-fg)', bg: 'var(--board-opportunity-bg)' },
  delivery: { fg: 'var(--process-c4-fg)', bg: 'var(--process-c4-bg)' },
};
const CAT_ICON: Record<CategoryGroup, LucideIcon> = {
  millwork: Hammer, shelving: ShelvingUnit, ceiling: LampCeiling, image: Palette,
};

function Count({ done, total }: { done: number; total: number }) {
  return (
    <span className="shrink-0 whitespace-nowrap font-semibold leading-none">
      <span className="text-[32px]">{done}</span>
      <span className="text-[20px] font-normal">/{total}</span>
    </span>
  );
}

// 10px bar: solid track on the phase bar, outlined track on the white type card.
function Bar({ done, total, label, outlined }: { done: number; total: number; label: string; outlined?: boolean }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <span
      role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={`${label}: ${done} of ${total} steps done`}
      className={cn(
        'hidden h-2.5 w-[155px] shrink-0 overflow-hidden rounded-[2px] sm:block',
        outlined ? 'border-[1.5px] border-solid border-current' : 'bg-ui-page-bg',
      )}
    >
      <span className="block h-full rounded-[2px] bg-current transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </span>
  );
}

type StepState = 'done' | 'waiting' | 'rejected' | 'pending';
function stepState(rec: StepRecord | undefined): StepState {
  const s = rec?.status ?? 'pending';
  if (s === 'approved' || (s === 'done' && !rec?.notes)) return 'done';
  if (s === 'done') return 'waiting';
  if (s === 'rejected') return 'rejected';
  return 'pending';
}
const fmtStepDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

// Horizontal stepper (Figma 1031:29703): 29px boxes on a 2px line, label + date under each.
// Each box picks its step; the picked step's actions open underneath.
function Stepper({
  defs, records, selected, onSelect, tone,
}: {
  defs: StepDef[]; records: (StepRecord | undefined)[];
  selected: string | null; onSelect: (key: string) => void; tone: Tone;
}) {
  return (
    <div className="overflow-x-auto">
      <ol
        className="relative m-0 grid list-none px-4 pb-5 pt-[31px]"
        style={{ gridTemplateColumns: `repeat(${defs.length}, minmax(96px, 1fr))`, minWidth: defs.length * 96 + 32 }}
      >
        <span
          aria-hidden className="absolute top-[45px] h-0.5"
          style={{ left: `calc(16px + (100% - 32px) / ${defs.length * 2})`, right: `calc(16px + (100% - 32px) / ${defs.length * 2})`, background: tone.fg }}
        />
        {defs.map((d, i) => {
          const rec = records[i];
          const state = stepState(rec);
          const on = selected === d.key;
          return (
            <li key={d.key} className="relative flex flex-col items-center">
              <button
                type="button" onClick={() => onSelect(d.key)} aria-pressed={on}
                aria-label={`${d.label}: ${state === 'done' ? 'done' : state === 'waiting' ? 'waiting' : state === 'rejected' ? 'rejected' : 'not started'}`}
                className={cn(
                  'grid size-[29px] cursor-pointer place-items-center rounded-[6px] border-2 border-solid p-0 focus-visible:outline-2 focus-visible:outline-offset-2',
                  on && 'ring-2 ring-offset-2',
                )}
                style={{
                  borderColor: state === 'rejected' ? 'var(--status-t10-fg)' : tone.fg,
                  background: state === 'done' ? tone.fg : 'var(--ui-page-bg)',
                  color: state === 'done' ? 'var(--ui-page-bg)' : state === 'rejected' ? 'var(--status-t10-fg)' : tone.fg,
                  ['--tw-ring-color' as string]: tone.fg,
                }}
              >
                {state === 'done' ? <Check size={21} aria-hidden />
                  : state === 'waiting' ? <Clock size={16} aria-hidden />
                    : state === 'rejected' ? <X size={16} aria-hidden /> : null}
              </button>
              <span className="mt-[7px] flex w-full flex-col items-center gap-0.5 px-1 text-center" style={{ color: tone.fg }}>
                <span className="text-[14px] font-semibold leading-tight">
                  {d.label}
                  {d.isOptional && <span className="block text-[10px] font-normal opacity-80">optional</span>}
                </span>
                <span className="text-[13px] opacity-80">
                  {state === 'done' ? fmtStepDate(rec?.approved_at ?? rec?.completed_at) : '-'}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Coloured phase bar (Figma 1031:29310 closed, 1031:29574 open): icon, "Phase N" over the title,
// progress bar, done/total, chevron. Open, its cards sit on the same colour under a divider.
function PhaseBar({
  id, phaseNo, title, icon: Icon, tone, done, total, isOpen, onToggle, children,
}: {
  id: string; phaseNo: string; title: string; icon: LucideIcon; tone: Tone;
  done: number; total: number; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    // No overflow-hidden: a step's Dropbox menu must be able to open past the card edge.
    <div className="rounded-[8px]" style={{ background: tone.bg, color: tone.fg }}>
      <button
        type="button" onClick={onToggle} aria-expanded={isOpen} aria-controls={`wf-${id}`}
        className={cn('flex w-full cursor-pointer items-center gap-5 border-0 bg-transparent px-6 text-left text-inherit', isOpen ? 'py-3' : 'pb-4 pt-5')}
      >
        <Icon aria-hidden className="size-[35px] shrink-0" strokeWidth={1.5} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14px]">{phaseNo}</span>
          <span className="text-[20px] font-semibold leading-5">{title}</span>
        </span>
        <Bar done={done} total={total} label={title} />
        <Count done={done} total={total} />
        {isOpen ? <ChevronDown size={26} aria-hidden className="shrink-0" /> : <ChevronRight size={26} aria-hidden className="shrink-0" />}
      </button>
      {isOpen && (
        <div id={`wf-${id}`} className="flex flex-col gap-2 border-t px-3 pb-4 pt-4" style={{ borderColor: `color-mix(in srgb, ${tone.fg} 25%, transparent)` }}>
          {children}
        </div>
      )}
    </div>
  );
}

// White card inside an open phase (Figma 1031:29686). With a title it is a production type that
// opens and closes on its own; without one it just holds the phase's stepper.
function StepsCard({
  title, icon: Icon, tone, done, total, isOpen = true, onToggle, children,
}: {
  title?: string; icon?: LucideIcon; tone: Tone; done: number; total: number;
  isOpen?: boolean; onToggle?: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-[8px] bg-ui-page-bg" style={{ color: tone.fg }}>
      {title && (
        <button
          type="button" onClick={onToggle} aria-expanded={isOpen}
          className="flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-6 py-2 text-left text-inherit"
        >
          {Icon && <Icon aria-hidden className="size-[34px] shrink-0" strokeWidth={1.5} />}
          <span className="min-w-0 flex-1 text-[18px] font-semibold leading-5">{title}</span>
          <Bar done={done} total={total} label={title} outlined />
          <Count done={done} total={total} />
          {isOpen ? <ChevronDown size={26} aria-hidden className="shrink-0" /> : <ChevronRight size={26} aria-hidden className="shrink-0" />}
        </button>
      )}
      {isOpen && (
        <div className={cn(title && 'border-t')} style={{ borderColor: tone.bg }}>{children}</div>
      )}
    </div>
  );
}

export function ProjectWorkflow({
  projectId, dropboxRootPath, categories, userRole, userId,
  initialSteps, documents, onRequestUpload, onStepsChanged,
}: WorkflowProps) {
  const [steps, setSteps] = useState<StepRecord[]>(initialSteps);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { setSteps(initialSteps); }, [initialSteps]);

  // Figma 445:7500 shows one phase open: start on the first phase that still has open steps.
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const doneIn = (defs: StepDef[], phase: string, cat: string | null = null) => defs.every(s => {
      const r = findStep(initialSteps, phase, s.key, cat);
      return r?.status === 'done' || r?.status === 'approved';
    });
    const groups = getActiveCategoryGroups(categories);
    const order: [string, boolean][] = [
      ['phase1', doneIn(PHASE1_STEPS, 'phase1')],
      ['phase2', doneIn(PHASE2_STEPS, 'phase2')],
      ['phase3', groups.every(g => doneIn(CATEGORY_STEPS, 'phase3', g))],
      ['delivery', doneIn(DELIVERY_STEPS, 'delivery')],
    ];
    return new Set([order.find(([, d]) => !d)?.[0] ?? 'delivery']);
  });
  // Figma 1029:28628: the first type card is open, the rest closed.
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    () => new Set(getActiveCategoryGroups(categories).slice(0, 1)),
  );

  const activeGroups = getActiveCategoryGroups(categories);
  const canAct = !['tlines_pm', 'accounting', 'logistics'].includes(userRole);

  function toggleSection(id: string) {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleCategory(id: string) {
    setOpenCategories(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function upsertStep(
    phase: string, stepKey: string, catGroup: string | null,
    status: string, extra: Record<string, unknown> = {},
  ) {
    const key = `${phase}_${catGroup ?? ''}_${stepKey}`;
    setSaving(key);
    try {
      const res = await fetch(`/api/projects/${projectId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase, step_key: stepKey, cat_group: catGroup, status, ...extra }),
      });
      if (!res.ok) {
        const e = await res.json() as { error: string };
        throw new Error(e.error);
      }
      const { step } = await res.json() as { step: StepRecord };
      setSteps(prev => {
        const idx = prev.findIndex(s => s.phase === phase && s.step_key === stepKey && s.cat_group === catGroup);
        return idx >= 0 ? prev.map((s, i) => i === idx ? step : s) : [...prev, step];
      });
      onStepsChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally { setSaving(null); }
  }

  function countDone(defs: StepDef[], phase: string, catGroup?: string | null) {
    return defs.filter(s => {
      const r = findStep(steps, phase, s.key, catGroup);
      return r?.status === 'done' || r?.status === 'approved';
    }).length;
  }

  // The stepper box picked in each card (key "phase:catGroup"); defaults to the first open step.
  const [picked, setPicked] = useState<Record<string, string>>({});

  function renderStepper(defs: StepDef[], phase: StepPhase, catGroup: string | null, tone: Tone) {
    const records = defs.map(d => findStep(steps, phase, d.key, catGroup));
    const cardKey = `${phase}:${catGroup ?? ''}`;
    const selectedKey = picked[cardKey]
      ?? defs[records.findIndex(r => stepState(r) !== 'done')]?.key
      ?? defs[defs.length - 1]?.key ?? null;
    const idx = defs.findIndex(d => d.key === selectedKey);
    const step = defs[idx];
    return (
      <>
        <Stepper
          defs={defs} records={records} tone={tone}
          selected={selectedKey} onSelect={key => setPicked(prev => ({ ...prev, [cardKey]: key }))}
        />
        {step && (
          <div className="overflow-visible rounded-b-[8px] border-t border-ui-divider [&>div]:rounded-b-[8px]">
            <StepRow
              num={idx + 1}
              stepDef={step}
              stepRecord={records[idx]}
              docs={findAllDocsForStep(documents, step.key, catGroup, step.docType)}
              canAct={canAct && saving !== `${phase}_${catGroup ?? ''}_${step.key}`}
              onMarkDone={() => upsertStep(phase, step.key, catGroup, 'done', { completed_by: userId, completed_at: new Date().toISOString() })}
              onApprove={(v) => upsertStep(phase, step.key, catGroup, 'approved', { approved_by: userId, approved_at: new Date().toISOString(), version_approved: v ?? null })}
              onSynced={onStepsChanged}
              projectId={projectId}
              dropboxRootPath={dropboxRootPath}
              catGroup={catGroup}
            />
          </div>
        )}
      </>
    );
  }

  const p3Total = activeGroups.length * CATEGORY_STEPS.length;
  const p3Done  = activeGroups.reduce((s, g) => s + countDone(CATEGORY_STEPS, 'phase3', g), 0);

  const simplePhases: { id: 'phase1' | 'phase2' | 'delivery'; no: string; title: string; icon: LucideIcon; defs: StepDef[] }[] = [
    { id: 'phase1', no: 'Phase 1', title: 'Finalization', icon: DraftingCompass, defs: PHASE1_STEPS },
    { id: 'phase2', no: 'Phase 2', title: 'Construction Documents', icon: FileBox, defs: PHASE2_STEPS },
    { id: 'delivery', no: 'Phase 4', title: 'Delivery', icon: Package, defs: DELIVERY_STEPS },
  ];
  const simple = (id: 'phase1' | 'phase2' | 'delivery') => {
    const p = simplePhases.find(x => x.id === id)!;
    const tone = PHASE_TONE[id];
    const done = countDone(p.defs, id);
    return (
      <PhaseBar
        key={id} id={id} phaseNo={p.no} title={p.title} icon={p.icon} tone={tone}
        done={done} total={p.defs.length}
        isOpen={openSections.has(id)} onToggle={() => toggleSection(id)}
      >
        <StepsCard tone={tone} done={done} total={p.defs.length}>
          {renderStepper(p.defs, id, null, tone)}
        </StepsCard>
      </PhaseBar>
    );
  };

  return (
    <section aria-label="Workflow" className="flex flex-col gap-4">
      {saving && (
        <span role="status" className="flex items-center gap-1.5 text-[12px] text-ui-text-secondary">
          <Loader2 size={12} className="animate-spin" aria-hidden /> Saving…
        </span>
      )}

      {simple('phase1')}
      {simple('phase2')}

      <PhaseBar
        id="phase3" phaseNo="Phase 3" title="Production" icon={Factory} tone={PHASE_TONE.phase3}
        done={p3Done} total={p3Total}
        isOpen={openSections.has('phase3')} onToggle={() => toggleSection('phase3')}
      >
        {activeGroups.length === 0 ? (
          <div className="rounded-[8px] bg-ui-page-bg px-6 py-4 text-[13px] text-ui-text-secondary">
            No production categories selected.
          </div>
        ) : activeGroups.map(group => {
          const tone = PHASE_TONE.phase3;
          return (
            <StepsCard
              key={group} title={CAT_GROUP_LABELS[group]} icon={CAT_ICON[group]} tone={tone}
              done={countDone(CATEGORY_STEPS, 'phase3', group)} total={CATEGORY_STEPS.length}
              isOpen={openCategories.has(group)} onToggle={() => toggleCategory(group)}
            >
              {renderStepper(CATEGORY_STEPS, 'phase3', group, tone)}
            </StepsCard>
          );
        })}
      </PhaseBar>

      {simple('delivery')}
    </section>
  );
}
