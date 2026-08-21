'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MoreHorizontal, ArrowUpDown, Plus } from 'lucide-react';
import { StageBadge } from '@/components/platform/shared/StageBadge';
import { Avatar } from '@/components/platform/shared/Avatar';
import { Pill } from '@/components/platform/shared/Pill';
import { PermissionShield } from '@/components/platform/shared/PermissionShield';
import { CategoryList } from '@/components/platform/shared/CategoryChip';
import type { ProjectStage, ProjectPhase, ProjectCategory, CurrencyType } from '@/types/database';

export interface ProjectRow {
  id: string;
  code: string;
  name: string;
  current_stage: ProjectStage;
  current_phase: ProjectPhase;
  categories: ProjectCategory[];
  deal_value: number | null;
  currency: CurrencyType;
  margin_target_pct: number | null;
  est_delivery_date: string | null;
  site_location: string | null;
  client: { name: string; code: string | null } | null;
  owner: { full_name: string } | null;
}

interface ProjectsTableProps {
  projects: ProjectRow[];
  userRole: string;
}

function formatMoney(value: number | null, currency: CurrencyType): string {
  if (value === null) return '—';
  const symbols: Record<CurrencyType, string> = { USD: '$', EUR: '€', TRY: '₺' };
  return `${symbols[currency]}${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function dueDatePill(dateStr: string | null) {
  if (!dateStr) return <span style={{ color: 'var(--fg-faint)' }}>—</span>;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    return (
      <span style={{ color: 'var(--status-danger)', fontWeight: 600 }} className="num">
        {dateStr} <span style={{ fontSize: '11px' }}>({Math.abs(diffDays)}d late)</span>
      </span>
    );
  }
  if (diffDays <= 14) {
    return <span style={{ color: 'var(--status-warning)', fontWeight: 600 }} className="num">{dateStr}</span>;
  }
  return <span className="num" style={{ color: 'var(--fg-muted)' }}>{dateStr}</span>;
}

function marginPill(pct: number | null) {
  if (pct === null) return <span style={{ color: 'var(--fg-faint)' }}>—</span>;
  const variant = pct >= 30 ? 'success' : pct >= 20 ? 'warning' : 'danger';
  return <Pill variant={variant}>{pct.toFixed(1)}%</Pill>;
}

const isTlinesPm = (r: string) => r === 'tlines_pm';

export function ProjectsTable({ projects, userRole }: ProjectsTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stageFilter, setStageFilter] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState(false);

  const hideFinancials = isTlinesPm(userRole);

  function toggleRow(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll(e: React.ChangeEvent<HTMLInputElement>) {
    setSelected(e.target.checked ? new Set(projects.map(p => p.id)) : new Set());
  }

  if (projects.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--fg-faint)' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>📁</div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--fg-subtle)', marginBottom: '6px' }}>
          No projects yet
        </div>
        <div style={{ fontSize: '13px' }}>
          Projects will appear here once created.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="toolbar" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          className={`chip${stageFilter ? ' active' : ''}`}
          onClick={() => setStageFilter(v => !v)}
        >
          <ArrowUpDown size={11} />
          Stage
        </button>
        <button
          className={`chip${ownerFilter ? ' active' : ''}`}
          onClick={() => setOwnerFilter(v => !v)}
        >
          <ArrowUpDown size={11} />
          Owner
        </button>
        <button className="chip chip-dashed">
          <Plus size={11} />
          Add filter
        </button>
        <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--fg-subtle)' }}>
          {projects.length} project{projects.length !== 1 ? 's' : ''}
          {selected.size > 0 && ` · ${selected.size} selected`}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 40, paddingLeft: 18, paddingRight: 4 }}>
                <input
                  type="checkbox"
                  checked={selected.size === projects.length && projects.length > 0}
                  onChange={toggleAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th>Project</th>
              <th>Stage</th>
              <th>Categories</th>
              <th>Owner</th>
              <th style={{ textAlign: 'right' }}>PO Total</th>
              {!hideFinancials && <th style={{ textAlign: 'right' }}>Margin</th>}
              <th style={{ textAlign: 'right' }}>Due Date</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {projects.map(project => (
              <tr
                key={project.id}
                className="clickable"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <td style={{ paddingLeft: 18, paddingRight: 4 }} onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(project.id)}
                    onChange={() => {}}
                    onClick={e => toggleRow(project.id, e)}
                    style={{ cursor: 'pointer' }}
                  />
                </td>

                <td>
                  <div style={{ fontWeight: 600, color: 'var(--fg-default)', fontSize: '13px' }}>
                    {project.client?.name ?? '—'}
                  </div>
                  <div className="row-sub">{project.code} · {project.site_location ?? project.name}</div>
                </td>

                <td><StageBadge stage={project.current_stage} /></td>

                <td><CategoryList categories={project.categories} short max={3} /></td>

                <td>
                  {project.owner ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <Avatar name={project.owner.full_name} size="sm" />
                      <span style={{ fontSize: '13px', color: 'var(--fg-default)' }}>
                        {project.owner.full_name.split(' ')[0]}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--fg-faint)' }}>—</span>
                  )}
                </td>

                <td style={{ textAlign: 'right' }}>
                  {hideFinancials ? (
                    <PermissionShield label="Hidden" reason="Financial data not visible to T-Lines PM" />
                  ) : (
                    <span className="num" style={{ fontSize: '13px', fontWeight: 600 }}>
                      {formatMoney(project.deal_value, project.currency)}
                    </span>
                  )}
                </td>

                {!hideFinancials && (
                  <td style={{ textAlign: 'right' }}>
                    {marginPill(project.margin_target_pct)}
                  </td>
                )}

                <td style={{ textAlign: 'right' }}>
                  {dueDatePill(project.est_delivery_date)}
                </td>

                <td onClick={e => e.stopPropagation()}>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px', borderRadius: '4px' }}
                    onClick={e => { e.stopPropagation(); }}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
