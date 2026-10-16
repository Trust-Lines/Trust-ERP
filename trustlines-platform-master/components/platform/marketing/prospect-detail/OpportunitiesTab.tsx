'use client';

import { TaskList } from '@/components/platform/shared/TaskList';
import { ActivityFeed } from '@/components/platform/shared/ActivityFeed';
import { OPPORTUNITY_STAGE_LABEL } from '@/lib/marketing/classification';
import type { OpportunityRow } from './types';

export function OpportunitiesTab({
  opportunities, canEdit, assignees, expandedOppId, setExpandedOppId, handingOffId, onHandOff,
}: {
  opportunities: OpportunityRow[];
  canEdit?: boolean;
  assignees: { id: string; full_name: string }[];
  expandedOppId: string | null;
  setExpandedOppId: (id: string | null) => void;
  handingOffId: string | null;
  onHandOff: (oppId: string, title: string) => void;
}) {
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 12px' }}>
        System-created for a Need with an active, ticketed signal — never chosen manually. This Lead can have
        more than one, if it has more than one distinct project need.
      </p>
      {opportunities.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 32, color: 'var(--fg-subtle)' }}>
          No Opportunities yet.
        </div></div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {opportunities.map(o => {
            const expanded = expandedOppId === o.id;
            return (
              <div key={o.id} className="card">
                <div
                  className="card-body"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpandedOppId(expanded ? null : o.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{o.title}</div>
                    <span className="pill" style={{ background: 'var(--bg-subtle)', fontSize: 10.5 }}>{OPPORTUNITY_STAGE_LABEL[o.stage]}</span>
                    {/* /marketing/opportunities is Potentials-only now — this Opportunity has
                        nowhere else to "open" to, Sales's /leads board is where it actually
                        lives once handed off. */}
                    {canEdit && ['new', 'marketing_qualification'].includes(o.stage) && (
                      <button
                        onClick={e => { e.stopPropagation(); onHandOff(o.id, o.title); }}
                        disabled={handingOffId === o.id}
                        className="btn btn-primary btn-sm"
                        style={{ marginLeft: 'auto' }}
                      >
                        {handingOffId === o.id ? 'Sending…' : 'Hand off to Sales'}
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{o.deadline ? `Deadline: ${o.deadline}` : 'No deadline set'}</div>
                </div>
                {expanded && (
                  <div className="card-body" style={{ borderTop: '1px solid var(--border-subtle)', display: 'grid', gap: 12 }}>
                    <TaskList apiBasePath={`/api/marketing/opportunities/${o.id}`} assignees={assignees} />
                    <ActivityFeed apiBasePath={`/api/marketing/opportunities/${o.id}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
