import { Activity } from 'lucide-react';

export function ActivitiesTab() {
  return (
    <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 32, color: 'var(--fg-subtle)' }}>
      <Activity size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
      <div>Activity timeline (calls, emails, meetings, status changes) is not built yet — pending a future task.</div>
    </div></div>
  );
}
