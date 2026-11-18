'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowDown, ArrowDownUp, Copy, Ellipsis, Link2, Mail, MapPin, Search, UserRound, UserRoundPlus } from 'lucide-react';
import { PageHeading } from '@/components/platform/shared/PageHeading';
import { roleLabel } from '@/components/platform/shell/Sidebar';
import { InviteDialog, type HrStaffRow } from '@/components/platform/hr/HrStaffClient';
import { PersonFace } from '@/components/ui/avatar-directory';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuLinkItem, MenuTrigger } from '@/components/ui/menu';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SOLID_CHIP, formatItemDate } from './itemStyles';
import { TOOLBAR_SELECT, TOOLBAR_SORT_ICON } from './ticketStyles';
import { HEADING } from '@/components/platform/shared/panelStyles';

// Figma "IT / Staff Members" (879:13180): the team with the IT equipment each person holds. Name,
// email, role and joined date are real (profiles, same read as HR → Staff Members). Location and
// Items come from the IT items each person holds (Items Library).

export interface ItStaffItem {
  id: string;
  label: string;
  /** A set ("PC 1") gets the link icon, like the Items Library chips. */
  isSet: boolean;
}

export interface ItStaffRow extends HrStaffRow {
  location?: string | null;
  items?: ItStaffItem[];
}

type SortKey = 'newest' | 'oldest' | 'name';

const TH = 'px-2.5 text-left text-[12px] font-semibold leading-[1.4] whitespace-nowrap text-ui-body';
const TD = 'px-2 text-[14px] whitespace-nowrap text-ui-body';
const NO_DATA = '—';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'Name A–Z' },
];

const initials = (name: string) => name.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

