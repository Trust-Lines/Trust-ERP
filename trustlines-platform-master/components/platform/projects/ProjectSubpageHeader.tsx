'use client';

import Link from 'next/link';
import { ChevronRight, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { StageBadge } from '@/components/platform/shared/StageBadge';
import { cn } from '@/lib/utils';
import type { ProjectStage } from '@/types/database';

export type ProjectSubpage = 'overview' | 'types' | 'finance' | 'delivery' | 'finalization' | 'handover';

const TABS: { key: ProjectSubpage; label: string; path: string }[] = [
  { key: 'overview', label: 'Overview', path: '' },
  { key: 'types', label: 'Production Types', path: '/types' },
  { key: 'finance', label: 'Finance', path: '/finance' },
  { key: 'delivery', label: 'Delivery & Build', path: '/delivery' },
  { key: 'finalization', label: 'PM Finalization', path: '/finalization' },
  { key: 'handover', label: 'Project Handover', path: '/handover' },
];

// Figma "Project production types" (467:19723): breadcrumb, "# CODE" + copy, project name, stage chip,
// then underline tabs that move between the project's own pages. Tabs the viewer can't open are hidden
// (`hidden`), matching the buttons on the Overview page.
export function ProjectSubpageHeader({ projectId, code, name, stage, active, hidden = [] }: {
  projectId: string; code: string; name: string; stage: ProjectStage | null;
  active: ProjectSubpage; hidden?: ProjectSubpage[];
}) {
  async function copyCode() {
    try { await navigator.clipboard.writeText(code); toast.success('Project code copied'); }
    catch { toast.error('Could not copy'); }
  }

  return (
    <div className="mb-4 flex flex-col gap-[18px]">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12px] leading-[1.4]">
        <Link href="/projects" className="text-ui-text-secondary no-underline hover:underline">Supply</Link>
        <ChevronRight aria-hidden className="size-3 text-ui-text-secondary" />
        <Link href="/projects" className="text-ui-body no-underline hover:underline">Projects</Link>
        <ChevronRight aria-hidden className="size-3 text-ui-text-secondary" />
        <Link href={`/projects/${projectId}`} className="text-ui-body no-underline hover:underline">#{code}</Link>
      </nav>

      <div className="flex min-w-0 flex-col gap-1.5">
        {/* Purple in light; the dark frame (470:21970) uses the heading white. */}
        <div className="flex items-center gap-2.5 text-[30px] leading-normal text-[var(--status-t4-fg)] dark:text-ui-heading">
          <span># {code}</span>
          <button
            type="button" onClick={copyCode} aria-label="Copy project code"
            className="grid size-[26px] cursor-pointer place-items-center border-0 bg-transparent p-0 text-inherit hover:opacity-70"
          >
            <Copy size={26} aria-hidden />
          </button>
        </div>
        <h1 className="m-0 text-[30px] font-semibold leading-normal text-[var(--status-t4-fg)] dark:text-ui-heading">{name}</h1>
        {stage && <div><StageBadge stage={stage} /></div>}
      </div>

      <nav aria-label="Project sections" className="flex h-12 items-stretch gap-8 overflow-x-auto border-b border-ui-divider">
        {TABS.filter(t => !hidden.includes(t.key)).map(t => {
          const on = t.key === active;
          return (
            <Link
              key={t.key} href={`/projects/${projectId}${t.path}`} aria-current={on ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center whitespace-nowrap border-b-[3px] border-solid text-[13px] leading-[1.4] no-underline',
                on
                  ? 'border-[var(--color-secondary-700)] font-semibold text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading'
                  : 'border-transparent text-ui-text-secondary hover:text-ui-body',
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
