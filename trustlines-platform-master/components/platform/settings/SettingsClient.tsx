'use client';

import { useEffect, useState } from 'react';
import { Download, DatabaseBackup, ShieldAlert, EyeOff, KeyRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { readHideAmounts, writeHideAmounts } from '@/lib/privacy/hideAmounts';
import { toast } from 'sonner';

const MIN_PASSWORD = 8;

function ChangePasswordCard({ email }: { email: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSave = !saving && !!current && next.length >= MIN_PASSWORD && next === confirm && next !== current;

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

  const input: React.CSSProperties = { width: '100%', maxWidth: 360 };
  return (
    <div className="card">
      <div className="card-body" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <KeyRound size={18} /> Password
        </h2>
        <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: '0 0 16px', maxWidth: 640 }}>
          Change the password for <strong>{email}</strong>. Forgot it instead? Sign out and use “Forgot password” on the login screen.
        </p>
        <form onSubmit={save} style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)' }}>
            Current password
            <input className="form-input" style={input} type={show ? 'text' : 'password'} autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)' }}>
            New password
            <input className="form-input" style={input} type={show ? 'text' : 'password'} autoComplete="new-password" placeholder={`At least ${MIN_PASSWORD} characters`} value={next} onChange={e => setNext(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)' }}>
            Confirm new password
            <input className="form-input" style={input} type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </label>
          {mismatch && <span style={{ fontSize: 12, color: 'var(--status-danger, #b91c1c)' }}>Passwords do not match.</span>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-subtle)' }}>
            <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} /> Show passwords
          </label>
          {error && <div role="alert" style={{ fontSize: 13, color: 'var(--status-danger-fg, #b91c1c)' }}>{error}</div>}
          <div>
            <button type="submit" className="btn btn-primary" disabled={!canSave}>
              {saving ? 'Saving…' : 'Change password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SettingsClient({ isGeneralManager, email }: { isGeneralManager: boolean; email: string }) {
  const [downloading, setDownloading] = useState(false);
  const [hideAmounts, setHideAmounts] = useState(false);
  useEffect(() => { setHideAmounts(readHideAmounts()); }, []);
  function toggleHideAmounts() {
    const next = !hideAmounts;
    setHideAmounts(next);
    writeHideAmounts(next); // turning it off reloads the page (see AmountsMasker)
    if (next) toast.success('Amounts are now hidden on this device');
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
    <div style={{ display: 'grid', gap: 16 }}>
      <ChangePasswordCard email={email} />

      <div className="card">
        <div className="card-body" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <EyeOff size={18} /> Privacy
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Hide amounts</div>
              <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: '4px 0 0', maxWidth: 640 }}>
                Masks every money figure on screen as <strong>$•••••</strong> — pipeline value, deal sizes, deposits,
                totals. Columns and cards stay where they are; only the numbers are hidden. Applies to this browser
                only. It&apos;s a screen guard for when someone is looking over your shoulder, not a permission setting.
              </p>
            </div>
            <button
              type="button" role="switch" aria-checked={hideAmounts} aria-label="Hide amounts"
              onClick={toggleHideAmounts}
              style={{
                flexShrink: 0, width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative',
                background: hideAmounts ? 'var(--brand-teal)' : 'var(--border-default)', transition: 'background 120ms',
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: hideAmounts ? 23 : 3, width: 20, height: 20, borderRadius: '50%',
                background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)', transition: 'left 120ms',
              }} />
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <DatabaseBackup size={18} /> Backup &amp; restore
          </h2>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: '0 0 16px', maxWidth: 720 }}>
            The database is protected by Supabase&apos;s automated daily backups and point-in-time recovery, and the
            Dropbox document store is immutable (files are never deleted or overwritten). The button below downloads an
            on-demand <strong>JSON snapshot</strong> of the core operational tables (customers, projects, suppliers,
            invoices, payments, expenses, production, logistics, delivery). Documents are exported as metadata only —
            the file bytes live in Dropbox. Full restore procedures are in <code>BACKUP_RESTORE.md</code>.
          </p>

          {isGeneralManager ? (
            <button className="btn btn-primary" onClick={downloadBackup} disabled={downloading}>
              <Download size={15} /> {downloading ? 'Preparing…' : 'Download backup (JSON)'}
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--fg-subtle)' }}>
              <ShieldAlert size={16} /> Only the General Manager can download the full data snapshot.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
