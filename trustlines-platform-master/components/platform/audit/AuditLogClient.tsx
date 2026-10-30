'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { Select as FilterSelect } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

export interface AuditEntry {
  id: string;
  project_id: string | null;
  actor_id: string | null;
  action: string;
  resource: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
  actorName: string;
  projectName: string | null;
  projectCode: string | null;
}

// Figma "Audit Log" (node 352:4679).
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const TH = 'px-2.5 text-left text-[12px] font-semibold leading-[1.4] whitespace-nowrap text-ui-body';
const FILTER = 'inline-flex h-10 w-auto cursor-pointer items-center gap-2 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-5 pr-3 text-[13px] font-medium text-[var(--color-secondary-700)] dark:rounded-[6px] dark:text-ui-heading [&_svg]:size-3.5';

/** Status tone per action family; the design's default (updates) is t4. */
function actionTone(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('creat') || a.includes('add') || a.includes('insert')) return 't9';
  if (a.includes('delet') || a.includes('remov') || a.includes('trash')) return 't10';
  if (a.includes('updat') || a.includes('edit') || a.includes('chang')) return 't4';
  if (a.includes('approv') || a.includes('sign') || a.includes('complet')) return 't6';
  if (a.includes('reject') || a.includes('fail') || a.includes('error')) return 't10';
  if (a.includes('stage') || a.includes('advanc')) return 't3';
  if (a.includes('login') || a.includes('auth') || a.includes('access')) return 't7';
  return 't0';
}

function fmtAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('en-US', {
    month: 'numeric', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function DiffView({ old_value, new_value }: { old_value: unknown; new_value: unknown }) {
  if (!old_value && !new_value) return null;
  const format = (v: unknown) => {
    if (!v) return null;
    if (typeof v === 'object') return JSON.stringify(v, null, 2);
    return String(v);
  };
  const oldStr = format(old_value);
  const newStr = format(new_value);
  const PRE = 'm-0 overflow-x-auto whitespace-pre-wrap break-all rounded-[6px] border border-solid px-2.5 py-2 text-[11px]';
  return (
    <div className="flex gap-2.5">
      {oldStr && (
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[10px] font-semibold uppercase" style={{ color: 'var(--status-t10-fg)' }}>Before</div>
          <pre className={PRE} style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)', borderColor: 'var(--status-t10-fg)' }}>{oldStr}</pre>
        </div>
      )}
      {newStr && (
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[10px] font-semibold uppercase" style={{ color: 'var(--status-t9-fg)' }}>After</div>
          <pre className={PRE} style={{ background: 'var(--status-t9-bg)', color: 'var(--status-t9-fg)', borderColor: 'var(--status-t9-fg)' }}>{newStr}</pre>
        </div>
      )}
    </div>
  );
}

function LogRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const tone = actionTone(entry.action);
  const hasDiff = !!(entry.old_value || entry.new_value);

  return (
    <>
      <tr
        className={cn('h-[50px] border-b border-ui-divider', hasDiff && 'cursor-pointer hover:bg-ui-hover-bg/50', expanded && 'bg-ui-surface')}
        onClick={() => hasDiff && setExpanded(e => !e)}
        aria-expanded={hasDiff ? expanded : undefined}
      >
        <td className="w-6 pl-2 text-ui-body">
          {hasDiff && (expanded ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />)}
        </td>

        <td className="pl-[15px] pr-2">
          <span
            className="inline-flex h-7 items-center whitespace-nowrap rounded-[4px] border border-solid px-4 py-[3px] text-[12px] font-medium leading-4"
            style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)`, borderColor: `var(--status-${tone}-fg)` }}
          >
            {fmtAction(entry.action)}
          </span>
        </td>

        <td className="px-2.5">
          <div className="flex items-center gap-2">
            <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-ui-surface text-[10px] font-semibold leading-[1.4] text-ui-body">
              {entry.actorName === 'System'
                ? <Shield size={12} aria-hidden />
                : entry.actorName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </span>
            <span className="whitespace-nowrap text-[13px] leading-[1.4] text-ui-body">{entry.actorName}</span>
          </div>
        </td>

        <td className="max-w-0 px-2.5">
          {entry.projectName ? (
            <>
              <p className={cn('m-0 truncate text-[13px] font-semibold', HEADING)}>{entry.projectName}</p>
              {entry.projectCode && <p className="m-0 truncate font-mono text-[11px] text-ui-text-secondary">{entry.projectCode}</p>}
            </>
          ) : (
            <span className={cn('text-[13px] font-semibold', HEADING)}>-</span>
          )}
        </td>

        <td className="max-w-0 px-2.5">
          <p className="m-0 truncate text-[13px] text-ui-body">{entry.resource ?? '—'}</p>
        </td>

        <td className="whitespace-nowrap px-2 pr-4 text-[12px] text-ui-body">
          {fmtDate(entry.created_at)}
        </td>
      </tr>

      {expanded && hasDiff && (
        <tr className="border-b border-ui-divider bg-ui-surface">
          <td colSpan={6} className="pb-3 pl-11 pr-3.5">
            <DiffView old_value={entry.old_value} new_value={entry.new_value} />
          </td>
        </tr>
      )}
    </>
  );
}

export function AuditLogClient({ logs }: { logs: AuditEntry[] }) {
  const [search, setSearch]           = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterActor, setFilterActor]   = useState('');

  const actions = useMemo(() =>
    [...new Set(logs.map(l => l.action))].sort(), [logs]);
  const actors = useMemo(() =>
    [...new Set(logs.map(l => l.actorName))].sort(), [logs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter(l => {
      if (filterAction && l.action !== filterAction) return false;
      if (filterActor  && l.actorName !== filterActor) return false;
      if (q && ![l.action, l.actorName, l.projectName, l.projectCode, l.resource]
        .some(v => v?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [logs, search, filterAction, filterActor]);

  return (
    <div className="flex flex-col gap-[30px]">
      {/* ── Page heading ── */}
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <p className="m-0 text-[11px] font-semibold text-ui-nav-active">Admin / Audit Log</p>
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Audit Log</h1>
        <p className="m-0 text-[13px] text-ui-body">All system activity from the last 30 days · {logs.length} entries</p>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-[380px] max-w-full">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
          <input
            type="search" aria-label="Search audit log" placeholder="Search actions, actors, projects…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="h-10 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] leading-[1.45] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
          />
        </div>
        <FilterSelect
          aria-label="Filter by action" className={FILTER}
          value={filterAction} onValueChange={v => setFilterAction(v ?? '')}
          options={[{ value: '', label: 'All Actions' }, ...actions.map(a => ({ value: a, label: fmtAction(a) }))]}
        />
        <FilterSelect
          aria-label="Filter by user" className={FILTER}
          value={filterActor} onValueChange={v => setFilterActor(v ?? '')}
          options={[{ value: '', label: 'All Users' }, ...actors.map(a => ({ value: a, label: a }))]}
        />
        {(search || filterAction || filterActor) && (
          <button
            type="button"
            onClick={() => { setSearch(''); setFilterAction(''); setFilterActor(''); }}
            className="h-10 rounded-[6px] border-0 bg-transparent px-3 text-[13px] font-medium text-ui-body hover:bg-ui-hover-bg"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
        {filtered.length === 0 ? (
          <EmptyState icon={<Shield />} title="No audit entries found" description="Try a different search or filter." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse">
                <thead>
                  <tr className="h-[46px] border-b border-ui-divider bg-[var(--ui-table-head-bg,var(--ui-surface))]">
                    <th className="w-6" />
                    <th className={cn(TH, 'w-[440px] pl-[15px]')}>Action</th>
                    <th className={cn(TH, 'w-[250px]')}>User</th>
                    <th className={cn(TH, 'w-[250px]')}>Project</th>
                    <th className={TH}>Resource</th>
                    <th className={cn(TH, 'w-[190px]')}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(entry => (
                    <LogRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3.5 py-2.5 text-[12px] text-ui-text-secondary">
              Showing {filtered.length} of {logs.length} entries (last 30 days)
            </div>
          </>
        )}
      </div>
    </div>
  );
}
