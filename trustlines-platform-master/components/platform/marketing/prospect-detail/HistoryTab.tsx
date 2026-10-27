'use client';

import { History } from 'lucide-react';
import { HistoricalProjectForm } from './HistoricalProjectForm';
import type { HistoricalProject } from './types';
import { EmptyState } from '@/components/ui/empty-state';

export function HistoryTab({ canEdit, addingHistoricalProject, setAddingHistoricalProject, historicalProjectsLoaded, historicalProjects, onSave }: {
  canEdit?: boolean;
  addingHistoricalProject: boolean;
  setAddingHistoricalProject: (adding: boolean) => void;
  historicalProjectsLoaded: boolean;
  historicalProjects: HistoricalProject[];
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 12px' }}>
        Work Trust-Lines already completed for this Contact, logged for the record — not a live pipeline item.
      </p>
      {addingHistoricalProject && canEdit && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body">
            <HistoricalProjectForm onSave={onSave} onCancel={() => setAddingHistoricalProject(false)} />
          </div>
        </div>
      )}
      {!historicalProjectsLoaded ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 32, color: 'var(--fg-subtle)' }}>Loading…</div></div>
      ) : historicalProjects.length === 0 ? (
        <div className="card"><EmptyState size="sm" className="justify-center px-4 py-8" icon={<History />} title="No past projects logged yet." /></div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {historicalProjects.map(p => (
            <div key={p.id} className="card"><div className="card-body">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>{p.code}</div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', marginTop: 4 }}>
                {p.region} · {p.service_line}{p.site_location ? ` · ${p.site_location}` : ''}
                {p.actual_delivery_date ? ` · Completed ${new Date(p.actual_delivery_date).toLocaleDateString('en-US', { timeZone: 'UTC' })}` : ''}
              </div>
            </div></div>
          ))}
        </div>
      )}
    </div>
  );
}
