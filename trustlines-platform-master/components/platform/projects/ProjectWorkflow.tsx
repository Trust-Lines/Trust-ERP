'use client';

import { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2, Circle, Clock, XCircle, ExternalLink,
  ThumbsUp, Loader2, ChevronDown, ChevronRight, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  PHASE1_STEPS, PHASE2_STEPS, CATEGORY_STEPS, DELIVERY_STEPS,
  CAT_GROUP_LABELS, CAT_GROUP_COLORS, getActiveCategoryGroups,
  findStep, findAllDocsForStep,
  type StepDef, type StepRecord,
} from '@/lib/workflow/steps';
import type { ProjectCategory } from '@/types/database';
import { Select } from '@/components/platform/shared/Select';
import { EmptyState } from '@/components/ui/empty-state';
import { feedback } from '@/components/ui/feedback-toast';

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
  const [loading, setLoading] = useState(false);
  async function open() {
    setLoading(true);
    try {
      const res = await fetch(`/api/files/view?documentId=${documentId}`);
      if (!res.ok) throw new Error('Cannot open');
      const { link } = await res.json() as { link: string };
      window.open(link, '_blank');
    } catch { toast.error('Could not open file from Dropbox'); }
    finally { setLoading(false); }
  }
  return (
    <button
      onClick={open} disabled={loading}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 9px', borderRadius: 4,
        fontSize: 11, fontWeight: 600, cursor: 'pointer',
        background: 'var(--brand-teal-100)', color: 'var(--brand-teal-600)',
        border: '1px solid #9ecfcf',
      }}
    >
      {loading
        ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
        : <ExternalLink size={10} />}
      View V{dropboxVersion ?? 0}
    </button>
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
        <button
          onClick={() => { onApprove(stepDef.requiresVersionSelect ? ver : undefined); setOpen(false); }}
          style={{
            padding: '3px 9px', borderRadius: 4, fontSize: 11, fontWeight: 600,
            background: 'var(--phase-done)', color: 'white', border: 'none', cursor: 'pointer',
          }}
        >
          ✓ Confirm
        </button>
        <button
          onClick={() => setOpen(false)}
          style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)' }}
        >×</button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '3px 9px', borderRadius: 4,
        fontSize: 11, fontWeight: 600, cursor: 'pointer',
        background: 'var(--status-success-bg)', color: 'var(--status-success-fg)',
        border: '1px solid #a7e3be',
      }}
    >
      <ThumbsUp size={10} />
      {stepDef.requiresVersionSelect ? 'Select & Approve' : 'Approve'}
    </button>
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

  async function openInDropbox(path: string) {
    try {
      const res  = await fetch(`/api/files/view-by-path?path=${encodeURIComponent(path)}&projectId=${encodeURIComponent(projectId)}`);
      const data = await res.json() as { link?: string };
      if (data.link) window.open(data.link, '_blank');
    } catch { }
  }

  const totalFiles = results ? results.reduce((s, g) => s + g.files.length, 0) : 0;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        title="Dropbox versiyonlarını gör"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
          fontSize: 11, fontWeight: 600,
          background: open ? '#e1f0f0' : 'var(--bg-subtle)',
          color: open ? '#1a6b6b' : 'var(--fg-muted)',
          border: `1px solid ${open ? '#9ecfcf' : 'var(--border-default)'}`,
          transition: 'all 100ms',
        }}
      >
        {scanning
          ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
          : <RefreshCw size={10} />}
        Dropbox
        {results !== null && totalFiles > 0 && (
          <span style={{
            marginLeft: 2, padding: '0 5px', borderRadius: 99,
            fontSize: 9, fontWeight: 800,
            background: '#1a6b6b', color: 'white',
          }}>{totalFiles}</span>
        )}
      </button>

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
                        <div style={{ fontSize: 10, color: '#16a34a', marginTop: 1 }}>✓ Linked</div>
                      )}
                    </div>

                    {alreadyLinked ? (
                      <button
                        onClick={() => openInDropbox(f.path)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '3px 8px', borderRadius: 4,
                          fontSize: 10, fontWeight: 600, cursor: 'pointer',
                          background: '#d1fae5', color: '#065f46',
                          border: '1px solid #6ee7b7', flexShrink: 0,
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
                          border: '1px solid #9ecfcf', flexShrink: 0,
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
      <span style={{ fontSize: 10, color: 'var(--fg-faint)', fontWeight: 700, width: 14, textAlign: 'right', flexShrink: 0, marginTop: 2 }}>
        {num}
      </span>

      <span style={{ flexShrink: 0, lineHeight: 0, marginTop: 1 }}>
        {(isDone || isApproved)
          ? <CheckCircle2 size={15} color="var(--phase-done)" strokeWidth={2} />
          : isWaiting
            ? <Clock size={15} color="#f59e0b" strokeWidth={1.5} />
            : isRejected
              ? <XCircle size={15} color="#dc2626" strokeWidth={1.5} />
              : <Circle size={15} color="var(--border-strong)" strokeWidth={1.5} />}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, color: (isDone || isApproved) ? 'var(--fg-subtle)' : 'var(--fg-default)', fontWeight: (isDone || isApproved) ? 400 : 500 }}>
          {stepDef.label}
          {stepDef.isOptional && (
            <span style={{ fontSize: 10, color: 'var(--fg-faint)', fontWeight: 400, marginLeft: 5 }}>optional</span>
          )}
        </span>
        {isDone && (stepRecord?.completed_at || stepRecord?.approved_at) && (
          <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            {new Date((stepRecord.approved_at ?? stepRecord.completed_at)!).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
            {stepRecord?.version_approved != null && (
              <span style={{ fontWeight: 700, color: 'var(--phase-done)', fontSize: 10 }}>V{stepRecord.version_approved}</span>
            )}
          </div>
        )}
        {isWaiting && stepRecord?.notes && (
          <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={9} />
            {stepRecord.notes}
          </div>
        )}
        {isRejected && stepRecord?.notes && (
          <div style={{ fontSize: 11, color: '#dc2626', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
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
              <button
                onClick={onMarkDone}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '3px 9px', borderRadius: 4,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: 'var(--bg-subtle)', color: 'var(--fg-muted)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <CheckCircle2 size={10} /> Done
              </button>
            )}
          </>
        )}
      </span>
    </div>
  );
}

