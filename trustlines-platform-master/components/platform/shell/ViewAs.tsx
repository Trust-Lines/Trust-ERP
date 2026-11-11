'use client';

import * as React from 'react';
import { Eye, X } from 'lucide-react';
import { toast } from 'sonner';
import { Select } from '@/components/ui/select';
import { ROLE_LABELS, roleLabel } from './Sidebar';

// "View as role" for a General Manager (server side: lib/viewAs.ts, /api/view-as).

export interface ViewAsState {
  /** The real role may preview others (General Manager). */
  canViewAs: boolean;
  /** The role being previewed, or null. */
  viewAs: string | null;
}

const Ctx = React.createContext<ViewAsState>({ canViewAs: false, viewAs: null });
export const ViewAsProvider = ({ value, children }: { value: ViewAsState; children: React.ReactNode }) =>
  <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const useViewAs = () => React.useContext(Ctx);

function useSwitchRole() {
  const [busy, setBusy] = React.useState(false);
  const run = async (role: string | null) => {
    setBusy(true);
    try {
      const res = await fetch('/api/view-as', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not switch role'); setBusy(false); return; }
      // Full reload on a page every role can open: drops the client router cache (and any
      // prefetched pages rendered for the previous role) and closes open menus.
      window.location.assign('/home');
    } catch { toast.error('Could not switch role'); setBusy(false); }
  };
  return { run, busy };
}

// Built on first use: Sidebar imports this module (via UserMenu), so ROLE_LABELS is not ready at load time.
const roleOptions = () => Object.entries(ROLE_LABELS).sort((a, b) => a[1].localeCompare(b[1]));

function RoleSelect({ value, onPick, disabled, className }: { value: string; onPick: (role: string | null) => void; disabled?: boolean; className?: string }) {
  const options = React.useMemo(() => [
    { value: '', label: 'My own role (General Manager)' },
    ...roleOptions().filter(([k]) => k !== 'general_manager').map(([k, label]) => ({ value: k, label })),
  ], []);
  return (
    <Select
      aria-label="View as role" value={value} disabled={disabled}
      onValueChange={v => { if (v !== null && v !== value) onPick(v || null); }}
      options={options}
      className={className}
    />
  );
}

/** Account-menu entry: pick a role to preview. */
export function ViewAsMenuItem() {
  const { canViewAs, viewAs } = useViewAs();
  const { run, busy } = useSwitchRole();
  if (!canViewAs) return null;
  return (
    <div className="px-3 pt-1 pb-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-primary-300 dark:text-primary-400"><Eye className="h-3.5 w-3.5" aria-hidden /> View as role</p>
      <RoleSelect
        value={viewAs ?? ''} disabled={busy} onPick={run}
        className="h-9 text-[13px]"
      />
    </div>
  );
}

/** Shown on every page while previewing — always offers the way back. */
export function ViewAsBanner() {
  const { canViewAs, viewAs } = useViewAs();
  const { run, busy } = useSwitchRole();
  if (!canViewAs || !viewAs) return null;
  return (
    <div role="status" className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 bg-[#f59e0b] px-4 py-1.5 text-[13px] font-medium text-[#1f1300]">
      <Eye className="h-4 w-4" aria-hidden />
      <span>Viewing as <b>{roleLabel(viewAs)}</b> — you see what this role sees. Your own account is unchanged.</span>
      <RoleSelect
        value={viewAs} disabled={busy} onPick={run}
        className="h-7 w-auto min-w-[180px] rounded border-[#1f1300]/30 bg-white/80 px-1.5 text-[12px] text-[#1f1300] hover:border-[#1f1300]/60 dark:rounded dark:border-[#1f1300]/30 dark:bg-white/80 dark:px-1.5 dark:text-[#1f1300] dark:hover:border-[#1f1300]/60"
      />
      <button type="button" disabled={busy} onClick={() => void run(null)}
        className="inline-flex h-7 items-center gap-1 rounded bg-[#1f1300] px-2.5 text-[12px] font-semibold text-white hover:opacity-90">
        <X className="h-3.5 w-3.5" aria-hidden /> Exit
      </button>
    </div>
  );
}
