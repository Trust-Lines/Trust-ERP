'use client';

import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { useEffect, useRef, useState } from 'react';
import { Camera, CloudSync, Download, EyeOff, Eye, Loader2, Lock, Palette, Pencil, ShieldAlert, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { readHideAmounts, writeHideAmounts } from '@/lib/privacy/hideAmounts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ThemeSwitch } from '@/components/platform/shared/ThemeSync';
import { SignaturePad } from '@/components/platform/SignaturePad';
import { roleLabel } from '@/components/platform/shell/Sidebar';
import { PhotoCropDialog } from './PhotoCropDialog';
import { AVATARS_CHANGED_EVENT } from '@/components/ui/avatar-directory';
import { MailSettingsCard } from './MailSettingsCard';
import { GoogleAccountCard } from './GoogleAccountCard';

const MIN_PASSWORD = 8;

// Figma "Settings_Profile" (node 348:23559).
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const CARD = 'rounded-[8px] border border-ui-divider bg-ui-page-bg px-5 pb-8 pt-5';
const BTN_PRIMARY = 'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[6px] border-0 bg-[var(--color-secondary-700)] px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-50 dark:text-primary-950';
const BTN_OUTLINE = 'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[6px] border border-solid border-[var(--color-secondary-700)] bg-transparent pl-5 pr-6 text-[13px] font-medium text-[var(--color-secondary-700)] transition-colors hover:bg-ui-hover-bg disabled:cursor-not-allowed disabled:opacity-50 dark:border-ui-heading dark:text-ui-heading';
const FIELD_LABEL = 'text-[12px] font-medium leading-4 text-ui-body';
const TEXT_INPUT = 'min-h-[42px] w-full rounded-[6px] border border-solid border-[var(--ui-input-border)] bg-ui-input-bg p-3 text-[11px] font-semibold leading-[1.5] tracking-[-0.242px] text-[var(--color-secondary-700)] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring dark:text-ui-heading';
// The profile banner: secondary-700 fill under a faint radial highlight.
const BANNER_BG = 'radial-gradient(398px 241px at 168px 95px, rgba(31,37,45,.2) 0%, rgba(53,62,74,.2) 15%, rgba(76,87,103,.2) 30%, rgba(98,111,132,.2) 46%, rgba(120,136,161,.2) 61%), var(--color-secondary-700)';

type Tab = 'profile' | 'preferences';

/** 0–4: length, mixed case, digit, symbol — only counted once the minimum length is met. */
function passwordScore(pw: string): number {
  if (pw.length < MIN_PASSWORD) return pw ? 1 : 0;
  return 1 + [/[a-z]/.test(pw) && /[A-Z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
}
const STRENGTH = [
  { label: '', color: '' },
  { label: 'Weak password', color: 'var(--color-error-normal)' },
  { label: 'Fair password', color: 'var(--color-warning-normal)' },
  { label: 'Good password', color: 'var(--color-success-normal)' },
  { label: 'Strong password', color: 'var(--color-success-normal)' },
];

function initialsOf(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length) return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function splitName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return [parts[0] ?? '', parts.slice(1).join(' ')];
}

function PasswordInput({ label, value, onChange, autoComplete, show, onToggleShow }: {
  label: string; value: string; onChange: (v: string) => void; autoComplete: string; show: boolean; onToggleShow: () => void;
}) {
  return (
    <label className="flex w-full flex-col gap-2">
      <span className="text-[14px] font-medium text-ui-body">{label}</span>
      <span className="flex h-12 w-full items-center gap-2.5 rounded-[6px] border border-solid border-[var(--ui-input-border)] bg-ui-surface pl-3.5 pr-1 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-ui-focus-ring">
        <Lock size={14} aria-hidden className="shrink-0 text-ui-text-secondary" />
        <input
          type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={e => onChange(e.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] text-[var(--color-secondary-700)] outline-none dark:text-ui-heading"
        />
        <button
          type="button" onClick={onToggleShow} aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="flex h-11 w-[45px] shrink-0 items-center justify-center border-0 bg-transparent p-0 text-ui-body"
        >
          {show ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
        </button>
      </span>
    </label>
  );
}

function ProfileBanner({ fullName, role, email, avatarUrl: initialAvatar }: { fullName: string; role: string; email: string; avatarUrl: string | null }) {
  const [signature, setSignature] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Profile photo (stored in Dropbox — app/api/me/avatar).
  const [avatar, setAvatar] = useState<string | null>(initialAvatar);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const [cropping, setCropping] = useState<File | null>(null);

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Choose an image'); return; }
    setPhotoBusy(true);
    try {
      const form = new FormData();
      form.append('file', file); // already a 512px square from PhotoCropDialog
      const res = await fetch('/api/me/avatar', { method: 'POST', body: form });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not upload the photo'); return; }
      setAvatar(b.url);
      window.dispatchEvent(new Event(AVATARS_CHANGED_EVENT));
      toast.success('Profile photo updated');
    } catch { toast.error('Could not upload the photo'); }
    finally { setPhotoBusy(false); }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      const res = await fetch('/api/me/avatar', { method: 'DELETE' });
      if (!res.ok) { toast.error('Could not remove the photo'); return; }
      setAvatar(null);
      window.dispatchEvent(new Event(AVATARS_CHANGED_EVENT));
      toast.success('Profile photo removed');
    } finally { setPhotoBusy(false); }
  }
  useEffect(() => {
    fetch('/api/user/signature').then(r => r.json()).then((j: { base64?: string | null }) => setSignature(j.base64 ?? null)).catch(() => setSignature(null));
  }, []);

  return (
    <div className="w-full overflow-hidden rounded-[10px] border border-ui-divider p-5" style={{ background: BANNER_BG }}>
      <div className="flex w-full items-center gap-4">
        <div className="relative flex size-[137px] shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-ui-page-bg">
          {avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={avatar} alt="Your profile photo" className="size-full object-cover" onError={() => setAvatar(null)} />
            : <span aria-hidden className="text-[40px] font-semibold text-[var(--color-secondary-700)] dark:text-ui-heading">{initialsOf(fullName, email)}</span>}
          <button
            type="button" onClick={() => photoInput.current?.click()} disabled={photoBusy}
            aria-label={avatar ? 'Change profile photo' : 'Upload profile photo'} title={avatar ? 'Change photo' : 'Upload photo'}
            className="absolute bottom-1 left-1 flex size-[33px] items-center justify-center rounded-[6px] border-0 bg-[var(--color-secondary-700)] p-1 text-white hover:opacity-90 disabled:opacity-60"
          >
            {photoBusy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Camera size={16} aria-hidden />}
          </button>
          {avatar && !photoBusy && (
            <button
              type="button" onClick={() => void removePhoto()} aria-label="Remove profile photo" title="Remove photo"
              className="absolute right-1 top-1 flex size-[26px] items-center justify-center rounded-[6px] border-0 bg-black/55 p-1 text-white hover:bg-black/70"
            >
              <X size={14} aria-hidden />
            </button>
          )}
          <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden
            onChange={e => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (!f) return;
              if (!f.type.startsWith('image/')) { toast.error('Choose an image'); return; }
              setCropping(f);
            }} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch p-1">
          <div className="flex flex-col">
            <p className="m-0 truncate text-[32px] font-semibold text-[var(--color-secondary-50)]">{fullName || email}</p>
            <p className="m-0 text-[16px] font-medium leading-[1.35] text-[var(--color-secondary-50)]">{role ? roleLabel(role) : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button" onClick={() => setEditing(true)} aria-label={signature ? 'Change signature' : 'Add signature'}
              className="flex h-9 w-[132px] items-center border-0 bg-transparent p-0 text-left text-[12px] text-[var(--color-secondary-100)]"
            >
              {signature
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={signature} alt="Your signature" className="h-9 max-w-[132px] object-contain object-left brightness-0 invert-[.93]" />
                : 'Add signature'}
            </button>
            <button
              type="button" onClick={() => setEditing(true)} aria-label="Edit signature" title="Edit signature"
              className="flex size-[33px] shrink-0 items-center justify-center rounded-[6px] border-0 bg-white/15 p-1 text-white hover:bg-white/25"
            >
              <Pencil size={16} aria-hidden />
            </button>
          </div>
        </div>
      </div>
      {cropping && (
        <PhotoCropDialog
          file={cropping}
          onCancel={() => setCropping(null)}
          onCropped={f => { setCropping(null); void uploadPhoto(f); }}
        />
      )}
      {editing && (
        <SignaturePad
          existingBase64={signature}
          onSaved={base64 => { setSignature(base64); setEditing(false); }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function PersonalInfoCard({ fullName, email }: { fullName: string; email: string }) {
  const [first, last] = splitName(fullName);

  // Names are managed by ops on the Team page; there is no self-service save endpoint.
  return (
    <div className={cn(CARD, 'flex w-full flex-1 flex-col')}>
      <div className="flex w-full flex-col gap-[18px]">
        <div className="flex w-full items-start justify-between gap-4">
          <h2 className={cn('m-0 text-[20px] font-semibold leading-[1.45]', HEADING)}>Personal Information</h2>
          <button type="button" className={BTN_PRIMARY} disabled title="Name changes are made by an Ops Manager on the Team page">Save Changes</button>
        </div>
        <div className="flex w-full flex-col gap-4">
          <div className="flex w-full flex-col gap-4 sm:flex-row">
            <label className="flex min-w-0 flex-1 flex-col gap-[7px]">
              <span className={FIELD_LABEL}>First Name</span>
              <input className={TEXT_INPUT} value={first} readOnly aria-readonly />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-[7px]">
              <span className={FIELD_LABEL}>Last Name</span>
              <input className={TEXT_INPUT} value={last} readOnly aria-readonly />
            </label>
          </div>
          <label className="flex w-full flex-col gap-[7px]">
            <span className={FIELD_LABEL}>Email Address</span>
            <input className={cn(TEXT_INPUT, 'cursor-not-allowed border-transparent bg-ui-divider')} value={email} readOnly aria-readonly />
          </label>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordCard({ email }: { email: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (k: keyof typeof show) => () => setShow(s => ({ ...s, [k]: !s[k] }));
  const score = passwordScore(next);
  const longEnough = next.length >= MIN_PASSWORD;
  const matches = confirm.length > 0 && next === confirm;
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSave = !saving && !!current && longEnough && matches && next !== current;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (next === current) { setError('The new password must be different from the current one.'); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      // Re-check the current password first: a stolen open session alone must not be enough to change it.
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: current });
      if (verifyError) { setError('Your current password is incorrect.'); return; }
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) { setError(updateError.message); return; }
      toast.success('Password changed');
      setCurrent(''); setNext(''); setConfirm('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className={cn(CARD, 'flex min-w-0 flex-1 flex-col')}>
      <div className="flex w-full flex-col gap-[18px]">
        <div className="flex w-full items-start gap-[18px]">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className={cn('m-0 text-[20px] font-semibold', HEADING)}>Password</h2>
            <p className="m-0 text-[13px] text-ui-text-secondary">
              Change the password for <span className="font-medium text-ui-body">{email}</span>
            </p>
          </div>
          <button type="submit" className={BTN_PRIMARY} disabled={!canSave}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>

        <div className="flex w-full flex-col gap-5">
          <PasswordInput label="Current password" autoComplete="current-password" value={current} onChange={setCurrent} show={show.current} onToggleShow={toggle('current')} />

          <div className="flex w-full flex-col gap-3">
            <PasswordInput label="New password" autoComplete="new-password" value={next} onChange={setNext} show={show.next} onToggleShow={toggle('next')} />
            {next && (
              <div className="flex w-full flex-col gap-2" aria-live="polite">
                <div className="flex w-full gap-1" aria-hidden>
                  {[1, 2, 3, 4].map(i => (
                    <span key={i} className="h-1 flex-1 rounded-[2px] bg-ui-divider" style={i <= score ? { background: STRENGTH[score].color } : undefined} />
                  ))}
                </div>
                <p className="m-0 text-[12px]" style={{ color: STRENGTH[score].color }}>{STRENGTH[score].label}</p>
                <p className={cn('m-0 text-[12px]', !longEnough && 'text-ui-text-secondary')} style={longEnough ? { color: 'var(--color-success-normal)' } : undefined}>
                  {longEnough ? '✓' : '•'} At least {MIN_PASSWORD} characters
                </p>
              </div>
            )}
          </div>

          <PasswordInput label="Confirm password" autoComplete="new-password" value={confirm} onChange={setConfirm} show={show.confirm} onToggleShow={toggle('confirm')} />

          {matches && <p className="m-0 text-[12px]" style={{ color: 'var(--color-success-normal)' }}>✓ Passwords match</p>}
          {mismatch && <p className="m-0 text-[12px]" style={{ color: 'var(--color-error-normal)' }}>Passwords do not match.</p>}
          {error && <p role="alert" className="m-0 text-[13px]" style={{ color: 'var(--color-error-normal)' }}>{error}</p>}
        </div>
      </div>
    </form>
  );
}

function BackupCard({ isGeneralManager, canBackUpContacts }: { isGeneralManager: boolean; canBackUpContacts: boolean }) {
  const [downloading, setDownloading] = useState(false);
  const [backingUpContacts, setBackingUpContacts] = useState(false);

  async function backUpContacts() {
    setBackingUpContacts(true);
    try {
      const res = await fetch('/api/marketing/backup', { method: 'POST' });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? 'Backup failed');
      toast.success(`Contacts backed up to Dropbox: ${b.xlsxPath}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Backup failed');
    } finally { setBackingUpContacts(false); }
  }

  async function downloadBackup() {
    setDownloading(true);
    try {
      const res = await fetch('/api/admin/backup', { cache: 'no-store' });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? 'Backup failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trustlines-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Backup failed');
    } finally { setDownloading(false); }
  }

  return (
    <div className="w-full rounded-[11px] border border-ui-divider bg-ui-page-bg px-6 py-4">
      <div className="flex w-full flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col leading-[1.35]">
          <h2 className={cn('m-0 text-[20px] font-semibold leading-[1.35]', HEADING)}>Backup &amp; restore</h2>
          <p className="m-0 max-w-[392px] text-[13px] text-ui-body">
            Automatic backups protect your data. Download a JSON snapshot of your records. Dropbox documents are not included.
          </p>
          {!isGeneralManager && (
            <p className="m-0 mt-2 flex items-center gap-1.5 text-[12px] text-ui-text-secondary">
              <ShieldAlert size={14} aria-hidden /> Only the General Manager can download the full data snapshot.
            </p>
          )}
        </div>
        {(isGeneralManager || canBackUpContacts) && (
          <div className="flex flex-wrap items-center gap-4">
            {/* Same roles as POST /api/marketing/backup (MARKETING_MANAGE_ROLES). */}
            {canBackUpContacts && (
              <button
                type="button" className={BTN_OUTLINE} onClick={backUpContacts} disabled={backingUpContacts}
                title="Excel + JSON of every Contact into Dropbox → Marketing/_Backups/Contacts — the same file the nightly job makes"
              >
                <CloudSync size={16} aria-hidden /> {backingUpContacts ? 'Backing up…' : 'Back up'}
              </button>
            )}
            {isGeneralManager && (
              <button type="button" className={BTN_PRIMARY} onClick={downloadBackup} disabled={downloading}>
                <Download size={16} aria-hidden /> {downloading ? 'Preparing…' : 'Download Backup'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PreferencesTab({ email }: { email: string }) {
  const [hideAmounts, setHideAmounts] = useState(false);
  useEffect(() => { setHideAmounts(readHideAmounts()); }, []);
  function toggleHideAmounts() {
    const next = !hideAmounts;
    setHideAmounts(next);
    writeHideAmounts(next); // turning it off reloads the page (see AmountsMasker)
    if (next) toast.success('Amounts are now hidden on this device');
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <MailSettingsCard email={email} />

      <GoogleAccountCard />

      <div className="card">
        <div className="card-body" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Palette size={18} /> Appearance
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Theme</div>
              <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: '4px 0 0', maxWidth: 640 }}>
                Light, dark, or follow your device setting. Applies to this browser only.
              </p>
            </div>
            <ThemeSwitch />
          </div>
        </div>
      </div>

      {/* Figma "Hide amounts" (node 336:23072). */}
      <div className="card">
        <div className="card-body" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <EyeOff size={18} /> Hide amounts
          </h2>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <p className="m-0 max-w-[414px]" style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>
              Pipeline value, deal sizes, deposits, totals. It&apos;s a screen guard for when someone is looking over your
              shoulder, not a permission setting.
            </p>
            <div className="flex items-center gap-16">
              <div aria-hidden className={cn('flex h-[66px] w-[207px] items-center justify-center rounded-[11px] border border-ui-divider text-[28px] font-semibold leading-[1.35] tracking-[2.24px] whitespace-nowrap', HEADING)}>
                {hideAmounts ? '$ •••••••' : '$ 25,000'}
              </div>
              <button
                type="button" role="switch" aria-checked={hideAmounts} aria-label="Hide amounts"
                onClick={toggleHideAmounts}
                className={cn(
                  'relative h-[37px] w-[72px] shrink-0 cursor-pointer rounded-[8px] border-0 transition-colors',
                  hideAmounts ? 'bg-[var(--color-primary-500)] dark:bg-ui-btn-accent' : 'bg-ui-selected-bg',
                )}
              >
                <span className={cn('absolute top-[3.5px] size-[30px] rounded-[4px] bg-white transition-[left]', hideAmounts ? 'left-[38.5px]' : 'left-[3.5px]')} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsClient({ isGeneralManager, canBackUpContacts, role, fullName, email, avatarUrl = null }: {
  isGeneralManager: boolean; canBackUpContacts: boolean; role: string; fullName: string; email: string;
  /** /api/avatar/<id>?v=… when the person has a photo (migration 135). */
  avatarUrl?: string | null;
}) {
  const [tab, setTab] = useState<Tab>('profile');
  const tabs: { key: Tab; label: string }[] = [{ key: 'profile', label: 'Profile' }, { key: 'preferences', label: 'Preferences' }];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-[30px]">
        {/* ── Page heading ── */}
        <div className="flex flex-col gap-[5px] leading-[1.35]">
          <PageCrumbs items={[{ label: 'Admin', href: '/settings' }, { label: 'Settings', href: '/settings' }]} />
          <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Settings</h1>
          <p className="m-0 text-[13px] text-ui-body">Personal information, appearance</p>
        </div>

        {/* ── Saved views (underline tabs, 48px, 3px active border) ── */}
        <div role="tablist" aria-label="Settings sections" className="flex h-12 items-stretch gap-8 border-b border-ui-divider">
          {tabs.map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key} type="button" role="tab" aria-selected={active} onClick={() => setTab(t.key)}
                className={cn(
                  'flex shrink-0 items-center whitespace-nowrap border-0 border-b-[3px] border-solid bg-transparent px-0 text-[13px] leading-[1.4]',
                  active
                    ? 'border-[var(--color-secondary-700)] font-semibold text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading'
                    : 'border-transparent text-ui-text-secondary hover:text-ui-body',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'profile' && (
          <div className="flex w-full flex-col items-stretch gap-6 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-6 self-stretch">
              <ProfileBanner fullName={fullName} role={role} email={email} avatarUrl={avatarUrl} />
              <PersonalInfoCard fullName={fullName} email={email} />
            </div>
            <ChangePasswordCard email={email} />
          </div>
        )}
        {tab === 'preferences' && <PreferencesTab email={email} />}
      </div>

      {tab === 'profile' && <BackupCard isGeneralManager={isGeneralManager} canBackUpContacts={canBackUpContacts} />}
    </div>
  );
}
