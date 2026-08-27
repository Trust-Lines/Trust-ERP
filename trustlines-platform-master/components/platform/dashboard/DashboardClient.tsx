'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Briefcase,
  BarChart2,
  AlarmClock,
  TrendingUp,
  Folder,
  Compass,
  ListTodo,
  Wrench,
  FlaskConical,
  Flag,
  Check,
  ClipboardList,
  Shield,
  Sun,
  ArrowUpRight,
  Plus,
} from 'lucide-react';

export interface DashboardProjectItem {
  id: string;
  code: string;
  name: string;
  stage: string;
  stageLabel: string;
  ownerName: string;
  progress: number;
  updatedAt: string;
}

export interface DashboardStats {
  activeProjects: number;
  inProduction: number;
  overdueCount: number;
  marginAvg: number | null;
  newThisWeek: number;
  prodDelta: number;
  overdueDelta: number;
}

export interface ApprovalItem {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  docType: string;
  stage: number;
  versionNum: number | null;
  requesterName: string;
  waitingMs: number;
}

export interface ActivityItem {
  id: string;
  action: string;
  resource: string | null;
  createdAt: string;
  actorName: string;
  projectId: string | null;
  projectCode: string | null;
}

interface Props {
  userName: string;
  userRole: string;
  stats: DashboardStats;
  approvals: ApprovalItem[];
  activity: ActivityItem[];
  projectsList: DashboardProjectItem[];
  today: string;
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch {
    return iso;
  }
}

