'use client';

import * as React from 'react';
import {
  TrendingUp,
  Calendar,
  SlidersHorizontal,
  Users,
  DollarSign,
  Truck,
  Clock,
  FileText,
  Globe,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  kpis: {
    totalLeads: number;
    pipelineValue: number;
    delivered: number;
    conversionPct: number;
    overdue: number;
  };
  byStatus: { key: string; label: string; color: string; count: number; value: number }[];
  byAssignee: { name: string; count: number; value: number }[];
  byAssigneeDetail: { name: string; count: number; wonCount: number; winRatePct: number; tasksDone: number; tasksTotal: number; taskCompletionPct: number | null }[];
  byRegion: { label: string; count: number; value: number }[];
}

// ── Format Compact Money ($30K, $1.2M, $0) ──────────────────────────────────
function formatCompactMoney(amount: number): string {
  if (!amount || amount === 0) return '$0';
  if (amount >= 1_000_000) {
    const val = (amount / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return `$${val}M`;
  }
  if (amount >= 1_000) {
    const val = (amount / 1_000).toFixed(0);
    return `$${val}K`;
  }
  return `$${amount.toLocaleString()}`;
}

export function SalesDashboard({ kpis, byStatus, byAssignee, byAssigneeDetail, byRegion }: Props) {
  const [currentDate] = React.useState(() => {
    return new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  });

  const totalStatusCount = byStatus.reduce((s, x) => s + x.count, 0);
  const totalStatusValue = byStatus.reduce((s, x) => s + x.value, 0);
  const maxStatusCount = Math.max(1, ...byStatus.map(s => s.count));

  const totalAssigneeCount = byAssignee.reduce((s, x) => s + x.count, 0);
  const maxAssigneeCount = Math.max(1, ...byAssignee.map(a => a.count));

  const totalRegionValue = byRegion.reduce((s, r) => s + r.value, 0);
  const maxRegionValue = Math.max(1, ...byRegion.map(r => r.value));

  // Donut chart calculations
  const assignedLeadsCount = byAssignee.filter(a => a.name !== 'Unassigned').reduce((s, a) => s + a.count, 0);
  const donutPct = totalAssigneeCount > 0 ? (assignedLeadsCount / totalAssigneeCount) : 0;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - donutPct * circumference;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 select-none font-sans text-slate-800 py-4 px-2">
      {/* ── 1. Page Header ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {/* Dark Green Squircle Header Badge */}
          <div className="h-12 w-12 rounded-2xl bg-[#0B3B2C] text-white flex items-center justify-center shadow-xs shrink-0">
            <TrendingUp size={24} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Sales dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">
              Pipeline overview across all leads
            </p>
          </div>
        </div>

        {/* Date Selector & Filter Controls */}
        <div className="flex items-center gap-2.5">
          <button className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition-colors">
            <Calendar size={14} className="text-slate-500" />
            <span>Today, {currentDate}</span>
            <span className="text-slate-400 text-[10px]">▼</span>
          </button>

          <button
            title="Filter dashboard"
            className="p-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-slate-600 hover:text-slate-900 shadow-xs transition-colors"
          >
            <SlidersHorizontal size={15} />
          </button>
        </div>
      </div>

      {/* ── 2. Top 4 KPI Metric Cards ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TOTAL LEADS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] relative flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-full bg-emerald-100/70 text-emerald-800 flex items-center justify-center mb-3">
              <Users size={19} strokeWidth={2} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              TOTAL LEADS
            </span>
            <span className="text-3xl font-extrabold text-slate-900 mt-1 block">
              {kpis.totalLeads}
            </span>
            <span className="text-xs text-slate-500 mt-1 block">
              All leads in pipeline
            </span>
          </div>

          <div className="absolute bottom-5 right-5 h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <TrendingUp size={14} />
          </div>
        </div>

        {/* Card 2: PIPELINE VALUE */}
        <div className="bg-[#FEFDF9] rounded-2xl border border-[#FDE68A] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] relative flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mb-3">
              <DollarSign size={20} strokeWidth={2.4} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              PIPELINE VALUE
            </span>
            <span className="text-3xl font-extrabold text-slate-900 mt-1 block">
              {formatCompactMoney(kpis.pipelineValue)}
            </span>
            <span className="text-xs text-slate-500 mt-1 block">
              Sum of estimated deal sizes
            </span>
          </div>

          <div className="absolute bottom-5 right-5 h-7 w-7 rounded-lg bg-[#FEF3C7] text-[#D97706] flex items-center justify-center">
            <TrendingUp size={14} />
          </div>
        </div>

        {/* Card 3: DELIVERED */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] relative flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-full bg-teal-100/70 text-teal-800 flex items-center justify-center mb-3">
              <Truck size={19} strokeWidth={2} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              DELIVERED
            </span>
            <span className="text-3xl font-extrabold text-slate-900 mt-1 block">
              {kpis.delivered}
            </span>
            <span className="text-xs text-slate-500 mt-1 block">
              {kpis.conversionPct}% conversion
            </span>
          </div>

          <div className="absolute bottom-5 right-5 h-7 w-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
            <TrendingUp size={14} />
          </div>
        </div>

        {/* Card 4: FOLLOW-UPS OVERDUE */}
        <div className="bg-[#FFFDFD] rounded-2xl border border-rose-100 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] relative flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-full bg-rose-100/70 text-rose-700 flex items-center justify-center mb-3">
              <Clock size={19} strokeWidth={2} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              FOLLOW-UPS OVERDUE
            </span>
            <span className={`text-3xl font-extrabold mt-1 block ${kpis.overdue > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {kpis.overdue}
            </span>
            <span className="text-xs text-slate-500 mt-1 block">
              Leads requiring attention
            </span>
          </div>

          <div className="absolute bottom-5 right-5 h-7 w-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
            <TrendingUp size={14} />
          </div>
        </div>
      </div>

      {/* ── 3. Middle Section: Leads by Status & Leads by Assignee ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Card: Leads by status */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col justify-between">
          <div className="p-6 pb-2">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                <FileText size={17} strokeWidth={2} />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Leads by status
              </h2>
            </div>

            {/* Status Rows */}
            <div className="space-y-3">
              {byStatus.map(s => {
                const hasLeads = s.count > 0;
                const pct = totalStatusCount > 0 ? (s.count / maxStatusCount) * 100 : 0;

                return (
                  <div key={s.key} className="flex items-center gap-3 text-xs">
                    {/* Dot + Label */}
                    <div className="flex items-center gap-2 w-44 shrink-0 min-w-0">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: hasLeads ? (s.color || '#2563EB') : '#CBD5E1' }}
                      />
                      <span className={`truncate ${hasLeads ? 'font-semibold text-slate-900' : 'text-slate-500 font-normal'}`}>
                        {s.label}
                      </span>
                    </div>

                    {/* Progress Bar Track */}
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          background: hasLeads ? (s.color || '#2563EB') : 'transparent',
                        }}
                      />
                    </div>

                    {/* Count & Value */}
                    <div className="w-24 text-right shrink-0 font-medium text-slate-800">
                      {hasLeads ? (
                        <span>
                          {s.count}
                          {s.value > 0 && ` • ${formatCompactMoney(s.value)}`}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card Footer: Total */}
          <div className="mt-4 px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-900">
            <span>Total</span>
            <span>
              {totalStatusCount}
              {totalStatusValue > 0 && ` • ${formatCompactMoney(totalStatusValue)}`}
            </span>
          </div>
        </div>

        {/* Right Card: Leads by assignee */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col justify-between">
          <div className="p-6 pb-2">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-6">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                <Users size={17} strokeWidth={2} />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Leads by assignee
              </h2>
            </div>

            {/* Donut Chart & Assignee Breakdown */}
            <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
              {/* Donut Chart Visual */}
              <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 96 96">
                  {/* Background Track */}
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    stroke="#E2E8F0"
                    strokeWidth="9"
                    fill="none"
                  />
                  {/* Active Arc */}
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    stroke="#0B3B2C"
                    strokeWidth="9"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-slate-900 leading-none">
                    {totalAssigneeCount}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                    Total leads
                  </span>
                </div>
              </div>

              {/* Assignee Rows */}
              <div className="flex-1 w-full space-y-4">
                {byAssignee.map(a => {
                  const isUnassigned = a.name === 'Unassigned';
                  const pct = totalAssigneeCount > 0 ? (a.count / maxAssigneeCount) * 100 : 0;

                  return (
                    <div key={a.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ background: isUnassigned ? '#94A3B8' : '#0B3B2C' }}
                          />
                          <span className="font-semibold text-slate-900">
                            {a.name}
                          </span>
                        </div>
                        <span className="font-medium text-slate-700">
                          {a.count}
                          {a.value > 0 && ` • ${formatCompactMoney(a.value)}`}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            background: isUnassigned ? '#CBD5E1' : '#0B3B2C',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card Footer: Summary */}
          <div className="mt-4 px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-1.5">
              <Users size={13} className="text-slate-400" />
              <span>{byAssignee.length} assignee{byAssignee.length !== 1 ? 's' : ''}</span>
            </div>
            <span>{totalAssigneeCount} total leads</span>
          </div>
        </div>
      </div>

      {/* ── 3b. Team performance: win rate % and task completion % per rep ── */}
      {byAssigneeDetail.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="p-6 pb-4">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                <CheckCircle2 size={17} strokeWidth={2} />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Team performance
              </h2>
            </div>
            <p className="text-xs text-slate-500 ml-[46px] mb-5">
              Won % of each rep&apos;s own pipeline, and how much of their task list is still open —
              every rep can find their own row here.
            </p>

            <div className="space-y-5">
              {byAssigneeDetail.map(a => (
                <div key={a.name} className="grid grid-cols-1 sm:grid-cols-[10rem_1fr_1fr] gap-3 sm:gap-4 items-center text-xs">
                  <span className="font-semibold text-slate-900 truncate">{a.name}</span>

                  {/* Win rate */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Won</span>
                      <span className="font-medium text-slate-800">{a.wonCount}/{a.count} · {a.winRatePct}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-600 transition-all duration-300" style={{ width: `${a.winRatePct}%` }} />
                    </div>
                  </div>

                  {/* Task completion */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Tasks done</span>
                      <span className="font-medium text-slate-800">
                        {a.tasksTotal > 0 ? `${a.tasksDone}/${a.tasksTotal} · ${a.taskCompletionPct}%` : 'No tasks yet'}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#0B3B2C] transition-all duration-300"
                        style={{ width: `${a.taskCompletionPct ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Bottom Card: Pipeline Value by Region ─────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="p-6 pb-4">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-6">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
              <Globe size={17} strokeWidth={2} />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Pipeline value by region
            </h2>
          </div>

          {/* Region Rows */}
          <div className="space-y-4">
            {byRegion.map(r => {
              const hasValue = r.value > 0;
              const pct = maxRegionValue > 0 ? (r.value / maxRegionValue) * 100 : (r.count > 0 ? 10 : 0);

              return (
                <div key={r.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">
                      {r.label}
                    </span>
                    <span className="font-medium text-slate-700">
                      {formatCompactMoney(r.value)} • {r.count}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        background: hasValue ? '#0B3B2C' : '#CBD5E1',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card Footer: Regional Summary */}
        <div className="px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={13} className="text-slate-400" />
            <span>{byRegion.length} regions</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-800 font-bold">
            <DollarSign size={13} className="text-slate-500" />
            <span>Total pipeline value {formatCompactMoney(totalRegionValue)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
