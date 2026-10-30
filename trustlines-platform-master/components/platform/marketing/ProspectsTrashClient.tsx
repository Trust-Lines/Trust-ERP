'use client';

import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RotateCcw, Search, TriangleAlert, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProspectTrashRow {
  id: string;
  display_name: string;
  entity_type: string;
  deleted_at: string;
  deleted_by: string | null;
  daysLeft: number;
}

export interface NeedTrashRow {
  id: string;
  prospect_id: string;
  prospect_name: string;
  title: string;
  classification: string;
  deleted_at: string;
  deleted_by: string | null;
  daysLeft: number;
}

const NEED_CLASSIFICATION_LABEL: Record<string, string> = {
  opportunity: 'Opportunity', potential: 'Potential', disqualified: 'Disqualified', unclassified: 'Unclassified',
};

// Figma "Marketing Trash" (node 244:21085) styling.
const HEADING_TEXT = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const RESTORE_BTN = 'inline-flex shrink-0 items-center gap-[7px] rounded-[6px] border border-ui-divider bg-ui-input-bg px-2.5 py-[7px] text-[13px] font-medium text-ui-body hover:bg-ui-hover-bg disabled:opacity-50 [&_svg]:size-4';
const DELETE_BTN = 'inline-flex shrink-0 items-center rounded-[6px] border-0 px-2.5 py-[7px] text-[13px] font-medium hover:brightness-95 disabled:opacity-50';
const DELETE_STYLE: React.CSSProperties = { background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' };
const TH_CLS = 'whitespace-nowrap px-2.5 py-2.5 text-left text-[12px] font-medium text-ui-text-secondary first:pl-3 last:pr-3';
const TD_CLS = 'px-2.5 py-3.5 align-middle text-[12px] leading-[1.45] text-ui-body first:pl-3 last:pr-3';
const CHECKBOX_CLS = 'size-4 cursor-pointer accent-[var(--color-secondary-700)]';

type Tab = 'contacts' | 'needs';

/** One table row, regardless of whether it came from a Contact or a Need. */
interface TrashItem {
  id: string;
  title: string;
  subtitle: string;
  deleted_at: string;
  deleted_by: string | null;
  daysLeft: number;
  restoreUrl: string;
  purgeUrl: string;
}

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const DATE_ONLY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function autoDeleteDate(deletedAt: string, daysLeft: number, purgeDays: number): string {
  if (daysLeft <= 0) return 'Due for removal';
  return DATE_ONLY.format(new Date(new Date(deletedAt).getTime() + purgeDays * 86_400_000));
}

export function ProspectsTrashClient({ rows, needRows, canPurge, purgeDays }: { rows: ProspectTrashRow[]; needRows: NeedTrashRow[]; canPurge: boolean; purgeDays: number }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('contacts');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const items: TrashItem[] = useMemo(() => (tab === 'contacts'
    ? rows.map(r => ({
      id: r.id,
      title: r.display_name,
      subtitle: `Contact · ${r.entity_type === 'person' ? 'Person' : 'Organization'} · restores its Needs and Potentials`,
      deleted_at: r.deleted_at, deleted_by: r.deleted_by, daysLeft: r.daysLeft,
      restoreUrl: `/api/marketing/prospects/${r.id}/restore`,
      purgeUrl: `/api/marketing/prospects/${r.id}/permanent-delete`,
    }))
    : needRows.map(n => ({
      id: n.id,
      title: n.title,
      subtitle: `Need · ${n.prospect_name} · was ${NEED_CLASSIFICATION_LABEL[n.classification] ?? n.classification}`,
      deleted_at: n.deleted_at, deleted_by: n.deleted_by, daysLeft: n.daysLeft,
      restoreUrl: `/api/marketing/prospects/${n.prospect_id}/needs/${n.id}/restore`,
      purgeUrl: `/api/marketing/prospects/${n.prospect_id}/needs/${n.id}/permanent-delete`,
    }))), [tab, rows, needRows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.title.toLowerCase().includes(q) || i.subtitle.toLowerCase().includes(q) || (i.deleted_by ?? '').toLowerCase().includes(q));
  }, [items, query]);

  const selectedItems = visible.filter(i => selected.has(i.id));
  const allSelected = visible.length > 0 && selectedItems.length === visible.length;

  function switchTab(next: Tab) {
    setTab(next);
    setSelected(new Set());
    setQuery('');
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visible.map(i => i.id)));
  }

  // Runs the existing per-item endpoints one by one — the routes carry their own
  // authorization and audit logging, so bulk actions don't need a new API.
  async function run(targets: TrashItem[], kind: 'restore' | 'purge') {
    if (targets.length === 0) return;
    if (kind === 'purge') {
      const label = targets.length === 1 ? `"${targets[0].title}"` : `${targets.length} items`;
      if (!window.confirm(`Permanently delete ${label}? This cannot be undone.`)) return;
    }
    setBusy(true);
    let failed = 0;
    let lastError = '';
    for (const t of targets) {
      const res = await fetch(kind === 'restore' ? t.restoreUrl : t.purgeUrl, { method: 'POST' }).catch(() => null);
      if (!res || !res.ok) {
        failed++;
        const body = res ? await res.json().catch(() => ({})) : {};
        lastError = body.error ?? '';
      }
    }
    setBusy(false);
    setSelected(new Set());
    const done = targets.length - failed;
    if (done > 0) toast.success(`${kind === 'restore' ? 'Restored' : 'Permanently deleted'} ${done} item${done === 1 ? '' : 's'}`);
    if (failed > 0) toast.error(lastError || `Could not ${kind === 'restore' ? 'restore' : 'delete'} ${failed} item${failed === 1 ? '' : 's'}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'Marketing', href: '/marketing' }, { label: 'Contacts', href: '/marketing/prospects' }, { label: 'Trash', href: '/marketing/prospects/trash' }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING_TEXT)}>Trash</h1>
        <p className="m-0 text-[13px] text-ui-body">
          Deleted items remain here for {purgeDays} days. Restoring a Contact also restores its Needs and Potentials.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-[6px] p-3" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-fg)' }} role="note">
        <TriangleAlert size={16} className="shrink-0" aria-hidden />
        <p className="m-0 flex-1 text-[12px] leading-[1.45]">
          Permanent deletion cannot be undone. Items are automatically removed on the dates below; only Marketing managers can delete them sooner.
        </p>
      </div>

      <nav aria-label="Trash views" className="flex h-12 items-stretch gap-8 border-b border-ui-divider">
        {([['contacts', 'Contacts', rows.length], ['needs', 'Needs', needRows.length]] as const).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => switchTab(key)}
            className={cn(
              'flex items-center gap-1.5 border-0 border-b-[3px] bg-transparent p-0 text-[13px] leading-[1.4]',
              tab === key
                ? 'border-[var(--color-secondary-700)] font-semibold text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading'
                : 'cursor-pointer border-transparent text-ui-text-secondary hover:text-ui-body',
            )}
          >
            {label}
            <span className="text-[11px] opacity-75">({count})</span>
          </button>
        ))}
      </nav>

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
              {canPurge && (
                <button type="button" className={DELETE_BTN} style={DELETE_STYLE} disabled={busy} onClick={() => run(selectedItems, 'purge')}>
                  Delete permanently
                </button>
              )}
            </div>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-[13px] text-ui-text-secondary">
            <Trash2 size={28} className="opacity-40" aria-hidden />
            {query.trim()
              ? 'No deleted items match your search.'
              : tab === 'contacts' ? 'No deleted Contacts.' : 'No deleted Needs.'}
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
                {visible.map(i => {
                  const isSelected = selected.has(i.id);
                  return (
                    <tr key={i.id} className={cn('border-b border-ui-divider', isSelected ? 'bg-ui-selected-bg' : 'bg-ui-surface-elevated')}>
                      <td className={TD_CLS}>
                        <input type="checkbox" className={CHECKBOX_CLS} checked={isSelected} onChange={() => toggle(i.id)} aria-label={`Select ${i.title}`} />
                      </td>
                      <td className={TD_CLS}>
                        <div className="flex flex-col gap-1">
                          <span className="text-[13px] font-medium text-ui-body">{i.title}</span>
                          <span className="text-[11px] text-ui-text-secondary">{i.subtitle}</span>
                        </div>
                      </td>
                      <td className={TD_CLS}>{i.deleted_by ?? '—'}</td>
                      <td className={TD_CLS}>{DATE_TIME.format(new Date(i.deleted_at))}</td>
                      <td className={TD_CLS}>
                        <span style={i.daysLeft <= 5 ? { color: 'var(--status-t10-fg)' } : undefined}>{autoDeleteDate(i.deleted_at, i.daysLeft, purgeDays)}</span>
                      </td>
                      <td className={TD_CLS}>
                        <div className="flex items-center gap-2.5">
                          <button type="button" className={RESTORE_BTN} disabled={busy} onClick={() => run([i], 'restore')}>
                            <RotateCcw aria-hidden /> Restore
                          </button>
                          {canPurge && (
                            <button type="button" className={DELETE_BTN} style={DELETE_STYLE} disabled={busy} onClick={() => run([i], 'purge')}>
                              Delete forever
                            </button>
                          )}
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
          {items.length} deleted item{items.length === 1 ? '' : 's'} · Restored items return to their original location and retain their history.
        </p>
      </div>
    </div>
  );
}