function ProgressBar({ done, total, color }: { done: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ width: 60, height: 4, background: 'var(--border-subtle)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: done === total && total > 0 ? 'var(--phase-done)' : color, borderRadius: 99, transition: 'width 300ms' }} />
      </div>
      <span style={{ fontSize: 11, color: done === total && total > 0 ? 'var(--phase-done)' : 'var(--fg-subtle)', fontWeight: 600 }}>
        {done}/{total}
      </span>
    </div>
  );
}

// Figma "Project Detail" (node 445:7500) phase card: big done/total, "Phase N" over the title,
// chevron, a 10px progress bar; opening it lists the steps under a divider.
function AccordionSection({
  id, phaseNo, title, color, done, total, isOpen, onToggle, children,
}: {
  id: string; phaseNo: string; title: string; color: string;
  done: number; total: number; isOpen: boolean;
  onToggle: () => void; children: React.ReactNode;
}) {
  const allDone = done === total && total > 0;
  const tone = allDone ? 'var(--status-t9-fg)' : color;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    // No overflow-hidden: a step's Dropbox menu must be able to open past the card edge.
    <div className="rounded-[8px] border border-ui-divider bg-ui-surface">
      <button
        type="button" onClick={onToggle} aria-expanded={isOpen} aria-controls={`wf-${id}`}
        className="flex w-full cursor-pointer flex-col gap-4 border-0 bg-transparent px-2 pb-4 pt-5 text-left"
      >
        <span className="flex w-full items-center gap-5 px-4" style={{ color: tone }}>
          <span className="shrink-0 whitespace-nowrap font-semibold leading-none">
            <span className="text-[32px]">{done}</span><span className="text-[20px] font-normal">/{total}</span>
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[14px]">{phaseNo}</span>
            <span className="text-[20px] font-semibold leading-5">{title}</span>
          </span>
          {isOpen ? <ChevronDown size={22} aria-hidden className="shrink-0" /> : <ChevronRight size={22} aria-hidden className="shrink-0" />}
        </span>
        <span
          role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={`${title}: ${done} of ${total} steps done`}
          className="block h-2.5 w-full overflow-hidden rounded-[2px] bg-ui-divider"
        >
          <span className="block h-full rounded-[2px] transition-[width] duration-300" style={{ width: `${pct}%`, background: tone }} />
        </span>
      </button>

      {isOpen && (
        <div id={`wf-${id}`} className="border-t border-ui-divider [&>*:last-child]:rounded-b-[7px]">{children}</div>
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
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    new Set(['millwork', 'shelving', 'ceiling', 'image']),
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

  function renderSteps(
    defs: StepDef[], phase: string, catGroup: string | null,
  ) {
    return defs.map((step, i) => {
      const rec  = findStep(steps, phase, step.key, catGroup);
      const docs = findAllDocsForStep(documents, step.key, catGroup, step.docType);
      return (
        <StepRow
          key={step.key}
          num={i + 1}
          stepDef={step}
          stepRecord={rec}
          docs={docs}
          canAct={canAct && saving !== `${phase}_${catGroup ?? ''}_${step.key}`}
          onMarkDone={() => upsertStep(phase, step.key, catGroup, 'done', { completed_by: userId, completed_at: new Date().toISOString() })}
          onApprove={(v) => upsertStep(phase, step.key, catGroup, 'approved', { approved_by: userId, approved_at: new Date().toISOString(), version_approved: v ?? null })}
          onSynced={onStepsChanged}
          projectId={projectId}
          dropboxRootPath={dropboxRootPath}
          catGroup={catGroup}
        />
      );
    });
  }

  const p3Total = activeGroups.length * CATEGORY_STEPS.length;
  const p3Done  = activeGroups.reduce((s, g) => s + countDone(CATEGORY_STEPS, 'phase3', g), 0);

  return (
    <section className="flex flex-col gap-8 rounded-[8px] border border-ui-divider bg-ui-page-bg px-[18px] pb-8 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-[20px] font-semibold tracking-[0.4px] text-[var(--color-secondary-700)] dark:text-ui-heading">Workflow</h2>
        {saving && (
          <span className="flex items-center gap-1.5 text-[12px] text-ui-text-secondary">
            <Loader2 size={12} className="animate-spin" aria-hidden /> Saving…
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 2xl:grid-cols-4">

        <AccordionSection
          id="phase1"
          phaseNo="Phase 1" title="Finalization"
          color="var(--color-secondary-700)"
          done={countDone(PHASE1_STEPS, 'phase1')}
          total={PHASE1_STEPS.length}
          isOpen={openSections.has('phase1')}
          onToggle={() => toggleSection('phase1')}
        >
          {renderSteps(PHASE1_STEPS, 'phase1', null)}
        </AccordionSection>

        <AccordionSection
          id="phase2"
          phaseNo="Phase 2" title="Construction Documents"
          color="var(--status-t2-fg)"
          done={countDone(PHASE2_STEPS, 'phase2')}
          total={PHASE2_STEPS.length}
          isOpen={openSections.has('phase2')}
          onToggle={() => toggleSection('phase2')}
        >
          {renderSteps(PHASE2_STEPS, 'phase2', null)}
        </AccordionSection>

        <AccordionSection
          id="phase3"
          phaseNo="Phase 3" title="Production"
          color="var(--status-t4-fg)"
          done={p3Done}
          total={p3Total}
          isOpen={openSections.has('phase3')}
          onToggle={() => toggleSection('phase3')}
        >
          {activeGroups.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--fg-faint)' }}>
              No production categories selected.
            </div>
          ) : (
            <div style={{ padding: '10px' }}>
              {activeGroups.map(group => {
                const { color, bg, border } = CAT_GROUP_COLORS[group];
                const gDone  = countDone(CATEGORY_STEPS, 'phase3', group);
                const isOpen = openCategories.has(group);

                return (
                  <div
                    key={group}
                    style={{ border: `1px solid ${border}`, borderRadius: 5, marginBottom: 6 }}
                  >
                    <button
                      onClick={() => toggleCategory(group)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 14px',
                        background: isOpen ? bg : 'var(--bg-surface)',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                        borderBottom: isOpen ? `1.5px solid ${border}` : 'none',
                        borderRadius: isOpen ? '5px 5px 0 0' : 5,
                      }}
                    >
                      <span style={{ color, lineHeight: 0, flexShrink: 0 }}>
                        {isOpen
                          ? <ChevronDown size={13} strokeWidth={2.5} />
                          : <ChevronRight size={13} strokeWidth={2.5} />}
                      </span>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color }}>
                        {CAT_GROUP_LABELS[group]}
                      </span>
                      <ProgressBar done={gDone} total={CATEGORY_STEPS.length} color={color} />
                    </button>

                    {isOpen && renderSteps(CATEGORY_STEPS, 'phase3', group)}
                  </div>
                );
              })}
            </div>
          )}
        </AccordionSection>

        <AccordionSection
          id="delivery"
          phaseNo="Phase 4" title="Delivery"
          color="var(--status-t8-fg)"
          done={countDone(DELIVERY_STEPS, 'delivery')}
          total={DELIVERY_STEPS.length}
          isOpen={openSections.has('delivery')}
          onToggle={() => toggleSection('delivery')}
        >
          {renderSteps(DELIVERY_STEPS, 'delivery', null)}
        </AccordionSection>

      </div>
    </section>
  );
}
