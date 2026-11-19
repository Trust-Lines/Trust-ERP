'use client';

import { useMemo, useState } from 'react';
import type { Lead, OpportunityStatus } from '../types';
import { NEW_WINDOW_MS, UNASSIGNED, type Assignee } from './boardConfig';

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

/** Search, filters, sort, stage pick, and the KPI counts derived from the full list. */
export function useLeadFilters({ leads, currentUserId, assignees, marketingAssignees, initialStage }: {
  leads: Lead[];
  currentUserId?: string;
  assignees: Assignee[];
  marketingAssignees: Assignee[];
  initialStage?: OpportunityStatus;
}) {
  const [mine, setMine] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedStage, setSelectedStage] = useState<OpportunityStatus | null>(initialStage ?? null);
  const [search, setSearch] = useState('');
  const [fPriority, setFPriority] = useState('');
  const [fAssignee, setFAssignee] = useState('');
  const [fRegion, setFRegion] = useState('');
  const [sortBy, setSortBy] = useState('created_desc');

  // Filter options: everyone who owns a row — Opportunity rows are owned from the wider marketing pool.
  const filterAssignees = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of [...assignees, ...marketingAssignees]) if (!m.has(a.id)) m.set(a.id, a.full_name);
    return [...m].map(([id, full_name]) => ({ id, full_name })).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [assignees, marketingAssignees]);

  const visibleLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = leads.filter(l => {
      if (!showArchived && l.archived) return false;
      if (mine && l.assignee_id !== currentUserId) return false;
      if (selectedStage && l.opportunity_status !== selectedStage) return false;
      if (fPriority && l.priority !== fPriority) return false;
      if (fAssignee === UNASSIGNED && l.assignee_id) return false;
      if (fAssignee && fAssignee !== UNASSIGNED && l.assignee_id !== fAssignee) return false;
      if (fRegion && l.region !== fRegion) return false;
      if (q) {
        const hay = `${l.name} ${l.brand} ${l.project_no ?? ''} ${l.contact} ${l.location}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return [...out].sort((a, b) => {
      // Compare real instants — mixed ISO offsets (Z vs +00:00) don't sort correctly as strings.
      const ta = Date.parse(a.date_created) || 0, tb = Date.parse(b.date_created) || 0;
      if (sortBy === 'created_asc') return ta - tb;
      if (sortBy === 'deal_desc') return (b.deal_size ?? 0) - (a.deal_size ?? 0);
      if (sortBy === 'priority') return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      return tb - ta;
    });
  }, [leads, mine, showArchived, currentUserId, selectedStage, search, fPriority, fAssignee, fRegion, sortBy]);

  const myCount = useMemo(() => leads.filter(l => l.assignee_id === currentUserId).length, [leads, currentUserId]);
  const archivedCount = useMemo(() => leads.filter(l => l.archived).length, [leads]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[l.opportunity_status] = (c[l.opportunity_status] ?? 0) + 1;
    return c;
  }, [leads]);
  const proposalSentCount = (counts['design_proposal_sent'] ?? 0) + (counts['modification_request'] ?? 0);
  const dealsClosedCount = counts['deal_closed'] ?? 0;

  // KPI chip: how many of each card's records were created in the last 7 days.
  const newCounts = useMemo(() => {
    const since = Date.now() - NEW_WINDOW_MS;
    const recent = leads.filter(l => (Date.parse(l.date_created) || 0) >= since);
    return {
      all: recent.length,
      proposal: recent.filter(l => l.opportunity_status === 'design_proposal_sent' || l.opportunity_status === 'modification_request').length,
      closed: recent.filter(l => l.opportunity_status === 'deal_closed').length,
    };
  }, [leads]);

  /** Click a KPI stage again to clear it. */
  const toggleStage = (stage: OpportunityStatus) => setSelectedStage(s => (s === stage ? null : stage));

  return {
    mine, setMine, showArchived, setShowArchived, selectedStage, setSelectedStage, toggleStage,
    search, setSearch, fPriority, setFPriority, fAssignee, setFAssignee, fRegion, setFRegion, sortBy, setSortBy,
    filterAssignees, visibleLeads, myCount, archivedCount, proposalSentCount, dealsClosedCount, newCounts,
    /** Changes whenever the visible set changes, so the table resets its paging. */
    resetKey: [search, fPriority, fAssignee, fRegion, sortBy, mine, showArchived, selectedStage].join('|'),
  };
}
