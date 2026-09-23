import Link from 'next/link';
import { Briefcase, ArrowUpRight, AlarmClock, Shield, ClipboardList } from 'lucide-react';
import { MyDayCard } from './MyDayCard';

// Same card idiom as the old dashboard's KPI tiles / Approvals panel
// (components/platform/dashboard/DashboardClient.tsx) — reused deliberately so these three
// boxes read as "the app's dashboard card", distinct from the branded Figma board below them.

export interface ApprovalSummaryItem {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  docType: string;
  stage: number;
}

function CardShell({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {icon}
      </div>
      {children}
    </div>
  );
}

function ActiveProjectsCard({ activeCount, overdueCount, newThisWeek }: {
  activeCount: number; overdueCount: number; newThisWeek: number;
}) {
  return (
    <CardShell title="Active Projects" icon={<Briefcase size={17} className="text-slate-400" />}>
      <div className="flex items-center gap-4 py-3">
        <div className="w-13 h-13 rounded-2xl bg-[#EEF4FF] text-[#2563EB] flex items-center justify-center shrink-0">
          <Briefcase size={22} strokeWidth={1.8} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-2xl font-bold text-slate-900 leading-tight">{activeCount}</span>
          <span className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-1">
            <ArrowUpRight size={13} strokeWidth={2.5} />
            {newThisWeek > 0 ? `${newThisWeek} new this week` : 'No new projects this week'}
          </span>
        </div>
      </div>
      {overdueCount > 0 && (
        <Link
          href="/projects"
          className="mt-1 flex items-center gap-2.5 p-2 rounded-xl hover:bg-red-50 transition-colors border border-red-100 bg-red-50/50"
        >
          <AlarmClock size={15} className="shrink-0 text-red-500" />
          <span className="text-xs font-bold text-red-700">
            {overdueCount} overdue {overdueCount === 1 ? 'project' : 'projects'}
          </span>
        </Link>
      )}
    </CardShell>
  );
}

function ApprovalsCard({ approvals }: { approvals: ApprovalSummaryItem[] }) {
  return (
    <CardShell title="Approvals" icon={<Shield size={17} className="text-slate-400" />}>
      {approvals.length === 0 ? (
        <div className="py-7 flex flex-col items-center justify-center text-center">
          <div className="w-11 h-11 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
            <ClipboardList size={18} strokeWidth={2} />
          </div>
          <div className="text-xs font-medium text-slate-500">No pending approvals</div>
        </div>
      ) : (
        <div className="space-y-1">
          {approvals.slice(0, 5).map(a => (
            <Link
              key={a.id}
              href={`/projects/${a.projectId}`}
              className="block p-2 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
            >
              <p className="text-xs font-bold text-slate-900 truncate">{a.projectCode} — {a.projectName}</p>
              <p className="text-[11px] text-slate-500">{a.docType} · Stage {a.stage}</p>
            </Link>
          ))}
          {approvals.length > 5 && (
            <p className="pt-1 text-center text-[11px] font-medium text-slate-400">+{approvals.length - 5} more</p>
          )}
        </div>
      )}
    </CardShell>
  );
}

export function TopSummaryRow({ approvals, activeCount, overdueCount, newThisWeek }: {
  approvals: ApprovalSummaryItem[]; activeCount: number; overdueCount: number; newThisWeek: number;
}) {
  return (
    <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
      <ApprovalsCard approvals={approvals} />
      <ActiveProjectsCard activeCount={activeCount} overdueCount={overdueCount} newThisWeek={newThisWeek} />
      <MyDayCard />
    </div>
  );
}
