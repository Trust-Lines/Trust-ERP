'use client';

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownCircle, FileText, Tag, Trash2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { BUCKET_LABELS, TYPE_ORDER, type PProject } from '@/lib/excel/projectsExcelExport';
import type { PfGroup } from './ProductionFlags';

// Production tracker project menu — Trust System ProjectMenu / AddToGroupModal behaviour on T-ERP
// data (/api/production/blocks/:id, /api/production/pf-groups). Opens with a right click on a
// Project # box or a project header, under that header, aligned to its left edge; it follows the
// header while the board scrolls. Esc, a click outside or a second right click closes it.

const TRUST_PRICE_LIST = 'https://trust-excel.vercel.app/price-list?projectId=';
const ITEM = 'flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-1.5 text-left text-[13px] text-ui-body hover:bg-ui-hover-bg disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ui-focus-ring';
const INPUT = 'h-8 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-2.5 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-ui-focus-ring';
const SEP = <div className="my-1 h-px bg-ui-divider" role="separator" />;

type Mode = null | 'name' | 'address' | 'types' | 'region';

export interface ProjectMenuProps {
  project: PProject;
  /** data-project-head value of the project's header row. */
  headKey: string;
  canEdit: boolean;
  canDeleteProject: boolean;
  groups: PfGroup[];
  onGroupsChanged: () => void;
  onSaved: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Where the menu sits: under the header row, at its visible left edge (4px gap). */
function anchorPos(headKey: string): { left: number; top: number } | null {
  const head = document.querySelector<HTMLElement>(`[data-project-head="${CSS.escape(headKey)}"]`);
  if (!head) return null;
  const row = head.getBoundingClientRect();
  const btn = head.querySelector('button')?.getBoundingClientRect();
  return { left: Math.max(8, Math.min(btn?.left ?? row.left, window.innerWidth - 268)), top: row.bottom + 4 };
}

export function ProjectMenu({ project, headKey, canEdit, canDeleteProject, groups, onGroupsChanged, onSaved, onDelete, onClose }: ProjectMenuProps) {
  const kind = project.kind ?? 'project';
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [groupOpen, setGroupOpen] = useState(false);

  // Follow the header while the page or the board scrolls.
  useLayoutEffect(() => {
    let raf = 0;
    const place = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const p = anchorPos(headKey); if (p) setPos(p); else onClose(); }); };
    setPos(anchorPos(headKey));
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [headKey, onClose]);

  useEffect(() => {
    if (groupOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (mode) setMode(null); else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, onClose, groupOpen]);

  async function save(body: Record<string, unknown>, ok: string, fail: string): Promise<boolean> {
    if (!project.id) return false;
    setBusy(true);
    const res = await fetch(`/api/production/blocks/${project.id}?kind=${kind}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => null);
    const b = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) { toast.error(b?.error ?? fail); return false; }
    toast.success(ok);
    onSaved();
    return true;
  }

  const startEdit = (m: 'name' | 'address') => { setText(m === 'name' ? project.editName ?? '' : project.editAddress ?? ''); setMode(m); };

  if (!pos) return null;
  const regionNow = project.bucket;
  const projectLabel = project.editName || String(project.projectNo);

  return (
    <>
      {!groupOpen && (
        <div className="fixed inset-0 z-40" aria-hidden onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }} />
      )}
      <div data-board-popup role="menu" aria-label={`Project ${project.projectNo}`}
        className={cn('fixed z-50 flex min-w-[200px] max-w-[260px] flex-col rounded-[6px] border border-ui-divider bg-ui-surface-elevated py-1 shadow-03',
          busy && 'pointer-events-none opacity-60', groupOpen && 'hidden')}
        style={{ left: pos.left, top: pos.top }}
        onContextMenu={e => e.preventDefault()}>
        <button type="button" role="menuitem" className={cn(ITEM, 'text-[var(--color-primary-600,#2563eb)]')} disabled={!project.trustId}
          title={project.trustId ? undefined : 'This project has no Trust System record'}
          onClick={() => { window.open(`${TRUST_PRICE_LIST}${encodeURIComponent(project.trustId!)}`, '_blank', 'noopener'); onClose(); }}>
          <FileText size={14} aria-hidden /> Belge Hazırla
        </button>

        {canEdit && (
          <>
            {SEP}
            <button type="button" role="menuitem" className={cn(ITEM, project.isUrgent ? 'text-success-normal' : 'text-error-normal')}
              onClick={async () => { onClose(); await save({ isUrgent: !project.isUrgent }, project.isUrgent ? 'Urgent removed' : 'Marked urgent', 'Failed to update urgent status.'); }}>
              {project.isUrgent ? <ArrowDownCircle size={14} aria-hidden /> : <TriangleAlert size={14} aria-hidden />}
              {project.isUrgent ? 'Remove Urgent' : 'Make Urgent'}
            </button>
            {kind === 'project' && (
              <button type="button" role="menuitem" className={ITEM} onClick={() => setGroupOpen(true)}>
                <Tag size={14} aria-hidden /> {groups.length ? 'Add to Group...' : 'Create Group'}
              </button>
            )}
            {SEP}

            {(['name', 'address'] as const).map(m => mode === m ? (
              <div key={m} className="flex flex-col gap-1 px-3 py-1.5">
                <input autoFocus aria-label={m === 'name' ? 'Project name' : 'Project address'} className={INPUT} value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Escape') { e.stopPropagation(); setMode(null); }
                    if (e.key === 'Enter' && (m === 'address' || text.trim())) {
                      if (await save({ [m]: text }, m === 'name' ? 'Name saved' : 'Address saved', 'Could not save')) onClose();
                    }
                  }} />
                <span className="text-[11px] text-ui-text-secondary">Press Enter to save</span>
              </div>
            ) : (
              <button key={m} type="button" role="menuitem" className={ITEM} onClick={() => startEdit(m)}>
                {m === 'name' ? 'Edit Name' : 'Edit Address'}
              </button>
            ))}

            {mode === 'types'
              ? <TypesEditor project={project} busy={busy} onCancel={() => setMode(null)}
                  onSave={async (add, remove) => { if (await save({ types: { add, remove } }, 'Types saved', 'Could not save the types')) onClose(); }} />
              : <button type="button" role="menuitem" className={ITEM} onClick={() => setMode('types')}>Edit Types</button>}

            {mode === 'region' ? (
              <div className="flex flex-col gap-1 px-3 py-1.5">
                <span className="text-[12px] font-medium text-ui-heading">Move project to another region:</span>
                {BUCKET_LABELS.filter(b => b.bucket !== regionNow).map(b => (
                  <button key={b.bucket} type="button" className="h-7 cursor-pointer rounded-[4px] border border-ui-divider bg-ui-surface px-2 text-left text-[12px] text-ui-body hover:bg-ui-hover-bg"
                    onClick={async () => { if (await save({ bucket: b.bucket }, `Moved to ${b.label}`, 'Failed to update project bucket. Please try again.')) onClose(); }}>
                    {b.label}
                  </button>
                ))}
              </div>
            ) : (
              <button type="button" role="menuitem" className={ITEM} onClick={() => setMode('region')}>Move Region</button>
            )}

            {(kind !== 'project' || canDeleteProject) && (
              <>
                {SEP}
                <button type="button" role="menuitem" className={cn(ITEM, 'text-error-normal hover:bg-error-light')} onClick={() => { onClose(); onDelete(); }}>
                  <Trash2 size={14} aria-hidden /> Delete Project
                </button>
              </>
            )}
          </>
        )}
      </div>
      {groupOpen && project.id && (
        <AddToGroupModal projectId={project.id} projectLabel={projectLabel} types={typesOf(project)} groups={groups}
          onChanged={onGroupsChanged} onClose={onClose} />
      )}
    </>
  );
}

/** The project's types in board order (standard first, then custom). */
function typesOf(project: PProject): { type: string; custom: boolean; rows: number }[] {
  const count = new Map<string, { custom: boolean; rows: number }>();
  for (const it of project.items ?? []) {
    const type = it.type ?? '';
    if (!type) continue;
    const c = count.get(type) ?? { custom: !!it.customTypeCode || !TYPE_ORDER.includes(type), rows: 0 };
    c.rows += 1;
    count.set(type, c);
  }
  return [...count.entries()].map(([type, c]) => ({ type, ...c }))
    .sort((a, b) => (TYPE_ORDER.indexOf(a.type) + 1 || 99) - (TYPE_ORDER.indexOf(b.type) + 1 || 99));
}

function TypesEditor({ project, busy, onSave, onCancel }: {
  project: PProject; busy: boolean; onCancel: () => void;
  onSave: (add: { type: string }[], remove: string[]) => void;
}) {
  const current = useMemo(() => typesOf(project), [project]);
  const [custom, setCustom] = useState<string[]>([]);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(current.map(t => t.type)));
  const [newType, setNewType] = useState('');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const all = [
    ...TYPE_ORDER.map(t => ({ type: t, custom: false })),
    ...current.filter(t => !TYPE_ORDER.includes(t.type)).map(t => ({ type: t.type, custom: true })),
    ...custom.map(t => ({ type: t, custom: true })),
  ];
  const removed = current.filter(t => !checked.has(t.type));
  const added = [...checked].filter(t => !current.some(c => c.type === t));
  const losing = removed.filter(t => t.rows > 0);

  function addCustom() {
    const name = newType.replace(/\s+/g, ' ').trim();
    if (!/[A-Za-z0-9]/.test(name)) { setError('Name needs at least one letter or digit'); return; }
    const existing = all.find(t => t.type.toLowerCase() === name.toLowerCase());
    if (existing && checked.has(existing.type)) { setError('This type already exists'); return; }
    if (!existing) setCustom(c => [...c, name]);
    setChecked(s => new Set(s).add(existing?.type ?? name));
    setNewType(''); setError('');
  }

  return (
    <div className="flex flex-col gap-1.5 px-3 py-1.5" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}>
      <span className="text-[12px] font-medium text-ui-heading">Select project types:</span>
      {all.map(t => (
        <label key={t.type} className="flex cursor-pointer items-center gap-2 text-[13px] text-ui-body">
          <input type="checkbox" checked={checked.has(t.type)} onChange={e => {
            setConfirming(false);
            setChecked(s => { const n = new Set(s); if (e.target.checked) n.add(t.type); else n.delete(t.type); return n; });
          }} />
          {t.type}{t.custom && <span className="text-[11px] text-ui-text-secondary">(custom)</span>}
        </label>
      ))}
      <div className="flex gap-1.5">
        <input aria-label="New custom type" placeholder="New custom type" className={INPUT} value={newType}
          onChange={e => { setNewType(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
        <Button size="sm" variant="secondary" onClick={addCustom}>Add</Button>
      </div>
      {error && <span className="text-[11px] text-error-normal">{error}</span>}
      {confirming && losing.length > 0 && (
        <p className="m-0 rounded-[4px] bg-error-light px-2 py-1.5 text-[12px] text-error-normal">
          {losing.map(t => `${t.type}: ${t.rows} row${t.rows > 1 ? 's' : ''}`).join(', ')} will go to the trash (restorable). Click again to confirm.
        </p>
      )}
      <Button size="sm" disabled={busy || checked.size === 0 || (!removed.length && !added.length)}
        onClick={() => {
          if (losing.length && !confirming) { setConfirming(true); return; }
          onSave(added.map(type => ({ type })), removed.map(t => t.type));
        }}>
        {busy ? 'Saving...' : confirming && losing.length ? 'Confirm & Save Types' : 'Save Types'}
      </Button>
      {checked.size === 0 && <span className="text-[11px] text-ui-text-secondary">Keep at least one type.</span>}
    </div>
  );
}

/** "Add to Group": project + type into a PF group at a rank. Stays open for several types. */
function AddToGroupModal({ projectId, projectLabel, types, groups, onChanged, onClose }: {
  projectId: string; projectLabel: string; types: { type: string }[]; groups: PfGroup[];
  onChanged: () => void; onClose: () => void;
}) {
  const [type, setType] = useState(types[0]?.type ?? '');
  const [groupId, setGroupId] = useState<string>(groups[0]?.id ?? 'new');
  const group = groups.find(g => g.id === groupId);
  const maxRank = group ? Math.max(0, ...group.members.map(m => m.rank)) : 0;
  const ranks = group ? [...new Set(group.members.map(m => m.rank))].sort((a, b) => a - b) : [];
  const [rank, setRank] = useState(maxRank + 1);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  useEffect(() => { setRank(maxRank + 1); }, [groupId, maxRank]);
  const already = !!group?.members.some(m => m.projectId === projectId && m.type === type);

  async function add() {
    setBusy(true); setError('');
    const res = await fetch('/api/production/pf-groups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(group ? { projectId, type, groupId: group.id, rank } : { projectId, type }),
    }).catch(() => null);
    const b = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) { setError(b?.error ?? 'Could not add it to the group'); return; }
    // A new group becomes the target for the next types.
    if (!group && b?.member?.group_id) setGroupId(b.member.group_id);
    const nextAdded = new Set(added).add(type);
    setAdded(nextAdded);
    setFlash(`${type} added`);
    setTimeout(() => setFlash(''), 1500);
    const next = types.find(t => !nextAdded.has(t.type));
    if (next) setType(next.type);
    onChanged();
  }

  const SELECT = 'h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-2 text-[13px] text-ui-heading';
  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent size="sm" title="Add to Group" description={projectLabel}>
        <div className="flex flex-col gap-3">
          {types.length === 0 ? (
            <p className="m-0 text-[13px] text-ui-text-secondary">This project has no items yet.</p>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-[12px] font-medium text-ui-heading">Type
                <select className={SELECT} value={type} onChange={e => setType(e.target.value)}>
                  {types.map(t => <option key={t.type} value={t.type}>{t.type}{added.has(t.type) ? ' (already added)' : ''}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-medium text-ui-heading">Group
                <select className={SELECT} value={groupId} onChange={e => setGroupId(e.target.value)}>
                  <option value="new">+ Create New Group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>Group {g.number}</option>)}
                </select>
              </label>
              {group && (
                <label className="flex flex-col gap-1 text-[12px] font-medium text-ui-heading">Rank
                  <select className={SELECT} value={rank} onChange={e => setRank(Number(e.target.value))}>
                    {ranks.map(r => <option key={r} value={r}>Rank {r}</option>)}
                    <option value={maxRank + 1}>+ New rank ({maxRank + 1})</option>
                  </select>
                </label>
              )}
              {already && <p className="m-0 text-[12px] text-error-normal">This type is already in that group.</p>}
              {error && <p className="m-0 text-[12px] text-error-normal">{error}</p>}
              {flash && <p className="m-0 text-[12px] text-success-normal">{flash}</p>}
              <Button disabled={busy || already || !type} onClick={() => void add()}>{busy ? 'Adding…' : 'Add'}</Button>
            </>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
