import Link from 'next/link';
import { ArrowUpRight, Briefcase, CalendarDays, CircleCheck, UserRound } from 'lucide-react';

// General Manager dashboard. Figma: "General Manager" frame, node 778:11311 (Dashboard content).
// Presentational only — the page loads every number. Shows only data the repo already backs;
// the Figma date pickers, account/company filters, column picker, Create task button and the
// four company board columns are not built here yet.

export interface GmTask {
  id: string;
  title: string;
  statusLabel: string;
  createdLabel: string;
  href: string;
}

export interface GmKpi {
  key: string;
  label: string;
  value: string;
  sub: string;
  href: string;
  tone: 'navy' | 'purple' | 'green';
  icon: 'briefcase' | 'user' | 'check';
  badge?: string;
}

interface Props {
  fullName: string;
  roleLabel: string;
  weekdayLabel: string;
  dateLabel: string;
  greeting: string;
  breadcrumbs: string;
  kpis: GmKpi[];
  tasks: GmTask[];
  taskTotal: number;
}

const TONE: Record<GmKpi['tone'], { text: string; badgeBg: string; badgeFg: string }> = {
  navy: { text: 'text-[#2b3d55]', badgeBg: 'bg-[#2b3d55]', badgeFg: 'text-white' },
  purple: { text: 'text-[#74489d]', badgeBg: 'bg-[#74489d]', badgeFg: 'text-[#edf]' },
  green: { text: 'text-[#216b2e]', badgeBg: 'bg-[#216b2e]', badgeFg: 'text-[#e4f5e7]' },
};

export function GeneralManagerDashboard({ fullName, roleLabel, weekdayLabel, dateLabel, greeting, breadcrumbs, kpis, tasks, taskTotal }: Props) {
  return (
    <div className="flex flex-col gap-[28px]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-[5px]">
          <p className="text-[11px] font-semibold text-[#4d6e98]">{breadcrumbs}</p>
          <h1 className="text-[28px] font-semibold leading-tight text-[#2b3d55]">Dashboard</h1>
          <p className="text-[13px] text-[#5e6f87]">Keep handoffs moving. Clear the blockers before they affect delivery.</p>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[527px_minmax(0,1fr)]" aria-label="Daily overview">
        <div className="relative flex min-h-[266px] flex-col justify-between overflow-hidden rounded-[16px] bg-[#ff511a] p-5 text-white">
          <div className="flex flex-col gap-2.5">
            <p className="text-[24px] font-medium leading-snug">{greeting},</p>
            <div className="flex flex-col">
              <p className="text-[36px] font-semibold leading-tight">{fullName || 'Welcome'}</p>
              <p className="text-[16px] font-medium">{roleLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <CalendarDays className="size-[51px]" strokeWidth={1.5} aria-hidden="true" />
            <div className="flex flex-col">
              <p className="text-[16px] font-medium">{weekdayLabel}</p>
              <p className="text-[24px] font-semibold">{dateLabel}</p>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3 rounded-[16px] border border-[#d2d7e0] bg-white px-1 pt-3">
          <div className="flex items-center justify-between pl-4 pr-2">
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] font-semibold text-[#2b3d55]">My Tasks</h2>
              <span className="rounded-[4px] bg-[#f0f2f5] px-[9px] py-[3px] text-[15px] font-semibold text-[#2b3d55]">{taskTotal}</span>
            </div>
            <Link
              href="/approvals"
              className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-[#2b3d55] px-3 text-[13px] font-medium text-white no-underline hover:opacity-90"
            >
              View All
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          {tasks.length === 0 ? (
            <p className="px-4 pb-4 text-[13px] text-[#7888a1]">No pending approvals. Nothing is waiting on you.</p>
          ) : (
            <ul className="flex flex-col gap-1 px-2 pb-2">
              {tasks.map(task => (
                <li key={task.id}>
                  <Link
                    href={task.href}
                    className="flex items-center justify-between gap-4 rounded-[6px] bg-[#f0f2f5] py-2 pl-3 pr-5 text-[#2b3d55] no-underline hover:bg-[#e6e9ef]"
                  >
                    <span className="min-w-0 truncate text-[13px]">{task.title}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#d2e6ff] py-[3px] pl-2 pr-2.5 text-[12px] font-medium text-[#2366b2]">
                        <CircleCheck className="size-3.5" aria-hidden="true" />
                        {task.statusLabel}
                      </span>
                      <span className="w-[140px] text-right text-[13px] text-[#7888a1]">{task.createdLabel}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-label="Key figures" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map(kpi => {
          const Icon = kpi.icon === 'check' ? CircleCheck : kpi.icon === 'user' ? UserRound : Briefcase;
          return (
          <Link
            key={kpi.key}
            href={kpi.href}
            className="flex flex-col gap-2 rounded-[16px] border border-[#d2d7e0] bg-white p-4 text-[#2b3d55] no-underline hover:border-[#b4bdcb]"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[12px] font-medium uppercase tracking-[-0.2px]">{kpi.label}</span>
              {kpi.badge ? (
                <span className={`rounded-[4px] px-2 py-0.5 text-[10px] font-medium ${TONE[kpi.tone].badgeBg} ${TONE[kpi.tone].badgeFg}`}>{kpi.badge}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[36px] font-semibold leading-none ${TONE[kpi.tone].text}`}>{kpi.value}</span>
              <Icon className={`size-7 ${TONE[kpi.tone].text}`} aria-hidden="true" />
            </div>
            <span className="text-[10px] opacity-60">{kpi.sub}</span>
          </Link>
          );
        })}
      </section>
    </div>
  );
}
