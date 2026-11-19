'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LeadsTable } from './LeadsTable';
import { LeadsBoard } from './LeadsBoard';
import { LeadsCalendar } from './LeadsCalendar';
import type { Lead, OpportunityStatus } from './types';
import type { Assignee, ViewMode } from './crm-board/boardConfig';
import { useLeadMutations } from './crm-board/useLeadMutations';
import { useLeadFilters } from './crm-board/useLeadFilters';
import { useTableLayout } from './crm-board/useTableLayout';
import { LeadContextMenu, useLeadContextMenu } from './crm-board/LeadContextMenu';
import { BoardHeading } from './crm-board/BoardHeading';
import { BoardKpis } from './crm-board/BoardKpis';
import { BoardFilters } from './crm-board/BoardFilters';
import { BoardViewControls } from './crm-board/BoardViewControls';
import { LeadDialogs } from './crm-board/LeadDialogs';
import { RecordQuickView } from './crm-board/RecordQuickView';

interface Props {
  initialLeads: Lead[];
  assignees?: Assignee[];
  marketingAssignees?: Assignee[];
  currentUserId?: string;
  canManageNumber?: boolean;
  nextNumber?: number;
  truncatedAt?: number;
  canSeeLeadIntake?: boolean;
  /** Open this record's quick view on load (used by links from the Tasks page). */
  initialOpenId?: string;
  /** Pre-select a pipeline stage (links from the Sales dashboard). */
  initialStage?: OpportunityStatus;
}

export function LeadsClient({
  initialLeads,
  assignees = [],
  marketingAssignees = [],
  currentUserId,
  truncatedAt,
  initialOpenId,
  initialStage,
}: Props) {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/sales/run-reminders', { method: 'POST' }).catch(() => { });
  }, []);

  const [view, setView] = useState<ViewMode>('list');
  const [quickViewId, setQuickViewId] = useState<string | null>(initialOpenId ?? null);
  const [trashing, setTrashing] = useState<Lead | null>(null);

  const m = useLeadMutations(initialLeads, assignees, marketingAssignees);
  const f = useLeadFilters({ leads: m.leads, currentUserId, assignees, marketingAssignees, initialStage });
  const layout = useTableLayout();
  const { menu, openMenu, closeMenu } = useLeadContextMenu();

  return (
    <div className="flex w-full flex-col gap-[30px] pb-12">
      <BoardHeading total={m.leads.length} />

      <BoardKpis
        total={m.leads.length}
        proposalSent={f.proposalSentCount}
        dealsClosed={f.dealsClosedCount}
        newCounts={f.newCounts}
        selectedStage={f.selectedStage}
        onToggleStage={f.toggleStage}
      />

      {truncatedAt && (
        <div className="rounded-xl border border-warning-normal bg-warning-light dark:bg-warning-dark/45 px-4 py-2.5 text-xs text-warning-dark dark:text-warning-light">
          Showing the newest <b>{truncatedAt}</b> records — there are more. Counts, totals and search only cover what&apos;s loaded.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <BoardFilters
          search={f.search} onSearchChange={f.setSearch}
          priority={f.fPriority} onPriorityChange={f.setFPriority}
          assignee={f.fAssignee} onAssigneeChange={f.setFAssignee} assignees={f.filterAssignees}
          region={f.fRegion} onRegionChange={f.setFRegion}
          mine={f.mine} onToggleMine={() => f.setMine(v => !v)} myCount={f.myCount}
          showArchived={f.showArchived} onToggleArchived={() => f.setShowArchived(v => !v)} archivedCount={f.archivedCount}
          selectedStage={f.selectedStage} onClearStage={() => f.setSelectedStage(null)}
        />
        <BoardViewControls
          sortBy={f.sortBy} onSortChange={f.setSortBy}
          view={view} onViewChange={setView}
          hiddenCols={layout.hiddenCols} onToggleCol={layout.toggleCol}
        />
      </div>

      <div className={view === 'list' ? 'min-w-0' : 'min-w-0 bg-ui-surface-elevated border border-ui-divider rounded-2xl shadow-2xs overflow-hidden'}>
        {view === 'list' && (
          <LeadsTable
            leads={f.visibleLeads}
            assignees={assignees}
            marketingAssignees={marketingAssignees}
            collapsed={layout.collapsed}
            hiddenColumns={layout.hiddenCols}
            resetKey={f.resetKey}
            onToggleGroup={layout.toggleGroup}
            {...m.tableHandlers}
            onContextMenu={openMenu}
            onOpen={setQuickViewId}
          />
        )}
        {view === 'board' && (
          <LeadsBoard leads={f.visibleLeads} onStatusChange={m.onStatusChange} onContextMenu={openMenu} onOpen={setQuickViewId} />
        )}
        {view === 'calendar' && (
          <LeadsCalendar leads={f.visibleLeads} onOpen={setQuickViewId} />
        )}
      </div>

      {quickViewId && (
        <RecordQuickView
          id={quickViewId}
          origin={m.leads.find(l => l.id === quickViewId)?.origin}
          assignees={assignees}
          marketingAssignees={marketingAssignees}
          onClose={() => { setQuickViewId(null); router.refresh(); }}
        />
      )}

      {menu && (
        <LeadContextMenu
          menu={menu}
          onArchive={(lead, archived) => { closeMenu(); void m.archiveLead(lead, archived); }}
          onTrash={lead => { setTrashing(lead); closeMenu(); }}
        />
      )}

      <LeadDialogs
        statusMove={m.statusMove}
        onCloseStatus={() => m.setStatusMove(null)}
        statusReason={m.statusReason}
        onReasonChange={m.setStatusReason}
        onConfirmStatus={m.confirmStatusMove}
        trashing={trashing}
        onCloseTrash={() => setTrashing(null)}
        onConfirmTrash={m.trashLead}
      />
    </div>
  );
}
