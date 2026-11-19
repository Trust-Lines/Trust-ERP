'use client';

import { Drill, Factory, FolderClosed } from 'lucide-react';
import type { Installation } from '@/lib/installations/compute';
import {
  TIME, fileSize, fmtDay, listState, parseDay, regionOf,
  type DashProject, type DashboardAccess, type DesignDoc, type Loaded,
} from './dashboardData';
import { CodeChip, ListCard, Pill, Row } from './ListParts';
import { OpenFile } from './OpenFile';

/** In Production / Installation / New Design Folders. */
export function OperationsCards({ access, projects, inProduction, installs, installRows, designDocs }: {
  access: DashboardAccess;
  projects: DashProject[] | null;
  inProduction: DashProject[];
  installs: Loaded<Installation>;
  installRows: Installation[];
  designDocs: DesignDoc[] | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
      {access.projects && access.production && (
        <ListCard title="In Production" icon={<Factory strokeWidth={1.5} />} color="var(--status-t2-fg)" href="/production"
          state={projects === null ? 'error' : inProduction.length ? 'ready' : 'empty'} emptyText="No projects in production.">
          {inProduction.slice(0, 3).map(p => (
            <Row key={p.id} color="var(--status-t2-fg)" href={`/projects/${p.id}`} label={`Open ${p.code}`}
              lead={<CodeChip t="t2">#{p.code}</CodeChip>} title={p.name} sub={p.site_location || regionOf(p.region) || '—'}
              right={p.categories?.[0] ? <Pill color="var(--status-t2-fg)">{p.categories[0].charAt(0).toUpperCase() + p.categories[0].slice(1).toLowerCase()}</Pill> : undefined} />
          ))}
        </ListCard>
      )}
      {installs !== 'denied' && (
        <ListCard title="Installation" icon={<Drill strokeWidth={1.5} />} color="var(--status-t8-fg)" href="/tlines-pm/installation"
          state={listState(installs, installRows.length)} emptyText="No installations planned.">
          {installRows.slice(0, 3).map(r => (
            <Row key={r.id} color="var(--status-t8-fg)" href="/tlines-pm/installation" label={`Open installation ${r.project_no ?? ''}`}
              lead={<CodeChip t="t8">#{r.project_no ?? '—'}</CodeChip>} title={r.project_name ?? 'Untitled'}
              sub={[r.city_state, r.planned_start && fmtDay(parseDay(r.planned_start))].filter(Boolean).join(' · ') || '—'}
              right={r.status === 'Delayed' ? <Pill solid color="var(--color-error-normal)">Delayed</Pill> : r.status ? <Pill color="var(--status-t8-fg)">{r.status}</Pill> : undefined} />
          ))}
        </ListCard>
      )}
      {access.projects && (
        <ListCard title="New Design Folders" icon={<FolderClosed strokeWidth={1.5} />} color="var(--ui-btn-solid)" href="/design"
          state={designDocs === null ? 'error' : designDocs.length ? 'ready' : 'empty'} emptyText="No new design files.">
          {(designDocs ?? []).map(d => (
            <Row key={d.id} color="var(--ui-btn-solid)" href={`/projects/${d.project_id}`} label={`Open ${d.file_name}`} action="none"
              lead={null} title={d.file_name} sub={fileSize(d.file_size_bytes) || '—'}
              right={<>
                <span className="text-[12px] text-ui-text-secondary">{fmtDay(new Date(d.created_at)).toUpperCase()} - {TIME.format(new Date(d.created_at))}</span>
                <OpenFile id={d.id} name={d.file_name} />
              </>} />
          ))}
        </ListCard>
      )}
    </div>
  );
}
