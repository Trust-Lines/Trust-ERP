'use client';

import { Box, ExternalLink, Link2 } from 'lucide-react';
import type { SalesDesignJob } from '@/types/database';
import type { IntakeFile, LeadBrief } from '@/app/(platform)/design/page';
import { Button, buttonVariants } from '@/components/ui/button';
import { PersonFace } from '@/components/ui/avatar-directory';
import { cn } from '@/lib/utils';
import { HEADING, initials } from '../designShared';
import { BrandKitCard } from './BrandKitCard';
import { Card, FILE_CATEGORY_LABELS, cap } from './sheetShared';

export type TeamRow = [role: string, name: string | null];

/** What Sales collected: customer brief, intake files, team, brand kit, and the shared Dropbox folder. */
export function BriefTab({ job, brief, customer, site, intakeFiles, team, sharedUrl, sales, onOpenIntakeFile, onGoToFiles }: {
  job: SalesDesignJob;
  brief: LeadBrief | undefined;
  customer: string | null;
  site: string | null;
  intakeFiles: IntakeFile[];
  team: TeamRow[];
  sharedUrl: string | null;
  sales: boolean;
  onOpenIntakeFile: (id: string) => void;
  onGoToFiles: () => void;
}) {
  const scope = Object.entries(brief?.scope_of_work ?? {}).filter(([, v]) => v).map(([k]) => k);
  const intakeNotes = Object.entries(brief?.notes ?? {}).filter(([, v]) => (v ?? '').trim());

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Customer Brief">
          <div className="flex flex-col gap-4">
            {([['Customer', customer], ['Site', site], ['Project Type', brief?.project_type]] as [string, string | null | undefined][]).map(([k, v]) => (
              <div key={k} className="flex min-w-0 flex-col gap-1">
                <span className="text-[12px] font-medium leading-4 text-ui-body">{k}</span>
                <span className={cn('break-words text-[13px] font-semibold leading-[1.5] tracking-[-0.286px]', HEADING)}>{v || '-'}</span>
              </div>
            ))}
            {scope.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-medium leading-4 text-ui-body">Scope</span>
                <div className="flex flex-wrap gap-1.5">
                  {scope.map(k => <span key={k} className="rounded-[4px] bg-[var(--status-t0-bg)] px-2 py-0.5 text-[12px] capitalize text-[var(--status-t0-fg)]">{cap(k)}</span>)}
                </div>
              </div>
            )}
            {job.brief && <p className="m-0 whitespace-pre-wrap text-[13px] text-ui-body">{job.brief}</p>}
            {brief?.matterport_link && (
              <a href={brief.matterport_link} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1.5 text-[13px] text-ui-link">
                <Box size={14} aria-hidden /> Open 360 walkthrough <ExternalLink size={12} aria-hidden />
              </a>
            )}
            {intakeNotes.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-medium leading-4 text-ui-body">Notes from the intake form</span>
                {intakeNotes.map(([k, v]) => (
                  <p key={k} className="m-0 text-[13px] text-ui-body"><span className="capitalize text-ui-text-secondary">{cap(k)}:</span> {v}</p>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card title={`Customer Files (${intakeFiles.length})`}>
          {intakeFiles.length === 0 ? (
            <p className="m-0 text-[13px] text-ui-text-secondary">No files on the intake form. Sales&apos; deal files and notes are under Notes and Files.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {intakeFiles.map(f => (
                <li key={f.id} className="flex items-center justify-between gap-3 border-b border-ui-divider py-[5px] first:pt-0 last:border-0 last:pb-0">
                  <div className="flex min-w-0 flex-col">
                    <span className={cn('truncate text-[13px] font-semibold tracking-[-0.286px]', HEADING)} title={f.file_name}>{f.file_name}</span>
                    <span className="truncate text-[10px] tracking-[-0.22px] text-ui-text-secondary">{FILE_CATEGORY_LABELS[f.category] ?? cap(f.category)}</span>
                  </div>
                  <Button size="icon-xs" aria-label={`Open ${f.file_name}`} onClick={() => onOpenIntakeFile(f.id)}><ExternalLink /></Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Team (${team.filter(([, n]) => n).length})`}>
          <ul className="m-0 flex list-none flex-col p-0">
            {team.map(([role, name]) => (
              <li key={role} className="flex items-center justify-between gap-3 border-b border-ui-divider py-[5px] first:pt-0 last:border-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span aria-hidden className="grid size-[31px] shrink-0 place-items-center overflow-hidden rounded-[6px] bg-ui-selected-bg text-[10px] leading-[1.4] text-ui-body"><PersonFace name={name} fallback={initials(name)} /></span>
                  <div className="flex min-w-0 flex-col">
                    <span className={cn('truncate text-[13px] font-semibold tracking-[-0.286px]', name ? HEADING : 'text-ui-text-secondary')}>{name ?? (role === 'Designer' ? 'Unassigned' : 'Not assigned yet')}</span>
                    <span className="truncate text-[10px] tracking-[-0.22px] text-ui-text-secondary">{role}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <BrandKitCard prospectId={brief?.prospect_id ?? null} />
      </div>

      <section className="flex flex-col gap-3 rounded-[8px] border border-ui-divider bg-ui-page-bg px-3.5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col leading-[1.35]">
          <h3 className={cn('m-0 text-[16px] font-semibold', HEADING)}>Shared with Sales</h3>
          <p className="m-0 text-[13px] text-ui-body">The design folder is shared with Sales; they open it from the deal in the CRM.</p>
        </div>
        {sharedUrl ? (
          <a href={sharedUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ size: 'md' }), 'w-fit pl-3 pr-4 text-[13px] font-medium no-underline [&_svg]:size-4')}>
            <Link2 aria-hidden /> Open shared folder
          </a>
        ) : !sales && (
          <Button size="md" className="w-fit" onClick={onGoToFiles}><Link2 /> Set up in Files</Button>
        )}
      </section>
    </>
  );
}
