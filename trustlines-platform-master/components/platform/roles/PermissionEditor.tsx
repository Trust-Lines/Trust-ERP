'use client';

import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { Bell, Eye, Monitor, PenLine, ShieldCheck, Signature, ToggleLeft, ToggleRight, TrendingUp, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PERMISSION_GROUPS, hasDefault, pageAllowed, pageInherited, type PermCategory } from '@/lib/permissions/catalog';
import { HEADING } from './roleShared';

const GROUP_ICONS: Record<PermCategory, LucideIcon> = {
  page: Monitor, edit: PenLine, sign: Signature, view: Eye, notify: Bell, progress: TrendingUp,
};

// Figma: 54×28 track with an inset 23×22 thumb — bigger and squarer than components/ui/switch.
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      className="inline-flex h-7 w-[54px] shrink-0 cursor-pointer items-center rounded-[8px] bg-ui-selected-bg p-[3px] outline-none transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring data-checked:bg-[var(--color-secondary-700)] dark:data-checked:bg-[var(--color-secondary-50)]"
    >
      {/* Figma 35:4841 — enabled thumb: secondary-100 fill with a 1px primary-700 border. */}
      <SwitchPrimitive.Thumb className="h-[22px] w-[23px] rounded-[4px] border border-transparent bg-ui-page-bg transition-transform duration-150 data-checked:translate-x-[25px] data-checked:border-[var(--color-primary-700)] data-checked:bg-[var(--color-secondary-100)]" />
    </SwitchPrimitive.Root>
  );
}

/** Permission groups for one role, with per-group Enable All / Clear All. `all` = superadmin, no switches. */
export function PermissionEditor({
  roleName, perms, isSystem, onChange,
}: {
  roleName: string;
  perms:    Record<string, boolean>;
  isSystem: boolean;
  onChange: (p: Record<string, boolean>) => void;
}) {
  const isAll = !!perms['all'];
  // Pages use the same rule as the app (pageAllowed): a page the role hasn't set yet follows its
  // parent page / old default, so the switch shows what the role can really open today.
  const isOn = (category: string, key: string) => (category === 'page' || hasDefault(key) ? pageAllowed(roleName, perms, key) : !!perms[key]);

  function set(key: string, val: boolean) { onChange({ ...perms, [key]: val }); }

  function setGroup(keys: string[], val: boolean) {
    const patch = { ...perms };
    keys.forEach(k => { patch[k] = val; });
    onChange(patch);
  }

  if (isAll) {
    return (
      <div style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <ShieldCheck size={34} color="var(--brand-teal)" />
        <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Superadmin — full access</p>
        <p style={{ fontSize: 12, color: 'var(--fg-faint)', margin: 0, textAlign: 'center' }}>This role bypasses every permission check (signing, visibility, notifications, progress).</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {isSystem && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'var(--status-info-bg)', border: '1px solid color-mix(in srgb, var(--status-info) 35%, transparent)', borderRadius: 8, fontSize: 12, color: 'var(--status-info-fg)' }}>
          🛡️ System role — defaults shown. You can still tailor its permissions; changes are saved.
        </div>
      )}

      {PERMISSION_GROUPS.map(group => {
        const keys = group.perms.map(p => p.key);
        const granted = keys.filter(k => isOn(group.category, k)).length;
        const allOn = granted === keys.length;
        const GroupIcon = GROUP_ICONS[group.category];
        return (
          <section key={group.title} aria-label={group.title} className="flex flex-col gap-4 rounded-[10px] border border-ui-divider bg-ui-surface-elevated px-2 pb-2.5 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-2">
              <div className="flex min-h-9 min-w-0 items-center gap-1.5">
                <GroupIcon size={26} className={`shrink-0 ${HEADING}`} aria-hidden />
                <h2 className={`m-0 text-[20px] font-semibold leading-normal ${HEADING}`}>{group.title}</h2>
                <span className="ml-1 whitespace-nowrap text-[12px] text-ui-text-secondary">{granted}/{keys.length} enabled</span>
              </div>
              <Button onClick={() => setGroup(keys, !allOn)}>
                {allOn ? <ToggleLeft aria-hidden /> : <ToggleRight aria-hidden />}
                {allOn ? 'Clear All' : 'Enable All'}
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {group.perms.map(p => {
                const on = isOn(group.category, p.key);
                const inherited = pageInherited(perms, p.key);
                return (
                  <div key={p.key} className="flex items-center justify-between gap-3 rounded-[6px] border border-ui-divider bg-ui-surface px-6 py-4">
                    <div className="min-w-0">
                      <div className={`text-[20px] font-semibold leading-[1.35] ${HEADING}`}>{p.label}</div>
                      {p.hint && <div className="mt-0.5 text-[12px] text-ui-text-secondary">{p.hint}</div>}
                      {inherited && <div className="mt-0.5 text-[11px] italic text-ui-text-secondary">Follows the default — switch it to set it for this role</div>}
                    </div>
                    <Toggle checked={on} onChange={val => set(p.key, val)} label={p.label} />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
