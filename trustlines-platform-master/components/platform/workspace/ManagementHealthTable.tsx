'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown, ArrowRight, ArrowUp, Boxes, ChevronsUpDown, ChevronUp, ChevronsUp, CircleCheck, CircleDashed,
  ClipboardCheck, DraftingCompass, Ellipsis, ExternalLink, Factory, Hammer, Handshake, Target, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PortfolioRow } from '@/lib/workspace/rows';

export interface HealthRow extends PortfolioRow {
  /** Trust Lines PM (falls back to the T-Lines PM / supervisor) — display name. */
  ownerName: string | null;
  /** Days past the latest overdue per-type target date; 0 = nothing overdue; null = no dates set. */
  daysLate: number | null;
  /** Lifecycle order of `phase`, for sorting. */
  phaseRank: number;
}

// Status Chip (Figma 48:500) per lifecycle phase — tone by meaning, always icon + label.
const PHASE_CHIP: Record<string, { tone: string; icon: LucideIcon }> = {
  LEAD:                 { tone: 't0', icon: Target },
  SALES_DESIGN:         { tone: 't4', icon: DraftingCompass },
  CLOSED_DEAL:          { tone: 't9', icon: Handshake },
  PM_FINALIZATION:      { tone: 't2', icon: ClipboardCheck },
  SUPPLY_DEVELOPMENT:   { tone: 't5', icon: Boxes },
  APPROVALS:            { tone: 't7', icon: CircleDashed },
  PRODUCTION_LOGISTICS: { tone: 't2', icon: Factory },
  DELIVERY_BUILD:       { tone: 't8', icon: Hammer },
  COMPLETED:            { tone: 't9', icon: CircleCheck },
};

type SortKey = 'project' | 'status' | 'blockers' | 'late' | 'owner';
const MENU_ITEM = 'flex w-full cursor-pointer items-center gap-2 rounded-[4px] border-0 bg-transparent px-2 py-1.5 text-left text-[13px] text-ui-body no-underline hover:bg-ui-hover-bg [&_svg]:size-3.5 [&_svg]:shrink-0';

function formatLate(days: number | null): string {
  if (days === null) return '—';
  if (days === 0) return 'On time';
  if (days % 7 === 0) return `${days / 7} ${days === 7 ? 'Week' : 'Weeks'}`;
  return `${days} ${days === 1 ? 'Day' : 'Days'}`;
}

