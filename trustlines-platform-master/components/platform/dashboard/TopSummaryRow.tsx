'use client';

import Link from 'next/link';
import { BriefcaseBusiness, CalendarDays, CircleCheck, DraftingCompass, Factory, Hammer, type LucideIcon } from 'lucide-react';
import { roleLabel } from '@/components/platform/shell/Sidebar';
import { cn } from '@/lib/utils';
import { MyDayCard } from './MyDayCard';

// Top of the dashboard, Figma "ops_manager" (node 376:31510): greeting + My Tasks, then the KPI row.

export interface ApprovalSummaryItem {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  docType: string;
  stage: number;
}

export interface KpiItem {
  key: 'active' | 'design' | 'production' | 'finalizing' | 'approvals';
  label: string;
  value: number;
  href: string;
  badge?: string;
}

const KPI_ICON: Record<KpiItem['key'], LucideIcon> = {
  active: BriefcaseBusiness, design: DraftingCompass, production: Factory, finalizing: Hammer, approvals: CircleCheck,
};
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Good Morning,' : h < 18 ? 'Good Afternoon,' : 'Good Evening,';
}

function GreetingCard({ fullName, role }: { fullName: string; role: string }) {
  const now = new Date();
  return (
    <div
      className="flex min-h-[268px] flex-col justify-between rounded-[10px] border border-ui-divider p-5"
      style={{ background: 'var(--dash-hero-bg)', color: 'var(--dash-hero-fg)' }}
    >
      <div className="flex flex-col gap-2.5">
        <p suppressHydrationWarning className="m-0 text-[24px] font-semibold leading-[1.35]">{greeting(now)}</p>
        <div>
          <p className="m-0 truncate text-[36px] font-semibold leading-normal">{fullName}</p>
          <p className="m-0 text-[16px] font-medium leading-[1.35]">{roleLabel(role)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <CalendarDays size={51} strokeWidth={1.25} aria-hidden className="shrink-0" />
        <div suppressHydrationWarning>
          <p suppressHydrationWarning className="m-0 text-[16px] font-medium leading-[1.35]">{now.toLocaleDateString('en-GB', { weekday: 'long' })}</p>
          <p suppressHydrationWarning className="m-0 text-[24px] font-semibold leading-normal">{now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>
    </div>
  );
}

function Kpi({ item }: { item: KpiItem }) {
  const Icon = KPI_ICON[item.key];
  return (
    <Link href={item.href} className={cn('flex min-w-0 flex-1 basis-[220px] flex-col gap-2 rounded-[16px] bg-ui-selected-bg py-3.5 pl-3.5 pr-4 no-underline transition-opacity hover:opacity-85', HEADING)}>
      <span className="flex size-[49px] items-center justify-center rounded-[8px] bg-ui-surface-elevated">
        <Icon size={24} aria-hidden />
      </span>
      <span className="flex flex-col gap-1 pl-0.5">
        <span className="text-[14px] leading-[1.5] tracking-[-0.308px]">{item.label}</span>
        <span className="flex items-center justify-between gap-2">
          <span className="text-[30px] font-semibold leading-[1.1] tracking-[0.6px]">{item.value}</span>
          {item.badge && (
            <span className="whitespace-nowrap rounded-[4px] bg-ui-surface-elevated px-2.5 py-0.5 text-[14px] font-medium leading-[1.5] tracking-[0.56px]">{item.badge}</span>
          )}
        </span>
      </span>
    </Link>
  );
}

export function TopSummaryRow({ fullName, role, kpis }: { fullName: string; role: string; kpis: KpiItem[] }) {
  return (
    <div className="mb-6 flex flex-col gap-[30px]">
      <div className="grid grid-cols-1 gap-[22px] xl:grid-cols-[minmax(0,527fr)_minmax(0,1011fr)]">
        <GreetingCard fullName={fullName} role={role} />
        <MyDayCard className="h-[268px]" />
      </div>
      <div className="flex flex-wrap gap-[22px]">
        {kpis.map(k => <Kpi key={k.key} item={k} />)}
      </div>
    </div>
  );
}
