'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, RotateCcw, Search, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TrashedProject {
  id: string;
  code: string;
  name: string;
  current_stage: string;
  categories: string[];
  deleted_at: string;
  deal_value: number | null;
  currency: string;
  deleted_by: string | null;
}

interface ConflictState {
  projectId: string;
  projectName: string;
  existingName: string;
  code: string;
}

// Figma "Supply / Project / Trash" (node 210:21274) — same layout as the Contacts trash.
const HEADING_TEXT = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const RESTORE_BTN = 'inline-flex shrink-0 items-center gap-[7px] rounded-[6px] border border-ui-divider bg-ui-input-bg px-2.5 py-[7px] text-[13px] font-medium text-ui-body hover:bg-ui-hover-bg disabled:opacity-50 [&_svg]:size-4';
const DELETE_BTN = 'inline-flex shrink-0 items-center rounded-[6px] border-0 px-2.5 py-[7px] text-[13px] font-medium hover:brightness-95 disabled:opacity-50';
const DELETE_STYLE: React.CSSProperties = { background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' };
const TH_CLS = 'whitespace-nowrap px-2.5 py-2.5 text-left text-[12px] font-medium text-ui-text-secondary first:pl-3 last:pr-3';
const TD_CLS = 'px-2.5 py-3.5 align-middle text-[12px] leading-[1.45] text-ui-body first:pl-3 last:pr-3';
const CHECKBOX_CLS = 'size-4 cursor-pointer accent-[var(--color-secondary-700)]';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const DATE_ONLY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function daysLeft(deletedAt: string, purgeDays: number): number {
  return Math.max(0, purgeDays - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86_400_000));
}

function autoDeleteDate(deletedAt: string, left: number, purgeDays: number): string {
  if (left <= 0) return 'Due for removal';
  return DATE_ONLY.format(new Date(new Date(deletedAt).getTime() + purgeDays * 86_400_000));
}

