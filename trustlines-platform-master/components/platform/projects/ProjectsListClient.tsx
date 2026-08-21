'use client';

import { StageBadge } from '@/components/platform/shared/StageBadge';
import type { ProjectStage, ProjectPhase, ProjectCategory } from '@/types/database';

interface ProjectRow {
  id: string;
  code: string;
  name: string;
  current_stage: ProjectStage;
  current_phase: ProjectPhase;
  categories: ProjectCategory[];
  est_delivery_date: string | null;
  client: { name: string } | null;
}

export function ProjectsListClient({ projects }: { projects: ProjectRow[] }) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Project</th>
          <th>Stage</th>
          <th>Categories</th>
          <th>Due date</th>
        </tr>
      </thead>
      <tbody>
        {projects.map(p => (
          <tr
            key={p.id}
            style={{ cursor: 'pointer' }}
            onClick={() => { window.location.href = `/projects/${p.id}`; }}
          >
            <td>
              <div style={{ fontWeight: 500 }}>{p.client?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{p.code} · {p.name}</div>
            </td>
            <td><StageBadge stage={p.current_stage} /></td>
            <td style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{p.categories?.join(', ')}</td>
            <td style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>{p.est_delivery_date ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
