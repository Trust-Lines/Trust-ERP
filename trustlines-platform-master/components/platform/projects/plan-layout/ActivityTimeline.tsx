import { CheckCircle2, Activity } from 'lucide-react';
import type { AuditRow } from '../ProjectDetailClient';
import { formatAction } from './shared';
import { EmptyState } from '@/components/ui/empty-state';

/** Right column "Activity Timeline" card — the 10 most recent audit events. */
export function ActivityTimeline({ auditEvents }: { auditEvents: AuditRow[] }) {
  return (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-default)' }}>Activity Timeline</span>
          </div>
          <div style={{ padding: '12px 16px', maxHeight: 340, overflowY: 'auto' }}>
            {auditEvents.length === 0 ? (
              <EmptyState size="sm" className="justify-center py-5" icon={<Activity />} title="No activity yet." />
            ) : (
              auditEvents.slice(0, 10).map((event, i) => (
                <div
                  key={event.id}
                  style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    paddingBottom: i < 9 ? 12 : 0, marginBottom: i < 9 ? 12 : 0,
                    borderBottom: i < 9 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--status-info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CheckCircle2 size={13} color="var(--status-info)" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-default)', marginBottom: 1 }}>
                      {formatAction(event.action)}
                    </div>
                    {event.actor && <div style={{ fontSize: 10, color: 'var(--fg-subtle)', marginBottom: 1 }}>{event.actor.full_name}</div>}
                    <div style={{ fontSize: 10, color: 'var(--fg-faint)' }}>
                      {new Date(event.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
  );
}