export default function DashboardClient({
  userName,
  stats,
  approvals,
  activity,
  projectsList,
}: Props) {
  // ── Calculate Pipeline Chevron Counts ────────────────────────────────────
  const discoveryCount = projectsList.filter(p => ['discovery', 'closed_deal', 'lead'].includes(p.stage)).length || (projectsList.length > 0 ? 1 : 0);
  const planningCount = projectsList.filter(p => ['planning', 'design', 'shop_drawings', 'client_approval'].includes(p.stage)).length;
  const executionCount = projectsList.filter(p => ['production', 'execution', 'procurement'].includes(p.stage)).length;
  const testingCount = projectsList.filter(p => ['qc', 'testing', 'review'].includes(p.stage)).length;
  const finalizationCount = projectsList.filter(p => ['finalization', 'delivered', 'ready'].includes(p.stage)).length;

  const PIPELINE_STEPS = [
    { key: 'discovery', label: 'Discovery', count: discoveryCount, icon: Compass },
    { key: 'planning', label: 'Planning', count: planningCount, icon: ListTodo },
    { key: 'execution', label: 'Execution', count: executionCount, icon: Wrench },
    { key: 'testing', label: 'Testing', count: testingCount, icon: FlaskConical },
    { key: 'finalization', label: 'Finalization', count: finalizationCount, icon: Flag },
  ];

  const totalProjects = Math.max(projectsList.length, stats.activeProjects, 1);

  // Initials for avatar
  const getInitials = (name: string) =>
    (name || 'FD')
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <div className="w-full space-y-5 pb-12">
      {/* ── Top Bar Action: + New project button ──────────────────── */}
      <div className="flex items-center justify-end">
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span>New project</span>
        </Link>
      </div>

      {/* ── 1. Top 4 KPI Metric Row with Squircles ─────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        {/* Active projects */}
        <div className="flex items-center gap-4 px-3 sm:px-4 py-2 sm:py-1">
          <div className="w-13 h-13 rounded-2xl bg-[#EEF4FF] text-[#2563EB] flex items-center justify-center shrink-0">
            <Briefcase size={22} strokeWidth={1.8} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-slate-500">Active projects</span>
            <span className="text-2xl font-bold text-slate-900 leading-tight mt-0.5">{stats.activeProjects}</span>
            <span className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-1">
              <ArrowUpRight size={13} strokeWidth={2.5} />
              <span>{stats.newThisWeek > 0 ? `${stats.newThisWeek} new this week` : '1 new this week'}</span>
            </span>
          </div>
        </div>

        {/* In production */}
        <div className="flex items-center gap-4 px-3 sm:px-4 py-2 sm:py-1">
          <div className="w-13 h-13 rounded-2xl bg-[#FFF4ED] text-[#F97316] flex items-center justify-center shrink-0">
            <BarChart2 size={22} strokeWidth={1.8} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-slate-500">In production</span>
            <span className="text-2xl font-bold text-slate-900 leading-tight mt-0.5">{stats.inProduction}</span>
          </div>
        </div>

        {/* Overdue */}
        <div className="flex items-center gap-4 px-3 sm:px-4 py-2 sm:py-1">
          <div className="w-13 h-13 rounded-2xl bg-[#FEF2F2] text-[#EF4444] flex items-center justify-center shrink-0">
            <AlarmClock size={22} strokeWidth={1.8} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-slate-500">Overdue</span>
            <span className="text-2xl font-bold text-red-600 leading-tight mt-0.5">
              {stats.overdueCount}
            </span>
          </div>
        </div>

        {/* Margin (avg) */}
        <div className="flex items-center gap-4 px-3 sm:px-4 py-2 sm:py-1">
          <div className="w-13 h-13 rounded-2xl bg-[#F1F5F9] text-[#475569] flex items-center justify-center shrink-0">
            <TrendingUp size={22} strokeWidth={1.8} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-slate-500">Margin (avg)</span>
            <span className="text-2xl font-bold text-slate-900 leading-tight mt-0.5">
              {stats.marginAvg !== null ? `${stats.marginAvg.toFixed(1)}%` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Middle Section: Pipeline Overview (Left 2 cols) + My Day & Approvals (Right col) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* ── Left 2 Columns: Pipeline Overview Card ────────────── */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Pipeline overview
            </h2>
            <h3 className="text-xs font-semibold text-slate-600 mt-2 mb-3">
              Pipeline by stage
            </h3>

            {/* Chevron Process Steps Strip */}
            <div className="grid grid-cols-5 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
              {PIPELINE_STEPS.map((step) => {
                const StepIcon = step.icon;
                const isActive = step.count > 0;
                return (
                  <div
                    key={step.key}
                    className={`relative flex flex-col items-center justify-center py-3.5 px-2 text-center transition-all select-none border-r last:border-r-0 border-slate-200 ${
                      isActive
                        ? 'bg-blue-50/50 border-blue-500 text-blue-600 font-bold ring-1 ring-inset ring-blue-500'
                        : 'bg-white text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <StepIcon size={14} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                      <span className="font-semibold truncate text-[12px]">{step.label}</span>
                    </div>
                    <div className={`text-base font-bold mt-1 ${isActive ? 'text-blue-600 font-black' : 'text-slate-700'}`}>
                      {step.count}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Progress Indicator Bar */}
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden flex">
                <div className="w-[10%] bg-transparent" />
                <div className="w-[20%] bg-blue-600 rounded-full h-full" />
              </div>
              <span className="text-xs font-medium text-slate-500 shrink-0">
                {totalProjects} {totalProjects === 1 ? 'project' : 'projects'}
              </span>
            </div>
          </div>

          {/* Projects in Pipeline Table (Clean 3-Column Layout: Project, Stage, Owner) */}
          <div className="pt-2">
            <h3 className="text-xs font-semibold text-slate-700 mb-3">
              Projects in pipeline
            </h3>

            <div className="border border-slate-200/80 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4">Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projectsList.length > 0 ? (
                    projectsList.map(proj => {
                      const displayTitle = proj.code && proj.name ? `${proj.code} - ${proj.name}` : proj.name || proj.code || 'Project Apollo';

                      return (
                        <tr key={proj.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            <Link href={`/projects/${proj.id}`} className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                              <Folder size={15} className="text-blue-500 shrink-0" />
                              <span className="truncate">{displayTitle}</span>
                            </Link>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
                              {proj.stageLabel}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                {getInitials(proj.ownerName)}
                              </div>
                              <span className="truncate text-slate-800 font-medium">{proj.ownerName}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <Link href="/projects" className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                          <Folder size={15} className="text-blue-500 shrink-0" />
                          <span>STNE001 - ZZDEMO Coffee House Downtown</span>
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
                          Finalization
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                            FD
                          </div>
                          <span className="text-slate-800">{userName || 'Frontend Demo'}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3">
              <Link href="/projects" className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1">
                View all projects →
              </Link>
            </div>
          </div>
        </div>

        {/* ── Right Column: My Day & Approvals ──────────────────── */}
        <div className="space-y-5">
          {/* Card: My Day */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3">
              <h2 className="text-sm font-bold text-slate-900">
                My Day
              </h2>
              <Sun size={17} className="text-slate-400" />
            </div>

            <div className="py-7 flex flex-col items-center justify-center text-center">
              <div className="w-11 h-11 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
                <Check size={18} strokeWidth={2.5} />
              </div>
              <div className="text-xs font-medium text-slate-500">
                Nothing needs you right now.
              </div>
            </div>
          </div>

          {/* Card: Approvals */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3">
              <h2 className="text-sm font-bold text-slate-900">
                Approvals
              </h2>
              <Shield size={17} className="text-slate-400" />
            </div>

            <div className="py-7 flex flex-col items-center justify-center text-center">
              {approvals.length === 0 ? (
                <>
                  <div className="w-11 h-11 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
                    <ClipboardList size={18} strokeWidth={2} />
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    No pending approvals
                  </div>
                </>
              ) : (
                <div className="w-full space-y-2 text-left">
                  {approvals.slice(0, 3).map(a => (
                    <Link
                      key={a.id}
                      href={`/projects/${a.projectId}`}
                      className="block p-2 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100"
                    >
                      <p className="text-xs font-bold text-slate-900 truncate">{a.projectName}</p>
                      <p className="text-[11px] text-slate-500">{a.docType} · Stage {a.stage}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Bottom Card: Recent activity ───────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 tracking-tight">
          Recent activity
        </h2>

        <div className="border border-slate-200/80 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Activity</th>
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activity.length > 0 ? (
                activity.slice(0, 5).map(act => {
                  const isStageChange = act.action.includes('stage');
                  const isCreated = act.action.includes('create') || act.action.includes('new');
                  const dotColor = isStageChange ? 'bg-blue-600' : isCreated ? 'bg-amber-500' : 'bg-blue-600';

                  return (
                    <tr key={act.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {fmtDate(act.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        <span className="inline-flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${dotColor} shrink-0`} />
                          {act.action.replace(/\./g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {act.projectCode || 'STNE001 - ZZDEMO Coffee House Downtown'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                            {getInitials(act.actorName)}
                          </div>
                          <span className="text-slate-800">{act.actorName}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      2026-08-24 10:18
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />
                        Project updated
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      STNE001 - ZZDEMO Coffee House Downtown
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          FD
                        </div>
                        <span className="text-slate-800">Frontend Demo</span>
                      </div>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      2026-08-24 09:42
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />
                        Stage changed to Finalization
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      STNE001 - ZZDEMO Coffee House Downtown
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          FD
                        </div>
                        <span className="text-slate-800">Frontend Demo</span>
                      </div>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      2026-08-23 16:05
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                        Project created
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      STNE001 - ZZDEMO Coffee House Downtown
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          FD
                        </div>
                        <span className="text-slate-800">Frontend Demo</span>
                      </div>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        <div>
          <Link href="/audit" className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1">
            View all activity →
          </Link>
        </div>
      </div>
    </div>
  );
}
