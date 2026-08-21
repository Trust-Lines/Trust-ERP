'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { StageBadge } from '@/components/platform/shared/StageBadge';
import { Avatar } from '@/components/platform/shared/Avatar';
import { PermissionShield } from '@/components/platform/shared/PermissionShield';
import type { ProjectStage } from '@/types/database';
import type { ProjectRow } from '@/app/(platform)/projects/page';

interface Props {
  projects: ProjectRow[];
  userRole: string;
  today: string;
}

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', TRY: '₺' };

function CategoryTag({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 7px', borderRadius: '999px',
      fontSize: 11, fontWeight: 700,
      background: 'var(--brand-teal-100)', color: 'var(--brand-teal-600)',
      border: '1px solid #b2d8d8', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

export function ProjectsTableClient({ projects, userRole, today }: Props) {
  const router = useRouter();
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const hideSensitive  = userRole === 'tlines_pm';
  const canDelete      = ['ops_manager', 'general_manager'].includes(userRole);

  async function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation();
    if (!window.confirm(`Move "${name}" to trash? It will be permanently deleted after 30 days.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete'); return; }
      toast.success('Moved to trash');
      router.refresh();
    } finally { setDeletingId(null); }
  }

  const filtered = stageFilter
    ? projects.filter(p => p.current_stage === stageFilter)
    : projects;

  if (!projects.length) {
    return (
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
          No projects yet.{' '}
          {userRole === 'ops_manager' && (
            <a href="/projects/new" style={{ color: 'var(--brand-teal)' }}>Create the first one →</a>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <button
          className={`chip${stageFilter ? ' active' : ''}`}
          onClick={() => setStageFilter(stageFilter ? null : 'closed_deal')}
        >
          Stage {stageFilter ? `· ${stageFilter.replace(/_/g, ' ')}` : ''}
        </button>
        <button className="chip">Owner</button>
        <button className="chip chip-dashed">+ Add filter</button>
        {stageFilter && (
          <button className="btn btn-ghost btn-sm" onClick={() => setStageFilter(null)}>
            Clear
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-body flush">
          <table className="tbl">
            <thead>
              <tr>
                <th>Project</th>
                <th>Stage</th>
                <th>Categories</th>
                <th>Owner</th>
                {!hideSensitive && <th style={{ textAlign: 'right' }}>Deal value</th>}
                {!hideSensitive && <th style={{ textAlign: 'right' }}>Margin</th>}
                <th style={{ textAlign: 'right' }}>Due date</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const isOverdue =
                  p.est_delivery_date &&
                  p.est_delivery_date < today &&
                  p.current_stage !== 'delivered';
                const daysLate = isOverdue
                  ? Math.floor(
                      (new Date(today).getTime() - new Date(p.est_delivery_date!).getTime()) /
                        86400000,
                    )
                  : 0;

                return (
                  <tr
                    key={p.id}
                    className="clickable"
                    onClick={() => router.push(`/projects/${p.id}`)}
                  >
                    <td>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                      <div className="row-sub">{p.code}</div>
                    </td>
                    <td>
                      <StageBadge stage={p.current_stage as ProjectStage} />
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                        {(p.categories ?? []).slice(0, 3).map(c => (
                          <CategoryTag key={c} label={c} />
                        ))}
                        {(p.categories ?? []).length > 3 && (
                          <span style={{ fontSize: 11, color: 'var(--fg-subtle)', fontWeight: 600 }}>
                            +{p.categories.length - 3}
                          </span>
                        )}
                      </span>
                    </td>
                    <td>
                      {p.owner ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Avatar name={p.owner.full_name} size="sm" />
                          <span style={{ fontSize: 13 }}>{p.owner.full_name.split(' ')[0]}</span>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--fg-faint)', fontSize: 13 }}>—</span>
                      )}
                    </td>
                    {!hideSensitive && (
                      <td style={{ textAlign: 'right' }} className="num">
                        {p.deal_value != null
                          ? `${CURRENCY_SYMBOL[p.currency] ?? ''}${p.deal_value.toLocaleString()}`
                          : <span style={{ color: 'var(--fg-faint)' }}>—</span>}
                      </td>
                    )}
                    {hideSensitive && (
                      <td style={{ textAlign: 'right' }}>
                        <PermissionShield label="Restricted" />
                      </td>
                    )}
                    {!hideSensitive && (
                      <td style={{ textAlign: 'right' }}>
                        {p.margin_target_pct != null ? (
                          <span className="pill" style={{
                            background: p.margin_target_pct >= 20 ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
                            color: p.margin_target_pct >= 20 ? 'var(--status-success-fg)' : 'var(--status-warning-fg)',
                          }}>
                            {p.margin_target_pct}%
                          </span>
                        ) : <span style={{ color: 'var(--fg-faint)' }}>—</span>}
                      </td>
                    )}
                    {hideSensitive && (
                      <td style={{ textAlign: 'right' }}>
                        <PermissionShield label="Restricted" />
                      </td>
                    )}
                    <td style={{ textAlign: 'right' }}>
                      {p.est_delivery_date ? (
                        <span style={{ fontSize: 13, color: isOverdue ? 'var(--status-danger)' : 'var(--fg-subtle)' }}>
                          {p.est_delivery_date}
                          {isOverdue && (
                            <span style={{ display: 'block', fontSize: 11, marginTop: 1 }}>
                              {daysLate}d late
                            </span>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--fg-faint)' }}>—</span>
                      )}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {canDelete && (
                        <button
                          onClick={e => handleDelete(e, p.id, p.name)}
                          disabled={deletingId === p.id}
                          title="Move to trash"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 28, height: 28, borderRadius: 6, border: 'none',
                            background: 'transparent', cursor: 'pointer',
                            color: 'var(--fg-faint)', transition: 'color 100ms, background 100ms',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#dc2626'; (e.currentTarget as HTMLButtonElement).style.background = '#fee2e2'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-faint)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                        >
                          {deletingId === p.id
                            ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                            : <Trash2 size={13} />}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
