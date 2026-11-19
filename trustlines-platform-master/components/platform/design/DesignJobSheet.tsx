'use client';

import { useEffect, useState } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import type { SalesDesignJob, SalesDesignVersion } from '@/types/database';
import type { LeadBrief, IntakeFile, DesignFile, ProjectMeta } from '@/app/(platform)/design/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DesignFiles } from './DesignFiles';
import { JobMaterials } from './JobMaterials';
import { TAB_CLS, type TabKey } from './job-sheet/sheetShared';
import { useJobFeed } from './job-sheet/useJobFeed';
import { useJobVersions } from './job-sheet/useJobVersions';
import { SheetHeader } from './job-sheet/SheetHeader';
import { GeneralInfo } from './job-sheet/GeneralInfo';
import { BriefTab, type TeamRow } from './job-sheet/BriefTab';
import { NotesTab } from './job-sheet/NotesTab';
import { VersionsTab } from './job-sheet/VersionsTab';
import { ActivityTab } from './job-sheet/ActivityTab';

const CLOSED_STATUSES = ['completed', 'approved_by_sales', 'cancelled'];

interface Props {
  job: SalesDesignJob;
  name: string;
  currentUserId: string;
  isManager: boolean;
  /** Sales reviewer: approve / revise sent designs, then send to the customer and download. */
  salesView?: boolean;
  designers: { id: string; full_name: string }[];
  designerMap: Record<string, string>;
  brief: LeadBrief | undefined;
  intakeFiles: IntakeFile[];
  meta: ProjectMeta | undefined;
  team: { trustlinesPm: string | null; tlinesPm: string | null } | undefined;
  requestedBy: string | null;
  versions: SalesDesignVersion[];
  designFiles: Record<string, DesignFile[]>;
  today: string;
  onPatchJob: (patch: Record<string, unknown>, okMessage?: string) => Promise<void>;
  onJobLocal: (patch: Partial<SalesDesignJob>) => void;
  onVersions: (versions: SalesDesignVersion[]) => void;
  onVersion: (version: SalesDesignVersion) => void;
  onDesignFiles: (versionId: string, files: DesignFile[]) => void;
  onClose: () => void;
}

/** Design job pop-up: General Info plus Brief / Notes / Files / Versions / Materials / Activity tabs. */
export function DesignJobSheet(p: Props) {
  const { job, isManager } = p;
  const sales = !!p.salesView;
  const defaultTab: TabKey = sales ? 'versions' : 'brief';
  const [tab, setTab] = useState<TabKey>(defaultTab);
  const [filesPath, setFilesPath] = useState('');
  const [sharedUrl, setSharedUrl] = useState<string | null>(job.dropbox_shared_url ?? null);

  const feed = useJobFeed(job.id);
  const versions = useJobVersions({
    jobId: job.id,
    onVersions: p.onVersions,
    onVersion: p.onVersion,
    onDesignFiles: p.onDesignFiles,
    onJobLocal: p.onJobLocal,
    postNote: feed.postNote,
    onVersionFolder: path => { setFilesPath(path); setTab('files'); },
  });

  // Switching jobs: start over on the default tab with a fresh feed.
  const { resetFeed, loadFeed, notes } = feed;
  useEffect(() => { resetFeed(); setTab(sales ? 'versions' : 'brief'); setSharedUrl(job.dropbox_shared_url ?? null); }, [job.id, job.dropbox_shared_url, sales, resetFeed]);
  useEffect(() => { if ((tab === 'notes' || tab === 'activity') && notes === null) void loadFeed(); }, [tab, notes, loadFeed]);

  const designerName = job.assigned_designer_id ? p.designerMap[job.assigned_designer_id] ?? 'Designer' : null;
  const overdue = !!p.today && !!job.due_date && job.due_date.slice(0, 10) < p.today && !CLOSED_STATUSES.includes(job.status);
  const site = p.brief ? [p.brief.street, p.brief.city, p.brief.state].filter(Boolean).join(', ') || p.brief.address : null;
  const customer = p.brief?.customer_name?.trim() || p.brief?.brand?.trim() || null;
  const subtitle = [customer, site].filter(Boolean).join(' - ');
  const title = [p.brief?.project_type?.trim(), p.meta?.code].filter(Boolean).join(' - ') || p.name;
  const team: TeamRow[] = [['Designer', designerName], ['Requested by', p.requestedBy], ['Trust PM', p.team?.trustlinesPm ?? null], ['Client PM', p.team?.tlinesPm ?? null]];

  return (
    <DialogPrimitive.Root open onOpenChange={o => { if (!o) p.onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-primary-950/40 transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <DialogPrimitive.Popup
          data-slot="design-job-modal"
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[1268px] -translate-x-1/2 -translate-y-1/2 flex-col gap-6 overflow-y-auto rounded-[11px] bg-ui-page-bg p-4 font-[family-name:var(--font-ui)] shadow-04 outline-none transition-[scale,opacity] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 sm:p-8"
        >
          <SheetHeader title={title} subtitle={subtitle} job={job} />

          <div className="flex flex-col gap-4">
            <GeneralInfo
              job={job}
              isManager={isManager}
              sales={sales}
              designers={p.designers}
              designerName={designerName}
              overdue={overdue}
              onPatchJob={p.onPatchJob}
            />

            <Tabs value={tab} onValueChange={v => setTab(v as TabKey)} className="gap-4">
              <TabsList className="flex h-12 w-full gap-8 overflow-x-auto border-b border-ui-divider">
                <TabsTrigger className={TAB_CLS} value="brief">Brief</TabsTrigger>
                <TabsTrigger className={TAB_CLS} value="notes">Notes{notes?.length ? ` · ${notes.length}` : ''}</TabsTrigger>
                {!sales && <TabsTrigger className={TAB_CLS} value="files">Files</TabsTrigger>}
                <TabsTrigger className={TAB_CLS} value="versions">Versions{p.versions.length ? ` · ${p.versions.length}` : ''}</TabsTrigger>
                {!sales && <TabsTrigger className={TAB_CLS} value="materials">Materials</TabsTrigger>}
                <TabsTrigger className={TAB_CLS} value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="brief" className="flex flex-col gap-4">
                <BriefTab
                  job={job}
                  brief={p.brief}
                  customer={customer}
                  site={site}
                  intakeFiles={p.intakeFiles}
                  team={team}
                  sharedUrl={sharedUrl}
                  sales={sales}
                  onOpenIntakeFile={id => void versions.openFile(id, 'intake')}
                  onGoToFiles={() => setTab('files')}
                />
              </TabsContent>

              <TabsContent value="notes">
                <NotesTab notes={notes} me={p.currentUserId} onPost={t => feed.postNote(t)} />
              </TabsContent>

              {/* Files: the Dropbox design folder */}
              <TabsContent value="files">
                <DesignFiles jobId={job.id} initialPath={filesPath} onVersionFiles={() => void versions.syncVersions(true)} onSharedUrl={setSharedUrl} />
              </TabsContent>

              {/* Materials: what the design specifies from the catalogue */}
              <TabsContent value="materials">
                <JobMaterials jobId={job.id} />
              </TabsContent>

              <TabsContent value="versions" className="flex flex-col gap-4">
                <VersionsTab versions={p.versions} designFiles={p.designFiles} sales={sales} isManager={isManager} actions={versions} />
              </TabsContent>

              <TabsContent value="activity">
                <ActivityTab loading={notes === null} activity={feed.activity} />
              </TabsContent>
            </Tabs>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