// Figma "ops_manager" project table (node 178:29818): sortable headers, 36px rows, "…" actions.
export function ManagementHealthTable({ rows, emptyLabel }: { rows: HealthRow[]; emptyLabel: string }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'blockers', dir: -1 });
  const [menuId, setMenuId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const cmp: Record<SortKey, (a: HealthRow, b: HealthRow) => number> = {
      project:  (a, b) => (a.code ?? a.name ?? '').localeCompare(b.code ?? b.name ?? ''),
      status:   (a, b) => a.phaseRank - b.phaseRank,
      blockers: (a, b) => a.blockers.length - b.blockers.length || (a.daysLate ?? -1) - (b.daysLate ?? -1),
      late:     (a, b) => (a.daysLate ?? -1) - (b.daysLate ?? -1),
      owner:    (a, b) => (a.ownerName ?? '~').localeCompare(b.ownerName ?? '~'),
    };
    return [...rows].sort((a, b) => cmp[sort.key](a, b) * sort.dir || (a.code ?? '').localeCompare(b.code ?? ''));
  }, [rows, sort]);

  if (rows.length === 0) {
    return (
      <div className="rounded-[10px] border border-ui-divider bg-ui-surface-elevated px-6 py-10 text-center text-[13px] text-ui-text-secondary">
        {emptyLabel}
      </div>
    );
  }

  const header = (key: SortKey, label: string, className?: string) => {
    const active = sort.key === key;
    const Icon = !active ? ChevronsUpDown : sort.dir === -1 ? ArrowDown : ArrowUp;
    return (
      <th className={cn('px-2.5 text-left', className)} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
        <button
          type="button"
          onClick={() => setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'project' || key === 'owner' || key === 'status' ? 1 : -1 }))}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 border-0 bg-transparent p-0 text-[13px] font-semibold leading-[1.4] whitespace-nowrap',
            active ? 'text-[var(--color-secondary-700)] dark:text-ui-heading' : 'text-ui-body',
          )}
        >
          {label}
          <Icon size={active ? 13 : 12} aria-hidden />
        </button>
      </th>
    );
  };

  return (
    <div className="overflow-hidden rounded-[10px] border border-ui-divider bg-ui-surface-elevated">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr className="h-[50px] border-b border-ui-divider bg-ui-surface">
              {header('project', 'Project', 'w-[300px] pl-5')}
              {header('status', 'Status', 'w-[220px]')}
              {header('blockers', 'Blockers')}
              {header('late', 'Days Late', 'w-[140px]')}
              {header('owner', 'Owner', 'w-[180px]')}
              <th className="w-[56px]"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const chip = PHASE_CHIP[r.phase] ?? { tone: 't0', icon: CircleDashed };
              const ChipIcon = chip.icon;
              const severe = r.blockers.length > 1 || (r.daysLate ?? 0) > 0;
              const RiskIcon = severe ? ChevronsUp : ChevronUp;
              return (
                <tr key={r.projectId} className="h-[37px] border-b border-ui-divider last:border-b-0">
                  <td className="max-w-0 pl-5 pr-2.5">
                    <Link
                      href={`/projects/${r.projectId}`} title={r.name ?? undefined}
                      className="block truncate text-[13px] leading-[1.4] text-ui-body no-underline hover:underline"
                    >
                      {r.code && <span className="font-semibold">{r.code}</span>}
                      {r.code && r.name && ' · '}
                      {r.name ?? (r.code ? '' : '—')}
                    </Link>
                  </td>
                  <td className="px-2.5">
                    <span
                      className="inline-flex items-center gap-1 rounded-[4px] py-[3px] pl-2 pr-2.5 text-[12px] font-medium leading-4 whitespace-nowrap"
                      style={{ background: `var(--status-${chip.tone}-bg)`, color: `var(--status-${chip.tone}-fg)` }}
                    >
                      <ChipIcon size={14} aria-hidden />
                      {r.phaseLabel}
                    </span>
                  </td>
                  <td className="max-w-0 px-2.5" title={r.blockers.map(b => b.message).join('\n')}>
                    <span className={cn('flex min-w-0 items-center gap-1.5 text-[13px] leading-[1.4]', severe ? 'text-error-normal' : 'text-warning-normal')}>
                      <RiskIcon size={13} aria-hidden className="shrink-0" />
                      <span className="shrink-0">{r.blockers.length} {r.blockers.length === 1 ? 'blocker' : 'blockers'}</span>
                      {r.blockers[0] && <span className="truncate text-ui-text-secondary">· {r.blockers[0].message}</span>}
                    </span>
                  </td>
                  <td className={cn('px-2.5 text-[13px] whitespace-nowrap', (r.daysLate ?? 0) > 0 ? 'text-error-normal' : 'text-ui-text-secondary')}>
                    {formatLate(r.daysLate)}
                  </td>
                  <td className="max-w-0 px-2.5">
                    <p className="m-0 truncate text-[13px] text-ui-text-secondary">{r.ownerName ?? 'Unassigned'}</p>
                  </td>
                  <td className="relative pr-5 text-center">
                    <button
                      type="button" aria-label={`Actions for ${r.code ?? r.name ?? 'project'}`} aria-expanded={menuId === r.projectId}
                      onClick={() => setMenuId(id => (id === r.projectId ? null : r.projectId))}
                      className="inline-grid size-7 place-items-center rounded-[4px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg"
                    >
                      <Ellipsis size={16} />
                    </button>
                    {menuId === r.projectId && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setMenuId(null)} />
                        <div role="menu" className="absolute right-4 top-full z-30 mt-1 w-64 rounded-[6px] border border-ui-divider bg-ui-surface-elevated p-1 text-left shadow-03">
                          <Link href={`/projects/${r.projectId}`} role="menuitem" className={MENU_ITEM} onClick={() => setMenuId(null)}>
                            <ExternalLink aria-hidden /> Open project
                          </Link>
                          {r.myActions.map(a => (
                            <Link key={a.code} href={a.href} role="menuitem" className={MENU_ITEM} onClick={() => setMenuId(null)}>
                              <ArrowRight aria-hidden /> <span className="truncate">{a.action}</span>
                            </Link>
                          ))}
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