export function ItStaffClient({ staff, canInvite }: { staff: ItStaffRow[]; canInvite: boolean }) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [role, setRole] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);

  const roleOptions = useMemo(() => {
    const roles = [...new Set(staff.map(s => s.role).filter((r): r is string => !!r))]
      .sort((a, b) => roleLabel(a).localeCompare(roleLabel(b)));
    return [{ value: '', label: 'Role' }, ...roles.map(r => ({ value: r, label: roleLabel(r) }))];
  }, [staff]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = staff.filter(s =>
      (!role || s.role === role) &&
      (!q || `${s.full_name ?? ''} ${s.email ?? ''} ${s.location ?? ''} ${(s.items ?? []).map(i => i.label).join(' ')}`.toLowerCase().includes(q)));
    return [...rows].sort((a, b) => {
      if (sortBy === 'name') return (a.full_name ?? '').localeCompare(b.full_name ?? '');
      const ta = Date.parse(a.created_at ?? '') || 0, tb = Date.parse(b.created_at ?? '') || 0;
      return sortBy === 'oldest' ? ta - tb : tb - ta;
    });
  }, [staff, query, role, sortBy]);

  async function copyEmail(email: string) {
    try { await navigator.clipboard.writeText(email); toast.success('Email copied'); }
    catch { toast.error('Could not copy'); }
  }

  return (
    <div className="flex w-full flex-col gap-[30px] p-7 font-ui">
      <PageHeading
        trail={[{ label: 'IT', href: '/it/tickets' }, { label: 'Staff Members', href: '/it/staff' }]}
        title="Staff Members"
        subtitle={`${staff.length} Staff Member${staff.length === 1 ? '' : 's'}`}
      />

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-[380px] max-w-full">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
            <input
              type="search" aria-label="Search staff" placeholder="Search contacts…"
              value={query} onChange={e => setQuery(e.target.value)}
              className="h-10 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] leading-[1.45] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
            />
          </div>
          <div className="relative">
            <ArrowDownUp aria-hidden className={TOOLBAR_SORT_ICON} />
            <Select
              aria-label="Sort"
              className={cn(TOOLBAR_SELECT, 'pl-[34px] dark:pl-[34px]')}
              value={sortBy}
              onValueChange={v => setSortBy((v ?? 'newest') as SortKey)}
              options={SORT_OPTIONS}
            />
          </div>
          <Select
            aria-label="Role"
            className={cn(TOOLBAR_SELECT, 'pl-3 dark:pl-3')}
            value={role}
            onValueChange={v => setRole(v ?? '')}
            options={roleOptions}
          />
        </div>
        {canInvite && (
          <button
            type="button" onClick={() => setInviteOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-[6px] border-0 bg-ui-btn-accent px-8 text-[13px] font-medium leading-[1.35] text-ui-btn-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring"
          >
            <UserRoundPlus size={16} aria-hidden />
            Invite to team
          </button>
        )}
      </div>

      {/* ── Staff table ── */}
      <div className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
        {visible.length === 0 ? (
          staff.length === 0
            ? <EmptyState icon={<UserRound />} title="No staff yet" description={canInvite ? 'Invite people to the team to see them here.' : 'People on the team show here.'} />
            : <EmptyState icon={<Search />} title="No matching staff" description="Try another name, email, role or item." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse">
              <thead>
                <tr className="h-[46px] border-b border-ui-divider bg-[var(--ui-table-head-bg,var(--ui-surface))]">
                  <th scope="col" className={cn(TH, 'w-[420px] pl-[18px]')}>
                    <button
                      type="button"
                      onClick={() => setSortBy(s => (s === 'name' ? 'newest' : 'name'))}
                      aria-label={sortBy === 'name' ? 'Sorted by name — sort by newest' : 'Sort by name'}
                      className="inline-flex cursor-pointer items-center gap-0.5 border-0 bg-transparent p-0 text-inherit font-inherit"
                    >
                      Member Name <ArrowDown size={12} aria-hidden className={sortBy === 'name' ? 'opacity-100' : 'opacity-50'} />
                    </button>
                  </th>
                  <th scope="col" className={cn(TH, 'w-[280px]')}>Role</th>
                  <th scope="col" className={cn(TH, 'w-[249px]')}>Joined Date</th>
                  <th scope="col" className={cn(TH, 'w-[309px]')}>Location</th>
                  <th scope="col" className={TH}>Items</th>
                  <th scope="col" className="w-[64px]"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(s => {
                  const name = s.full_name || s.email || 'Unnamed';
                  return (
                    <tr key={s.id} className="h-[77px] border-b border-ui-divider last:border-b-0">
                      <td className="max-w-0 py-2 pl-2 pr-2.5">
                        <div className="flex min-w-0 items-center gap-4">
                          <span className="flex size-[45px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[var(--status-t0-fg)] text-[13px] font-semibold text-white dark:text-primary-950">
                            <PersonFace name={s.full_name} userId={s.id} fallback={initials(name)} />
                          </span>
                          <span className="flex min-w-0 flex-col gap-0.5 leading-normal">
                            <Link href={`/team/${s.id}`} className={cn('truncate text-[16px] font-semibold no-underline hover:underline', HEADING)} title={name}>{name}</Link>
                            {s.email && <span className="truncate text-[12px] text-ui-body" title={s.email}>{s.email}</span>}
                          </span>
                        </div>
                      </td>
                      <td className={TD}>{s.role ? roleLabel(s.role) : NO_DATA}</td>
                      <td className={TD}>{formatItemDate(s.created_at)}</td>
                      <td className={TD}>
                        {s.location ? (
                          <span className="inline-flex items-center gap-[5px]">
                            <MapPin size={16} strokeWidth={1.75} aria-hidden />
                            {s.location}
                          </span>
                        ) : NO_DATA}
                      </td>
                      <td className={TD}>
                        {s.items && s.items.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {s.items.map(item => (
                              <Link
                                key={item.id}
                                href={`/it/items/${encodeURIComponent(item.id)}`}
                                className={cn(
                                  'inline-flex h-7 items-center gap-1 rounded-[6px] text-[13px] font-semibold no-underline hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring',
                                  item.isSet ? 'pl-[13px] pr-2' : 'px-2.5',
                                  SOLID_CHIP,
                                )}
                              >
                                {item.label}
                                {item.isSet && <Link2 size={14} strokeWidth={2} aria-hidden />}
                              </Link>
                            ))}
                          </div>
                        ) : NO_DATA}
                      </td>
                      <td className="pr-4 text-center">
                        <Menu>
                          <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`} />}>
                            <Ellipsis />
                          </MenuTrigger>
                          <MenuContent>
                            <MenuLinkItem render={<Link href={`/team/${s.id}`} />}>
                              <UserRound aria-hidden /> View profile
                            </MenuLinkItem>
                            {s.email && <>
                              <MenuLinkItem render={<a href={`mailto:${s.email}`} />}>
                                <Mail aria-hidden /> Send email
                              </MenuLinkItem>
                              <MenuItem onClick={() => void copyEmail(s.email!)}>
                                <Copy aria-hidden /> Copy email
                              </MenuItem>
                            </>}
                          </MenuContent>
                        </Menu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canInvite && <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />}
    </div>
  );
}