export function TrashClient({ projects, purgeDays }: { projects: TrashedProject[]; purgeDays: number }) {
  const router = useRouter();
  const [query, setQuery]       = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy]         = useState(false);
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p =>
      [p.name, p.code, p.deleted_by ?? '', ...(p.categories ?? [])].some(v => v.toLowerCase().includes(q)),
    );
  }, [projects, query]);

  const selectedItems = visible.filter(p => selected.has(p.id));
  const allSelected = visible.length > 0 && selectedItems.length === visible.length;

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visible.map(p => p.id)));
  }

  // Runs the existing per-project endpoints one by one — they carry their own authorization and
  // audit logging. A restore that hits a code conflict (409) opens the conflict dialog instead.
  async function run(targets: TrashedProject[], kind: 'restore' | 'purge') {
    if (targets.length === 0) return;
    if (kind === 'purge') {
      const label = targets.length === 1 ? `"${targets[0].name}"` : `${targets.length} projects`;
      if (!window.confirm(`Permanently delete ${label}? This cannot be undone.`)) return;
    }
    setBusy(true);
    let failed = 0;
    let lastError = '';
    let conflictHit: ConflictState | null = null;
    for (const p of targets) {
      const res = await fetch(
        kind === 'restore' ? `/api/projects/${p.id}/restore` : `/api/projects/${p.id}/permanent-delete`,
        { method: kind === 'restore' ? 'POST' : 'DELETE' },
      ).catch(() => null);
      if (res?.ok) continue;
      failed++;
      const body = res ? await res.json().catch(() => ({})) as { conflict?: boolean; existingName?: string; code?: string; error?: string } : {};
      if (kind === 'restore' && res?.status === 409 && body.conflict && !conflictHit) {
        conflictHit = { projectId: p.id, projectName: p.name, existingName: body.existingName ?? '', code: body.code ?? p.code };
      } else {
        lastError = body.error ?? '';
      }
    }
    setBusy(false);
    setSelected(new Set());
    const done = targets.length - failed;
    if (done > 0) toast.success(`${kind === 'restore' ? 'Restored' : 'Permanently deleted'} ${done} project${done === 1 ? '' : 's'}`);
    if (conflictHit) setConflict(conflictHit);
    else if (failed > 0) toast.error(lastError || `Could not ${kind === 'restore' ? 'restore' : 'delete'} ${failed} project${failed === 1 ? '' : 's'}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <p className="m-0 text-[11px] font-semibold text-ui-nav-active">Supply / Projects / Trash</p>
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING_TEXT)}>Trash</h1>
        <p className="m-0 text-[13px] text-ui-body">
          Deleted items remain here for {purgeDays} days. Restoring a project also restores its related tasks and files.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-[6px] p-3" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-fg)' }} role="note">
        <TriangleAlert size={16} className="shrink-0" aria-hidden />
        <p className="m-0 flex-1 text-[12px] leading-[1.45]">
          Permanent deletion cannot be undone. Items are automatically removed on the dates below; only Ops and General Managers can delete them sooner.
        </p>
      </div>

      {conflict && (
        <div role="dialog" aria-modal="true" aria-labelledby="trash-conflict-title" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
          <div className="flex w-[90%] max-w-[420px] flex-col gap-3.5 rounded-[10px] border border-ui-divider bg-ui-surface-elevated p-7 shadow-xl">
            <div className="flex items-center gap-2.5">
              <TriangleAlert size={20} style={{ color: 'var(--status-warning-fg)' }} aria-hidden />
              <span id="trash-conflict-title" className={cn('text-[15px] font-semibold', HEADING_TEXT)}>Code conflict</span>
            </div>
            <p className="m-0 text-[13px] text-ui-body">
              An active project already uses code <strong>{conflict.code}</strong>:
            </p>
            <div className="rounded-[6px] px-3.5 py-2.5 text-[13px] font-semibold" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-fg)' }}>
              {conflict.existingName}
            </div>
            <p className="m-0 text-[13px] text-ui-body">
              You can permanently delete the trashed version, or go update the active project&apos;s code first.
            </p>
            <div className="flex justify-end gap-2.5">
              <button type="button" className={RESTORE_BTN} onClick={() => setConflict(null)}>Cancel</button>
              <button
                type="button"
                className={DELETE_BTN}
                style={DELETE_STYLE}
                disabled={busy}
                onClick={async () => {
                  const target = projects.find(p => p.id === conflict.projectId);
                  setConflict(null);
                  if (target) await run([target], 'purge');
                }}
              >
                Delete trashed version forever
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5 rounded-[10px] border border-ui-divider bg-ui-surface-elevated p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-[380px]">
            <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" aria-hidden />
            <input
              className="form-input"
              style={{ height: 40, paddingLeft: 34, fontSize: 13, borderRadius: 6, borderColor: 'var(--ui-input-border)', background: 'var(--ui-input-bg)' }}
              placeholder="Search deleted items…" value={query} onChange={e => setQuery(e.target.value)}
              aria-label="Search deleted items"
            />
          </div>
          {selectedItems.length > 0 && (
            <div className="flex items-center gap-2.5">
              <span className="text-[12px] leading-[1.45] text-ui-text-secondary">{selectedItems.length} selected</span>
              <button type="button" className={RESTORE_BTN} disabled={busy} onClick={() => run(selectedItems, 'restore')}>
                <RotateCcw aria-hidden /> Restore selected
              </button>
              <button type="button" className={DELETE_BTN} style={DELETE_STYLE} disabled={busy} onClick={() => run(selectedItems, 'purge')}>
                Delete permanently
              </button>
            </div>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-[13px] text-ui-text-secondary">
            <Trash2 size={28} className="opacity-40" aria-hidden />
            {query.trim() ? 'No deleted items match your search.' : 'Trash is empty. Deleted projects will appear here.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse" style={{ opacity: busy ? 0.6 : 1 }}>
              <thead>
                <tr className="bg-ui-surface">
                  <th className={cn(TH_CLS, 'w-9')}>
                    <input type="checkbox" className={CHECKBOX_CLS} checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                  </th>
                  <th className={TH_CLS}>Item</th>
                  <th className={cn(TH_CLS, 'w-[150px]')}>Deleted by</th>
                  <th className={cn(TH_CLS, 'w-[190px]')}>Deleted at</th>
                  <th className={cn(TH_CLS, 'w-[150px]')}>Auto-delete date</th>
                  <th className={cn(TH_CLS, 'w-[260px]')}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(p => {
                  const isSelected = selected.has(p.id);
                  const left = daysLeft(p.deleted_at, purgeDays);
                  const subtitle = ['Project', p.code, (p.categories ?? []).join(', ')].filter(Boolean).join(' · ');
                  return (
                    <tr key={p.id} className={cn('border-b border-ui-divider', isSelected ? 'bg-ui-selected-bg' : 'bg-ui-surface-elevated')}>
                      <td className={TD_CLS}>
                        <input type="checkbox" className={CHECKBOX_CLS} checked={isSelected} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} />
                      </td>
                      <td className={TD_CLS}>
                        <div className="flex flex-col gap-1">
                          <span className="text-[13px] font-medium text-ui-body">{p.name}</span>
                          <span className="text-[11px] text-ui-text-secondary">{subtitle}</span>
                        </div>
                      </td>
                      <td className={TD_CLS}>{p.deleted_by ?? '—'}</td>
                      <td className={TD_CLS}>{DATE_TIME.format(new Date(p.deleted_at))}</td>
                      <td className={TD_CLS}>
                        <span style={left <= 5 ? { color: 'var(--status-t10-fg)' } : undefined}>{autoDeleteDate(p.deleted_at, left, purgeDays)}</span>
                      </td>
                      <td className={TD_CLS}>
                        <div className="flex items-center gap-2.5">
                          <button type="button" className={RESTORE_BTN} disabled={busy} onClick={() => run([p], 'restore')}>
                            <RotateCcw aria-hidden /> Restore
                          </button>
                          <button type="button" className={DELETE_BTN} style={DELETE_STYLE} disabled={busy} onClick={() => run([p], 'purge')}>
                            Delete forever
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="m-0 text-[12px] leading-[1.45] text-ui-text-secondary">
          {projects.length} deleted item{projects.length === 1 ? '' : 's'} · Restored items return to their original location and retain their history.
        </p>
      </div>
    </div>
  );
}
