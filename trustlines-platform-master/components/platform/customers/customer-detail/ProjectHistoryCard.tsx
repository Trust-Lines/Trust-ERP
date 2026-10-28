import { FolderKanban } from 'lucide-react';
import Link from 'next/link';
import type { ProjectRow } from './types';
import { EmptyState } from '@/components/ui/empty-state';
import { DetailCard, RowList } from './ui';

export function ProjectHistoryCard({ projects }: { projects: ProjectRow[] }) {
  return (
    <DetailCard title={`Project History (${projects.length})`}>
      {projects.length === 0 ? (
        <EmptyState size="sm" icon={<FolderKanban />} title="No linked projects yet." description="Link this customer to a lead — on delivery the project appears here." />
      ) : (
        <RowList>
          {projects.map(p => {
            const stage = (p.current_stage ?? '').replace(/_/g, ' ');
            return (
              <div key={p.id} className="flex items-start gap-3 px-1 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <Link href={`/projects/${p.id}`} className="w-fit text-[13px] font-semibold leading-[1.4] text-ui-body no-underline hover:underline">
                    {p.code}
                  </Link>
                  <p className="m-0 break-words text-[13px] leading-[1.4] text-ui-text-secondary">{p.name}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {p.is_draft && (
                    <span className="inline-flex h-[26px] items-center rounded-[4px] bg-[var(--status-t7-bg)] px-2.5 text-[11px] font-medium leading-4 text-[var(--status-t7-fg)]">Draft</span>
                  )}
                  <span className="inline-flex h-[26px] items-center rounded-[4px] bg-[var(--status-t0-bg)] px-2.5 text-[11px] font-medium capitalize leading-4 text-[var(--status-t0-fg)]">
                    {stage || '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </RowList>
      )}
    </DetailCard>
  );
}
