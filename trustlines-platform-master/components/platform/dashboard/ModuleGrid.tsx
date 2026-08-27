'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bookmark, Search } from 'lucide-react';
import type { UserRole } from '@/types/database';
import { permCan } from '@/lib/permissions/catalog';
import {
  IconCRM,
  IconProjects,
  IconCustomers,
  IconOperations,
  IconDesign,
  IconSales,
  IconFinance,
  IconInventory,
  IconProcurement,
  IconHRM,
  IconReports,
  IconSetup,
} from './WorkspaceIcons';

// ── Types ──────────────────────────────────────────────────────────────────
export interface ModuleBadge {
  value: string | number;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export interface WorkspaceModuleDef {
  key: string;
  label: string;
  subtitle: string;
  href: string;
  perm: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isBookmarked?: boolean;
  pillBadge?: string;
}

// ── 12 Workspace Modules Exactly Matching the Photo ────────────────────────
const WORKSPACE_MODULES: WorkspaceModuleDef[] = [
  { key: 'crm',        label: 'CRM',               subtitle: 'Manage relationships',     href: '/leads',           perm: 'page.leads',           icon: IconCRM, isBookmarked: true },
  { key: 'projects',   label: 'Projects',          subtitle: 'Active projects',          href: '/projects',        perm: 'page.projects',        icon: IconProjects, pillBadge: '1 active' },
  { key: 'customers',  label: 'Customers',         subtitle: 'Customer directory',       href: '/customers',       perm: 'page.customers',       icon: IconCustomers },
  { key: 'operations', label: 'Operations',        subtitle: 'Process management',       href: '/approvals',       perm: 'page.approvals',       icon: IconOperations },
  { key: 'design',     label: 'Design',            subtitle: 'Brand & assets',           href: '/design',          perm: 'page.design',          icon: IconDesign },
  { key: 'sales',      label: 'Sales',             subtitle: 'Pipeline & revenue',       href: '/sales-dashboard', perm: 'page.sales_dashboard', icon: IconSales },
  { key: 'finance',    label: 'Finance & Banking', subtitle: 'Accounts & transactions',  href: '/expenses',        perm: 'page.expenses',        icon: IconFinance },
  { key: 'inventory',  label: 'Inventory',         subtitle: 'Stock & items',            href: '/logistics',       perm: 'page.logistics',       icon: IconInventory },
  { key: 'procurement',label: 'Procurement',       subtitle: 'Purchase & vendors',       href: '/suppliers',       perm: 'page.suppliers',       icon: IconProcurement },
  { key: 'hrm',        label: 'HRM',               subtitle: 'People & teams',           href: '/team',            perm: 'page.team',            icon: IconHRM },
  { key: 'reports',    label: 'Reports',           subtitle: 'Insights & analytics',     href: '/sales-dashboard', perm: 'page.sales_dashboard', icon: IconReports },
  { key: 'setup',      label: 'Setup & Overview',  subtitle: 'System settings',          href: '/settings',        perm: 'page.settings',        icon: IconSetup },
];

// ── Props ──────────────────────────────────────────────────────────────────
interface ModuleGridProps {
  userName: string;
  userRole: UserRole;
  userPerms?: Record<string, boolean>;
  badges?: Record<string, ModuleBadge>;
  searchQuery?: string;
}

export function ModuleGrid({
  userName,
  userPerms,
  searchQuery: externalSearchQuery,
}: ModuleGridProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const search = (externalSearchQuery || '').toLowerCase().trim();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = userName ? userName.split(' ')[0] : 'Frontend';

  // Filter modules user has permission to view
  const visibleModules = WORKSPACE_MODULES.filter(m => permCan(userPerms, m.perm));

  // Filter by search query
  const filteredModules = search
    ? visibleModules.filter(
        m => m.label.toLowerCase().includes(search) || m.subtitle.toLowerCase().includes(search)
      )
    : visibleModules;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-7 select-none font-sans text-slate-800 py-3 px-1">
      {/* ── Page Greeting Header (Matching the Photo) ────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-2">
        <div>
          <h1
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A]"
            style={{ fontFamily: 'var(--font-serif, "Georgia", "Cambria", serif)' }}
          >
            {greeting}, {firstName}
          </h1>
          {mounted && (
            <p className="text-sm sm:text-base text-slate-500 font-normal mt-1.5">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          )}
        </div>
      </div>

      {/* ── 4-Column Grid of 12 Workspace Cards (Matching the Photo) ─ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {filteredModules.map((mod, idx) => {
          const Icon = mod.icon;
          const isSelected = mod.isBookmarked || idx === 0;

          return (
            <Link
              key={mod.key}
              href={mod.href}
              className={`relative rounded-3xl p-6 min-h-[172px] flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group hover:-translate-y-1 hover:shadow-lg ${
                isSelected
                  ? 'bg-[#F8FAFC] border-2 border-[#3B82F6] shadow-sm'
                  : 'bg-white border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:border-slate-300'
              }`}
            >
              {/* Bookmark Ribbon on Active Card */}
              {isSelected && (
                <div className="absolute top-4 right-4 text-[#3B82F6]">
                  <Bookmark size={16} className="fill-[#3B82F6]" />
                </div>
              )}

              {/* Center Illustrated Icon */}
              <div className="flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-200">
                <Icon size={48} />
              </div>

              {/* Centered Module Title */}
              <h2 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                {mod.label}
              </h2>

              {/* Pill Badge or Subtitle */}
              {mod.pillBadge ? (
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  <span>{mod.pillBadge}</span>
                </div>
              ) : (
                <p className="text-xs text-slate-500 font-normal mt-1 leading-snug">
                  {mod.subtitle}
                </p>
              )}
            </Link>
          );
        })}
      </div>

      {/* Empty Search State */}
      {filteredModules.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
          <Search size={32} className="mx-auto text-slate-300 mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No modules match &quot;{search}&quot;</h3>
          <p className="text-xs text-slate-500 mt-1">Try clearing your search query</p>
        </div>
      )}
    </div>
  );
}