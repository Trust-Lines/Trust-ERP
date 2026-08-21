'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ClipboardCheck, AlertTriangle, RotateCcw, CheckCircle2, Inbox } from 'lucide-react';
import { Avatar } from '@/components/platform/shared/Avatar';
import type { QcQueue, QcRow } from '@/lib/qc/queue';

interface Props {
  queue: QcQueue;
  names: Record<string, string>;
  projects: Record<string, { code: string; name: string }>;
  canInspect: boolean;
  migrationReady: boolean;
}

type SectionKey = keyof QcQueue;

const SECTIONS: { key: SectionKey; label: string; icon: typeof Inbox; hint: string }[] = [
  { key: 'readyForQc',     label: 'Ready for QC',   icon: Inbox,         hint: 'Arrived from the vendor, waiting to be inspected' },
  { key: 'myInspections',  label: 'My inspections', icon: ClipboardCheck, hint: 'Open inspections you are conducting' },
  { key: 'failed',         label: 'Failed',         icon: AlertTriangle, hint: 'Latest verdict is a fail' },
  { key: 'rework',         label: 'Rework',         icon: RotateCcw,     hint: 'Failed and waiting for a re-inspection' },
  { key: 'completed',      label: 'Completed',      icon: CheckCircle2,  hint: 'Passed inspection' },
];

export function QcWorkspaceClient({ queue, names, projects, canInspect, migrationReady }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<SectionKey>('readyForQc');
  const [busy, setBusy] = useState<string | null>(null);

  async function call(url: string, method: string, body: unknown, ok: string) {
    setBusy(JSON.stringify(body));
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) {
      const e = await res.json().catch(() => ({})) as { error?: string };
      toast.error(e.error ?? 'Failed');
      return false;
    }
    toast.success(ok);
    router.refresh();
    return true;
  }

  const rows = queue[tab];

  return (
    <div className="main-inner">
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Quality Control</h1>
        <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
          Inspections are per type — each type is passed or failed on its own.
        </p>
      </div>

      {!migrationReady && (
        <div className="card" style={{ padding: 12, marginBottom: 16, borderColor: 'var(--status-warning-fg)', fontSize: 13 }}>
          Migration <code>068_qc_workspace.sql</code> has not been applied yet, so inspections cannot be
          recorded. The queue below stays empty until it lands.
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {SECTIONS.map(s => {
          const n = queue[s.key].length;
          const active = tab === s.key;
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              type="button"
              title={s.hint}
              onClick={() => setTab(s.key)}
              aria-pressed={active}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '7px 12px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                font: 'inherit', fontSize: 12.5, fontWeight: active ? 600 : 500,
                border: `1px solid ${active ? 'var(--brand-navy)' : 'var(--border-default)'}`,
                background: active ? 'var(--brand-navy)' : 'var(--bg-surface)',
                color: active ? 'white' : 'var(--fg-muted)',
              }}
            >
              <Icon size={14} />
              {s.label}
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--radius-pill)',
                background: active ? 'rgba(255,255,255,0.2)' : 'var(--bg-sunken)',
                color: active ? 'white' : 'var(--fg-subtle)',
              }}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="card">
        <div className="card-head">
          <span style={{ fontSize: 13, fontWeight: 600 }}>{SECTIONS.find(s => s.key === tab)!.label}</span>
          <span style={{ fontSize: 11.5, color: 'var(--fg-faint)' }}>{SECTIONS.find(s => s.key === tab)!.hint}</span>
        </div>

        {rows.length === 0 ? (
          <div className="card-body">
            <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
              {tab === 'readyForQc' ? 'Nothing is waiting for inspection.'
                : tab === 'myInspections' ? 'You have no open inspections.'
                : tab === 'failed' ? 'No failed inspections.'
                : tab === 'rework' ? 'Nothing is waiting for rework.'
                : 'No completed inspections yet.'}
            </p>
          </div>
        ) : (
          <div className="card-body flush">
            {rows.map((r, i) => (
              <QcRowView
                key={r.itemId + (r.inspectionId ?? '')}
                row={r}
                first={i === 0}
                names={names}
                project={projects[r.projectId]}
                canInspect={canInspect}
                busy={busy}
                onOpen={() => call('/api/qc/inspections', 'POST',
                  { production_item_id: r.itemId }, 'Inspection opened')}
                onRework={() => call('/api/qc/inspections', 'POST',
                  { production_item_id: r.itemId, rework_of_id: r.latestInspectionId }, 'Rework opened')}
                onDecide={(result) => call('/api/qc/inspections', 'PATCH',
                  { id: r.inspectionId, result }, result === 'pass' ? 'Passed' : 'Failed — rework needed')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QcRowView({
  row, first, names, project, canInspect, busy, onOpen, onRework, onDecide,
}: {
  row: QcRow;
  first: boolean;
  names: Record<string, string>;
  project?: { code: string; name: string };
  canInspect: boolean;
  busy: string | null;
  onOpen: () => void;
  onRework: () => void;
  onDecide: (r: 'pass' | 'fail') => void;
}) {
  const who = row.conductedBy ? names[row.conductedBy] : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px',
      borderTop: first ? undefined : '1px solid var(--border-subtle)',
    }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, minWidth: 84 }}>{row.type ?? '—'}</span>

      <Link href={`/projects/${row.projectId}`} style={{ fontSize: 12.5, color: 'var(--fg-muted)', textDecoration: 'none', flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 500 }}>{project?.code ?? '—'}</span>
        {project?.name && (
          <span style={{ color: 'var(--fg-faint)', marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name}
          </span>
        )}
      </Link>

      {row.isRework && (
        <span className="pill" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-fg)' }}>
          Rework
        </span>
      )}

      {who && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-subtle)' }}>
          <Avatar name={who} size="sm" /> {who}
        </span>
      )}

      {row.result && row.result !== 'pending' && (
        <span className="pill" style={{
          background: row.result === 'pass' ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
          color: row.result === 'pass' ? 'var(--status-success-fg)' : 'var(--status-danger-fg)',
        }}>
          {row.result === 'pass' ? 'Passed' : 'Failed'}
        </span>
      )}

      {canInspect && (
        <span style={{ display: 'inline-flex', gap: 6 }}>
          {!row.inspectionId && !row.result && (
            <button className="btn btn-secondary btn-sm" onClick={onOpen} disabled={!!busy}>Start inspection</button>
          )}
          {row.inspectionId && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => onDecide('pass')} disabled={!!busy}>Pass</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-danger)', borderColor: 'var(--status-danger)' }}
                onClick={() => onDecide('fail')} disabled={!!busy}>Fail</button>
            </>
          )}
          {row.result === 'fail' && !row.inspectionId && (
            <button className="btn btn-secondary btn-sm" onClick={onRework} disabled={!!busy}>Re-inspect</button>
          )}
        </span>
      )}
    </div>
  );
}
