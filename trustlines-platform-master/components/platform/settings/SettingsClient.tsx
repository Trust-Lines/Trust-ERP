'use client';

import { useState } from 'react';
import { Download, DatabaseBackup, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export function SettingsClient({ isGeneralManager }: { isGeneralManager: boolean }) {
  const [downloading, setDownloading] = useState(false);

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
