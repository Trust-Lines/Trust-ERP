'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Activity, Camera, Loader2, Search, X } from 'lucide-react';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { EmptyState } from '@/components/ui/empty-state';
import { AVATARS_CHANGED_EVENT } from '@/components/ui/avatar-directory';
import { PhotoCropDialog } from '@/components/platform/settings/PhotoCropDialog';
import { actionTone, fmtAction } from '@/components/platform/audit/AuditLogClient';
import { roleLabel as fallbackRoleLabel } from '@/components/platform/shell/Sidebar';
import { COMPANY_SIDE_LABELS, DEPARTMENT_LABELS, officeLabel, type CompanySide, type Department } from '@/lib/profile/metadata';
import { REGIONS } from '@/lib/regions';
import { cn } from '@/lib/utils';

export interface MemberProfile {
  id: string;
  fullName: string;
  email: string;
  role: string;
  roleLabel: string | null;
  isActive: boolean;
  joinedAt: string | null;
  avatarUrl: string | null;
  department: string | null;
  office: string | null;
  companySide: string | null;
  manager: string | null;
  regions: string[];
}

export interface MemberActivity {
  id: string;
  action: string;
  resource: string | null;
  at: string;
  project: { id: string; code: string; name: string } | null;
}

// Same banner as Settings → Profile (components/platform/settings/SettingsClient.tsx).
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const BANNER_BG = 'radial-gradient(398px 241px at 168px 95px, rgba(31,37,45,.2) 0%, rgba(53,62,74,.2) 15%, rgba(76,87,103,.2) 30%, rgba(98,111,132,.2) 46%, rgba(120,136,161,.2) 61%), var(--color-secondary-700)';
const FILTER = 'h-10 w-full max-w-[320px] rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-9 pr-3 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-disabled focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring';

