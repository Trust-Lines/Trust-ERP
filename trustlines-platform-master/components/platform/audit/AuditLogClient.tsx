'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Shield } from 'lucide-react';

export interface AuditEntry {
  id: string;
  project_id: string | null;
  actor_id: string | null;
  action: string;
  resource: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
  actorName: string;
  projectName: string | null;
  projectCode: string | null;
}

function actionStyle(action: string): { bg: string; color: string; label: string } {
  const a = action.toLowerCase();
  if (a.includes('creat') || a.includes('add') || a.includes('insert'))
    return { bg: '#dcfce7', color: '#16a34a', label: action };
  if (a.includes('delet') || a.includes('remov') || a.includes('trash'))
    return { bg: '#fee2e2', color: '#dc2626', label: action };
  if (a.includes('updat') || a.includes('edit') || a.includes('chang'))
    return { bg: '#dbeafe', color: '#2563eb', label: action };
  if (a.includes('approv') || a.includes('sign') || a.includes('complet'))
    return { bg: '#d1fae5', color: '#065f46', label: action };
  if (a.includes('reject') || a.includes('fail') || a.includes('error'))
    return { bg: '#fee2e2', color: '#dc2626', label: action };
  if (a.includes('stage') || a.includes('advanc'))
    return { bg: '#ede9fe', color: '#7c3aed', label: action };
  if (a.includes('login') || a.includes('auth') || a.includes('access'))
    return { bg: '#fef3c7', color: '#d97706', label: action };
  return { bg: '#f3f4f6', color: '#6b7280', label: action };
}

function fmtAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function DiffView({ old_value, new_value }: { old_value: unknown; new_value: unknown }) {
  if (!old_value && !new_value) return null;
  const format = (v: unknown) => {
    if (!v) return null;
    if (typeof v === 'object') return JSON.stringify(v, null, 2);
    return String(v);
  };
  const oldStr = format(old_value);
  const newStr = format(new_value);
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
      {oldStr && (
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', marginBottom: 3, textTransform: 'uppercase' }}>Before</div>
          <pre style={{
            margin: 0, padding: '8px 10px', borderRadius: 5,
            background: '#fff5f5', border: '1px solid #fecaca',
            fontSize: 11, color: '#7f1d1d', overflowX: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>{oldStr}</pre>
        </div>
      )}
      {newStr && (
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', marginBottom: 3, textTransform: 'uppercase' }}>After</div>
          <pre style={{
            margin: 0, padding: '8px 10px', borderRadius: 5,
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            fontSize: 11, color: '#14532d', overflowX: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>{newStr}</pre>
        </div>
      )}
    </div>
  );
}

function LogRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const { bg, color } = actionStyle(entry.action);
  const hasDiff = !!(entry.old_value || entry.new_value);

  return (
    <>
      <tr
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: expanded ? 'var(--bg-subtle)' : 'white',
          cursor: hasDiff ? 'pointer' : 'default',
        }}
        onClick={() => hasDiff && setExpanded(e => !e)}
      >
        <td style={{ padding: '10px 8px 10px 14px', width: 20 }}>
          {hasDiff && (
            expanded
              ? <ChevronDown size={13} color="var(--fg-faint)" />
              : <ChevronRight size={13} color="var(--fg-faint)" />
          )}
        </td>

        <td style={{ padding: '10px 12px' }}>
          <span style={{
            display: 'inline-block', padding: '3px 8px', borderRadius: 99,
            fontSize: 10, fontWeight: 700, background: bg, color,
            whiteSpace: 'nowrap',
          }}>
            {fmtAction(entry.action)}
          </span>
        </td>

        <td style={{ padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: 'var(--brand-teal)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700,
            }}>
              {entry.actorName === 'System'
                ? <Shield size={10} />
                : entry.actorName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: 'var(--fg-default)' }}>{entry.actorName}</span>
          </div>
        </td>

        <td style={{ padding: '10px 12px' }}>
          {entry.projectName ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-default)' }}>{entry.projectName}</div>
              <div style={{ fontSize: 10, color: 'var(--fg-faint)' }}>{entry.projectCode}</div>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--fg-faint)' }}>—</span>
          )}
        </td>

        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fg-subtle)' }}>
          {entry.resource ?? '—'}
        </td>

        <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--fg-faint)', whiteSpace: 'nowrap' }}>
          {fmtDate(entry.created_at)}
        </td>
      </tr>

      {expanded && hasDiff && (
        <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
          <td colSpan={6} style={{ padding: '0 14px 12px 44px' }}>
            <DiffView old_value={entry.old_value} new_value={entry.new_value} />
          </td>
        </tr>
      )}
    </>
  );
}

export function AuditLogClient({ logs }: { logs: AuditEntry[] }) {
  const [search, setSearch]           = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterActor, setFilterActor]   = useState('');

  const actions = useMemo(() =>
    [...new Set(logs.map(l => l.action))].sort(), [logs]);
  const actors = useMemo(() =>
    [...new Set(logs.map(l => l.actorName))].sort(), [logs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter(l => {
      if (filterAction && l.action !== filterAction) return false;
      if (filterActor  && l.actorName !== filterActor) return false;
      if (q && ![l.action, l.actorName, l.projectName, l.projectCode, l.resource]
        .some(v => v?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [logs, search, filterAction, filterActor]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Audit Log</h1>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-faint)' }}>
            All system activity from the last 30 days · {logs.length} entries
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-faint)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search actions, actors, projects…"
            className="form-input"
            style={{ paddingLeft: 30, fontSize: 13 }}
          />
        </div>

        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className="form-input form-select"
          style={{ fontSize: 13, flex: '0 0 180px' }}
        >
          <option value="">All actions</option>
          {actions.map(a => (
            <option key={a} value={a}>{fmtAction(a)}</option>
          ))}
        </select>

        <select
          value={filterActor}
          onChange={e => setFilterActor(e.target.value)}
          className="form-input form-select"
          style={{ fontSize: 13, flex: '0 0 160px' }}
        >
          <option value="">All users</option>
          {actors.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        {(search || filterAction || filterActor) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setSearch(''); setFilterAction(''); setFilterActor(''); }}
          >
            Clear
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-faint)', fontSize: 13 }}>
            No audit entries found.
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <th style={{ width: 20, padding: '8px 8px 8px 14px' }} />
                {['ACTION', 'USER', 'PROJECT', 'RESOURCE', 'DATE'].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px', textAlign: 'left',
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.07em', color: 'var(--fg-faint)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => (
                <LogRow key={entry.id} entry={entry} />
              ))}
            </tbody>
          </table>

          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--fg-faint)' }}>
            Showing {filtered.length} of {logs.length} entries (last 30 days)
          </div>
        </div>
      )}
    </div>
  );
}
