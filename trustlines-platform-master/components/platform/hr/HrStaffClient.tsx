'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowDown, ArrowDownUp, Copy, Ellipsis, Mail, Search, UserRound, UserRoundPlus } from 'lucide-react';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { ROLE_LABELS, roleLabel } from '@/components/platform/shell/Sidebar';
import { PersonFace } from '@/components/ui/avatar-directory';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Figma "Staff Members" (node 565:13166, dark 570:23992): HR's list of everyone on the team. Name, email, role
// and joined date are real (profiles). Birth date, vacation days and extra work hours have no
// data source yet, so those cells show "—" until HR records exist.

export interface HrStaffRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

type SortKey = 'newest' | 'oldest' | 'name';

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const TH = 'px-2.5 text-left text-[12px] font-semibold leading-[1.4] whitespace-nowrap text-ui-body';
const TD = 'px-2.5 text-[13px] whitespace-nowrap text-ui-body';
const TOOLBAR_SELECT = 'inline-flex h-10 w-auto cursor-pointer items-center gap-2 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pr-3 text-[13px] font-medium text-[var(--color-secondary-700)] dark:rounded-[6px] dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg dark:pr-3 dark:text-ui-heading [&_svg]:size-3.5';
const MENU_ITEM = 'flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[4px] border-0 bg-transparent px-3 text-left text-[13px] leading-none text-ui-body no-underline hover:bg-ui-hover-bg [&_svg]:size-4 [&_svg]:shrink-0';
const NO_DATA = '—';

const fmtDate = (iso: string | null) => {
  if (!iso) return NO_DATA;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? NO_DATA : d.toLocaleDateString('en-US');
};
const initials = (name: string) => name.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

