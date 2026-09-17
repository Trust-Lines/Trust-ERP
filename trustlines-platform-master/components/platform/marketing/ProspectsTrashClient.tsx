'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RotateCcw, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/formatDate';

export interface ProspectTrashRow {
  id: string;
  display_name: string;
  entity_type: string;
  deleted_at: string;
  daysLeft: number;
}

export interface NeedTrashRow {
  id: string;
  prospect_id: string;
  prospect_name: string;
  title: string;
  classification: string;
  deleted_at: string;
  daysLeft: number;
}

const NEED_CLASSIFICATION_LABEL: Record<string, string> = {
  opportunity: 'Opportunity', potential: 'Potential', disqualified: 'Disqualified', unclassified: 'Unclassified',
};

export function ProspectsTrashClient({ rows, needRows, canPurge }: { rows: ProspectTrashRow[]; needRows: NeedTrashRow[]; canPurge: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function restore(r: ProspectTrashRow) {
    setBusy(r.id);
    try {
      const res = await fetch(`/api/marketing/prospects/${r.id}/restore`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Restored');
      router.refresh();
    } catch { toast.error('Could not restore'); }
    finally { setBusy(null); }
  }

  async function purge(r: ProspectTrashRow) {
    if (!window.confirm(`Permanently delete "${r.display_name}"? This cannot be undone.`)) return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/marketing/prospects/${r.id}/permanent-delete`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      toast.success('Permanently deleted');
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not delete'); }
    finally { setBusy(null); }
  }

  async function restoreNeed(n: NeedTrashRow) {
    setBusy(n.id);
    try {
      const res = await fetch(`/api/marketing/prospects/${n.prospect_id}/needs/${n.id}/restore`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Restored');
      router.refresh();
    } catch { toast.error('Could not restore'); }
    finally { setBusy(null); }
  }

  async function purgeNeed(n: NeedTrashRow) {
    if (!window.confirm(`Permanently delete "${n.title}"? This cannot be undone.`)) return;
    setBusy(n.id);
    try {
      const res = await fetch(`/api/marketing/prospects/${n.prospect_id}/needs/${n.id}/permanent-delete`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      toast.success('Permanently deleted');
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not delete'); }
    finally { setBusy(null); }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-subtle)', marginBottom: 8 }}>Contacts ({rows.length})</div>
        {rows.length === 0 ? (
          <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--fg-subtle)' }}>
            No deleted Contacts.
          </div></div>
        ) : (
          <div className="card">
            <div className="card-body flush">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Type</th>
                    <th>Deleted</th>
                    <th>Auto-purge</th>
                    <th style={{ width: 220 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td><div style={{ fontWeight: 500 }}>{r.display_name}</div></td>
                      <td><span style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>{r.entity_type === 'person' ? 'Person' : 'Organization'}</span></td>
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
        )}
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-subtle)', marginBottom: 8 }}>Needs — Potentials/Opportunities ({needRows.length})</div>
        {needRows.length === 0 ? (
          <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--fg-subtle)' }}>
            No deleted Needs.
          </div></div>
        ) : (
          <div className="card">
            <div className="card-body flush">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Need</th>
                    <th>Contact</th>
                    <th>Was</th>
                    <th>Deleted</th>
                    <th>Auto-purge</th>
                    <th style={{ width: 220 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {needRows.map(n => (
                    <tr key={n.id}>
                      <td><div style={{ fontWeight: 500 }}>{n.title}</div></td>
                      <td><span style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>{n.prospect_name}</span></td>
                      <td><span style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>{NEED_CLASSIFICATION_LABEL[n.classification] ?? n.classification}</span></td>
                      <td><span style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>{formatDate(n.deleted_at)}</span></td>
                      <td>
                        <span style={{ fontSize: 13, color: n.daysLeft <= 5 ? 'var(--status-danger)' : 'var(--fg-subtle)' }}>
                          {n.daysLeft > 0 ? `in ${n.daysLeft} day${n.daysLeft === 1 ? '' : 's'}` : 'due for purge'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" disabled={busy === n.id} onClick={() => restoreNeed(n)}>
                            <RotateCcw size={13} /> Restore
                          </button>
                          {canPurge && (
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-danger)' }} disabled={busy === n.id} onClick={() => purgeNeed(n)}>
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
        )}
      </div>
    </div>
  );
}
