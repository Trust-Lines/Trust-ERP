'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { StageBadge } from '@/components/platform/shared/StageBadge';
import type { ProjectStage } from '@/types/database';

interface TrashedProject {
  id: string;
  code: string;
  name: string;
  current_stage: string;
  categories: string[];
  deleted_at: string;
  deal_value: number | null;
  currency: string;
}

interface ConflictState {
  projectId: string;
  projectName: string;
  existingName: string;
  code: string;
}

function daysLeft(deletedAt: string): number {
  const deleted = new Date(deletedAt).getTime();
  return Math.max(0, 30 - Math.floor((Date.now() - deleted) / 86400000));
}

export function TrashClient({ projects }: { projects: TrashedProject[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId]   = useState<string | null>(null);
  const [conflict, setConflict]     = useState<ConflictState | null>(null);

  async function restore(id: string, name: string) {
    setLoadingId(id);
    try {
      const res  = await fetch(`/api/projects/${id}/restore`, { method: 'POST' });
      const json = await res.json() as { success?: boolean; conflict?: boolean; existingName?: string; code?: string; error?: string };

      if (res.status === 409 && json.conflict) {
        setConflict({ projectId: id, projectName: name, existingName: json.existingName!, code: json.code! });
        return;
      }
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      toast.success('Project restored');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to restore');
    } finally { setLoadingId(null); }
  }

  async function permanentDelete(id: string, name: string) {
    if (!window.confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
    setLoadingId(id);
    try {
      const res  = await fetch(`/api/projects/${id}/permanent-delete`, { method: 'DELETE' });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      toast.success('Project permanently deleted');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally { setLoadingId(null); }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Trash2 size={20} color="var(--fg-muted)" />
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--fg-default)' }}>Trash</h1>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-faint)', marginTop: 2 }}>
            Deleted projects stay here for 30 days, then are removed automatically.
          </p>
        </div>
      </div>

      {conflict && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'white', borderRadius: 10, padding: 28,
            maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <AlertTriangle size={20} color="#d97706" />
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-default)' }}>Code conflict</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: '0 0 8px' }}>
              An active project already uses code <strong>{conflict.code}</strong>:
            </p>
            <div style={{
              background: '#fef3c7', border: '1px solid #fde68a',
              borderRadius: 6, padding: '10px 14px', marginBottom: 18,
              fontSize: 13, fontWeight: 600, color: '#92400e',
            }}>
              {conflict.existingName}
            </div>
            <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: '0 0 18px' }}>
              You can permanently delete the trashed version, or go update the active project's code first.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setConflict(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  await permanentDelete(conflict.projectId, conflict.projectName);
                  setConflict(null);
                }}
                style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', fontWeight: 600, fontSize: 12, padding: '5px 12px', borderRadius: 6, cursor: 'pointer' }}
              >
                Delete trashed version forever
              </button>
            </div>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Trash2 size={32} color="var(--fg-faint)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: 'var(--fg-subtle)', fontWeight: 500 }}>Trash is empty</div>
          <div style={{ fontSize: 12, color: 'var(--fg-faint)', marginTop: 4 }}>Deleted projects will appear here.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['PROJECT', 'STAGE', 'CATEGORIES', 'DELETED', 'EXPIRES IN', ''].map(h => (
                  <th key={h} style={{
                    padding: '9px 14px', textAlign: 'left',
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: 'var(--fg-faint)',
                    background: 'var(--bg-subtle)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map(p => {
                const days      = daysLeft(p.deleted_at);
                const isLoading = loadingId === p.id;
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg-default)' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>{p.code}</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <StageBadge stage={p.current_stage as ProjectStage} />
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--fg-subtle)' }}>
                      {(p.categories ?? []).join(', ') || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--fg-subtle)' }}>
                      {new Date(p.deleted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 600,
                        color: days <= 3 ? '#dc2626' : days <= 7 ? '#d97706' : 'var(--fg-subtle)',
                      }}>
                        {days <= 3 && <AlertTriangle size={11} />}
                        {days}d left
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => restore(p.id, p.name)}
                          disabled={isLoading}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                            cursor: isLoading ? 'wait' : 'pointer',
                            background: 'var(--brand-teal-100)', color: 'var(--brand-teal-600)',
                            border: '1px solid #9ecfcf',
                          }}
                        >
                          {isLoading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <RotateCcw size={11} />}
                          Restore
                        </button>

                        <button
                          onClick={() => permanentDelete(p.id, p.name)}
                          disabled={isLoading}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                            cursor: isLoading ? 'wait' : 'pointer',
                            background: '#fee2e2', color: '#dc2626',
                            border: '1px solid #fca5a5',
                          }}
                        >
                          <Trash2 size={11} />
                          Delete forever
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