function initialsOf(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length) return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-US') : null);
const fmtTime = (d: string) => new Date(d).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function MemberProfileClient({ profile, activity, canEditPhoto }: {
  profile: MemberProfile;
  /** null = this viewer may not see it (Audit Log permission). */
  activity: MemberActivity[] | null;
  canEditPhoto: boolean;
}) {
  const name = profile.fullName || profile.email;
  const role = profile.roleLabel ?? (profile.role ? fallbackRoleLabel(profile.role) : '');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <PageCrumbs items={[{ label: 'Admin', href: '/team' }, { label: 'Team Members', href: '/team' }, { label: name, href: `/team/${profile.id}` }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>{name}</h1>
      </div>

      <Banner profile={profile} name={name} role={role} canEditPhoto={canEditPhoto} />

      <section className="flex flex-col gap-4 rounded-[10px] border border-ui-divider bg-ui-surface-elevated p-5">
        <h2 className={cn('m-0 text-[20px] font-semibold leading-normal', HEADING)}>Details</h2>
        <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {([
            ['Email', profile.email],
            ['Role', role],
            ['Status', profile.isActive ? 'Active' : 'Inactive'],
            ['Company', profile.companySide ? COMPANY_SIDE_LABELS[profile.companySide as CompanySide] ?? profile.companySide : null],
            ['Department', profile.department ? DEPARTMENT_LABELS[profile.department as Department] ?? profile.department : null],
            ['Office', officeLabel(profile.office)],
            ['Region', profile.regions.map(c => REGIONS.find(r => r.code === c)?.label ?? c).join(', ') || null],
            ['Manager', profile.manager],
            ['Joined', fmtDate(profile.joinedAt)],
          ] as [string, string | null][]).map(([label, value]) => (
            <div key={label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-[12px] text-ui-text-secondary">{label}</dt>
              <dd className="m-0 truncate text-[14px] font-medium text-ui-body">{value || '—'}</dd>
            </div>
          ))}
        </dl>
      </section>

      {activity && <ActivityList activity={activity} />}
    </div>
  );
}

function Banner({ profile, name, role, canEditPhoto }: { profile: MemberProfile; name: string; role: string; canEditPhoto: boolean }) {
  const [avatar, setAvatar] = useState<string | null>(profile.avatarUrl);
  const [busy, setBusy] = useState(false);
  const [cropping, setCropping] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const api = `/api/team/${profile.id}/avatar`;

  async function upload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file); // already a 512px square from PhotoCropDialog
      const res = await fetch(api, { method: 'POST', body: form });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not upload the photo'); return; }
      setAvatar(b.url);
      window.dispatchEvent(new Event(AVATARS_CHANGED_EVENT));
      toast.success('Profile photo updated');
    } catch { toast.error('Could not upload the photo'); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(api, { method: 'DELETE' });
      if (!res.ok) { toast.error('Could not remove the photo'); return; }
      setAvatar(null);
      window.dispatchEvent(new Event(AVATARS_CHANGED_EVENT));
      toast.success('Profile photo removed');
    } finally { setBusy(false); }
  }

  return (
    <div className="w-full overflow-hidden rounded-[10px] border border-ui-divider p-5" style={{ background: BANNER_BG }}>
      <div className="flex w-full items-center gap-4">
        <div className="relative flex size-[137px] shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-ui-page-bg">
          {avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={avatar} alt={`${name}’s profile photo`} className="size-full object-cover" onError={() => setAvatar(null)} />
            : <span aria-hidden className={cn('text-[40px] font-semibold', HEADING)}>{initialsOf(profile.fullName, profile.email)}</span>}
          {canEditPhoto && (
            <>
              <button
                type="button" onClick={() => input.current?.click()} disabled={busy}
                aria-label={avatar ? 'Change profile photo' : 'Upload profile photo'} title={avatar ? 'Change photo' : 'Upload photo'}
                className="absolute bottom-1 left-1 flex size-[33px] items-center justify-center rounded-[6px] border-0 bg-[var(--color-secondary-700)] p-1 text-white hover:opacity-90 disabled:opacity-60"
              >
                {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Camera size={16} aria-hidden />}
              </button>
              {avatar && !busy && (
                <button
                  type="button" onClick={() => void remove()} aria-label="Remove profile photo" title="Remove photo"
                  className="absolute right-1 top-1 flex size-[26px] items-center justify-center rounded-[6px] border-0 bg-black/55 p-1 text-white hover:bg-black/70"
                >
                  <X size={14} aria-hidden />
                </button>
              )}
              <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden
                onChange={e => {
                  const f = e.target.files?.[0]; e.target.value = '';
                  if (!f) return;
                  if (!f.type.startsWith('image/')) { toast.error('Choose an image'); return; }
                  setCropping(f);
                }} />
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 p-1">
          <p className="m-0 truncate text-[32px] font-semibold text-[var(--color-secondary-50)]">{name}</p>
          <p className="m-0 text-[16px] font-medium leading-[1.35] text-[var(--color-secondary-50)]">{role}</p>
          <p className="m-0 truncate text-[13px] text-[var(--color-secondary-100)]">{profile.email}</p>
        </div>
      </div>
      {cropping && (
        <PhotoCropDialog
          file={cropping}
          onCancel={() => setCropping(null)}
          onCropped={f => { setCropping(null); void upload(f); }}
        />
      )}
    </div>
  );
}

function ActivityList({ activity }: { activity: MemberActivity[] }) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activity;
    return activity.filter(a => [a.action, a.resource, a.project?.code, a.project?.name].some(v => v?.toLowerCase().includes(q)));
  }, [activity, query]);

  return (
    <section className="flex flex-col gap-4 rounded-[10px] border border-ui-divider bg-ui-surface-elevated p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className={cn('m-0 text-[20px] font-semibold leading-normal', HEADING)}>Activity</h2>
          <span className="text-[12px] text-ui-text-secondary">Last 90 days · {activity.length}</span>
        </div>
        <label className="relative w-full max-w-[320px]">
          <Search size={14} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
          <input className={FILTER} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search activity" aria-label="Search activity" />
        </label>
      </div>
      {shown.length === 0 ? (
        <EmptyState size="sm" icon={<Activity />} title={activity.length ? 'No matching activity' : 'No activity in the last 90 days'} />
      ) : (
        <ol className="m-0 flex list-none flex-col p-0">
          {shown.map(a => {
            const tone = actionTone(a.action);
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-ui-divider py-3 last:border-b-0">
                <span className="w-[150px] shrink-0 text-[12px] text-ui-text-secondary">{fmtTime(a.at)}</span>
                <span
                  className="inline-flex h-[22px] shrink-0 items-center rounded-[4px] px-2.5 text-[12px] font-medium leading-4"
                  style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}
                >
                  {fmtAction(a.action)}
                </span>
                {a.project && (
                  <Link href={`/projects/${a.project.id}`} className={cn('truncate text-[13px] font-semibold no-underline hover:underline', HEADING)}>
                    {a.project.code} — {a.project.name}
                  </Link>
                )}
                {a.resource && <span className="min-w-0 truncate text-[12px] text-ui-body">{a.resource}</span>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