export function HrStaffClient({ staff, canInvite }: { staff: HrStaffRow[]; canInvite: boolean }) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [role, setRole] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  // Fixed-position row menu so the table's horizontal scroller can't clip it.
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [menuId]);

  const roleOptions = useMemo(() => {
    const roles = [...new Set(staff.map(s => s.role).filter((r): r is string => !!r))]
      .sort((a, b) => roleLabel(a).localeCompare(roleLabel(b)));
    return [{ value: '', label: 'Role' }, ...roles.map(r => ({ value: r, label: roleLabel(r) }))];
  }, [staff]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = staff.filter(s =>
      (!role || s.role === role) &&
      (!q || `${s.full_name ?? ''} ${s.email ?? ''}`.toLowerCase().includes(q)));
    return [...rows].sort((a, b) => {
      if (sortBy === 'name') return (a.full_name ?? '').localeCompare(b.full_name ?? '');
      const ta = Date.parse(a.created_at ?? '') || 0, tb = Date.parse(b.created_at ?? '') || 0;
      return sortBy === 'oldest' ? ta - tb : tb - ta;
    });
  }, [staff, query, role, sortBy]);

  async function copyEmail(email: string) {
    setMenuId(null);
    try { await navigator.clipboard.writeText(email); toast.success('Email copied'); }
    catch { toast.error('Could not copy'); }
  }

  const menuRow = menuId ? staff.find(s => s.id === menuId) : null;

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'Human Resources', href: '/hr' }, { label: 'Staff Members', href: '/hr/staff' }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Staff Members</h1>
        <p className="m-0 text-[13px] text-ui-body">{staff.length} Staff Member{staff.length === 1 ? '' : 's'}</p>
      </div>

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
            <ArrowDownUp aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--color-secondary-700)] dark:text-ui-heading" />
            <Select
              aria-label="Sort"
              className={cn(TOOLBAR_SELECT, 'pl-[34px] dark:pl-[34px]')}
              value={sortBy}
              onValueChange={v => setSortBy((v ?? 'newest') as SortKey)}
              options={[
                { value: 'newest', label: 'Newest' },
                { value: 'oldest', label: 'Oldest' },
                { value: 'name', label: 'Name A–Z' },
              ]}
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
            : <EmptyState icon={<Search />} title="No matching staff" description="Try another name, email or role." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse">
              <thead>
                <tr className="h-[46px] border-b border-ui-divider bg-[var(--ui-table-head-bg,var(--ui-surface))]">
                  <th scope="col" className={cn(TH, 'w-[290px] pl-[18px]')}>
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
                  <th scope="col" className={TH}>Birth Date</th>
                  <th scope="col" className={TH}>Joined Date</th>
                  <th scope="col" className={TH}>Vacation days Used</th>
                  <th scope="col" className={TH}>Vacation days Left</th>
                  <th scope="col" className={TH}>Extra Work Hours</th>
                  <th scope="col" className="w-[64px]"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(s => {
                  const name = s.full_name || s.email || 'Unnamed';
                  return (
                    <tr key={s.id} className="h-[77px] border-b border-ui-divider last:border-b-0">
                      <td className="max-w-0 py-2 pl-2 pr-2.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-[45px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[var(--status-t0-fg)] text-[13px] font-semibold text-white dark:text-primary-950">
                            <PersonFace name={s.full_name} userId={s.id} fallback={initials(name)} />
                          </span>
                          <span className="flex min-w-0 flex-col leading-[1.4]">
                            <Link href={`/team/${s.id}`} className={cn('truncate text-[14px] font-semibold no-underline hover:underline', HEADING)} title={name}>{name}</Link>
                            {s.email && <span className="truncate text-[11px] text-ui-body" title={s.email}>{s.email}</span>}
                          </span>
                        </div>
                      </td>
                      <td className={TD}>{s.role ? roleLabel(s.role) : NO_DATA}</td>
                      <td className={TD}>{NO_DATA}</td>
                      <td className={TD}>{fmtDate(s.created_at)}</td>
                      <td className={TD}>{NO_DATA}</td>
                      <td className={TD}>{NO_DATA}</td>
                      <td className={TD}>{NO_DATA}</td>
                      <td className="pr-4 text-center">
                        <button
                          type="button" aria-label={`Actions for ${name}`} aria-haspopup="menu" aria-expanded={menuId === s.id}
                          onClick={e => {
                            const b = e.currentTarget.getBoundingClientRect();
                            setMenuPos({ top: b.bottom + 4, right: window.innerWidth - b.right });
                            setMenuId(id => (id === s.id ? null : s.id));
                          }}
                          className="inline-grid size-7 cursor-pointer place-items-center rounded-[4px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg"
                        >
                          <Ellipsis size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {menuRow && menuPos && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setMenuId(null)} />
          <div role="menu" style={{ top: menuPos.top, right: menuPos.right }} className="fixed z-30 flex w-44 flex-col gap-1 rounded-[6px] border border-ui-divider bg-ui-surface-elevated p-1.5 text-left shadow-03">
            <Link href={`/team/${menuRow.id}`} role="menuitem" className={MENU_ITEM} onClick={() => setMenuId(null)}>
              <UserRound aria-hidden /> View profile
            </Link>
            {menuRow.email && <>
              <a href={`mailto:${menuRow.email}`} role="menuitem" className={MENU_ITEM} onClick={() => setMenuId(null)}>
                <Mail aria-hidden /> Send email
              </a>
              <button type="button" role="menuitem" className={MENU_ITEM} onClick={() => copyEmail(menuRow.email!)}>
                <Copy aria-hidden /> Copy email
              </button>
            </>}
          </div>
        </>
      )}

      {canInvite && <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />}
    </div>
  );
}

// Existing POST /api/team/invite (ops_manager / general_manager may invite any role).
const INVITE_ROLES = Object.entries(ROLE_LABELS)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label));

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [inviting, setInviting] = useState(false);
  const canSubmit = !!fullName.trim() && !!email.trim() && !!role && !inviting;
  const reset = () => { setFullName(''); setEmail(''); setRole(''); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setInviting(true);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName.trim(), email: email.trim(), role }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; alreadyExisted?: boolean };
      if (!res.ok) throw new Error(data.error || 'Invite failed');
      toast.success(data.alreadyExisted ? 'Existing user re-invited.' : `Invite sent to ${email.trim()}`);
      onOpenChange(false);
      reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setInviting(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset(); }}>
      <ModalContent
        title="Invite to team"
        description="They get an email to set up their account."
        footer={<>
          <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button type="submit" form="hr-invite-form" disabled={!canSubmit} loading={inviting}>Send invite</Button>
        </>}
      >
        <form id="hr-invite-form" onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
            Full name
            <Input autoFocus required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Jane Doe" />
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
            Email
            <Input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" />
          </label>
          <div className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
            <label htmlFor="hr-invite-role">Role</label>
            <Select id="hr-invite-role" value={role} onValueChange={v => setRole(v ?? '')} placeholder="Choose a role" options={INVITE_ROLES} />
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
