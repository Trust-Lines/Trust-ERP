'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RotateCcw, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/formatDate';

export interface TrashRow {
  id: string;
  name: string;
  project_no: string | null;
  deleted_at: string;
  daysLeft: number;
}

export function LeadsTrashClient({ rows, canPurge }: { rows: TrashRow[]; canPurge: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function restore(r: TrashRow) {
    setBusy(r.id);
    try {
      const res = await fetch(`/api/leads/${r.id}/restore`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Restored');
      router.refresh();
    } catch { toast.error('Could not restore'); }
    finally { setBusy(null); }
  }

  async function purge(r: TrashRow) {
    if (!window.confirm(`Permanently delete "${r.name}"? This cannot be undone.`)) return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/leads/${r.id}/permanent-delete`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      toast.success('Permanently deleted');
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not delete'); }
    finally { setBusy(null); }
  }

  if (rows.length === 0) {
    return (
      <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
        Trash is empty.
      </div></div>
    );
  }

  return (
    <div className="card">
      <div className="card-body flush">
        <table className="tbl">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Deleted</th>
              <th>Auto-purge</th>
              <th style={{ width: 220 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{r.name}</div>
                  {r.project_no && <div className="row-sub">{r.project_no}</div>}
                </td>
                <td><span style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>{formatDate(r.deleted_at)}</span></td>
                <td>
                  <span style={{ fontSize: 13, color: r.daysLeft <= 5 ? 'var(--status-danger)' : 'var(--fg-subtle)' }}>
                    {r.daysLeft > 0 ? `in ${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'}` : 'due for purge'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" disabled={busy === r.id} onClick={() => restore(r)}>
                      <RotateCcw size={13} /> Restore
                    </button>
                    {canPurge && (
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-danger)' }} disabled={busy === r.id} onClick={() => purge(r)}>
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
