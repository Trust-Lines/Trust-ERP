'use client';

import { useState } from 'react';
import type { AuditRow } from './ProjectDetailClient';

interface Props {
  events: AuditRow[];
  userRole: string;
  userId: string;
}

interface ActionCfg { icon: string; color: string; bg: string; label: (n: unknown, o: unknown) => string }

const ACTION_MAP: Record<string, ActionCfg> = {
  'document.approved':  { icon: '✓', color: '#0E6B30', bg: '#E7F6EC', label: (n) => `approved ${_str(n, 'doc_type', 'document')} v${_str(n, 'version', '')}` },
  'stage.advanced':     { icon: '→', color: '#0E6B30', bg: '#E7F6EC', label: (n, o) => `advanced stage from ${_str(o, 'stage', '?').replace(/_/g,' ')} to ${_str(n, 'stage', '?').replace(/_/g,' ')}` },
  'document.uploaded':  { icon: '↑', color: '#1740B0', bg: '#E2EBFC', label: (n) => `uploaded ${_str(n, 'fileName', _str(n, 'doc_type', 'document'))}` },
  'document.created':   { icon: '↑', color: '#1740B0', bg: '#E2EBFC', label: (n) => `created ${_str(n, 'doc_type', 'document')}` },
  'qc.failed':          { icon: '✕', color: '#991B1B', bg: '#FCE5E5', label: () => 'QC failed' },
  'document.rejected':  { icon: '✕', color: '#991B1B', bg: '#FCE5E5', label: () => 'rejected document' },
  'stage.overdue':      { icon: '⚠', color: '#92500A', bg: '#FDF1DD', label: () => 'stage marked overdue' },
  'gate.blocked':       { icon: '⚠', color: '#92500A', bg: '#FDF1DD', label: (n) => `gate blocked: ${_str(n, 'reason', '')}` },
  'project.created':    { icon: '✦', color: '#1F5A5A', bg: '#DDECEC', label: (n) => `created project ${_str(n, 'code', '')}` },
  'stage.overridden':   { icon: '⚡', color: '#92500A', bg: '#FDF1DD', label: (n) => `overrode stage gate — reason: ${_str(n, 'reason', '')}` },
};

function _str(val: unknown, key: string, fallback: string): string {
  if (val && typeof val === 'object' && key in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>)[key]);
  }
  return fallback;
}

function getCfg(action: string): ActionCfg {
  return ACTION_MAP[action] ?? {
    icon: '·',
    color: 'var(--fg-subtle)',
    bg: 'var(--bg-sunken)',
    label: () => action.replace(/\./g, ' '),
  };
}

function relativeTime(d: string): string {
  const diff  = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30)  return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AuditTrail({ events, userRole, userId }: Props) {
  const [showAll, setShowAll] = useState(false);
  const PAGE = 10;

  const isTlinesPm = userRole === 'tlines_pm';
  const filtered = isTlinesPm
    ? events
    : events;

  const visible = showAll ? filtered : filtered.slice(0, PAGE);

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="card-head">
        <div>
          <div className="text-eyebrow">Last 30 days</div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Activity</h3>
        </div>
      </div>

      {isTlinesPm && (
        <div style={{ padding: '8px 18px', fontSize: 12, color: 'var(--fg-subtle)', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
          Showing your activity only.
        </div>
      )}

      <div style={{ padding: '4px 0' }}>
        {visible.length === 0 ? (
          <div style={{ padding: '28px 18px', textAlign: 'center', fontSize: 13, color: 'var(--fg-faint)' }}>
            No activity yet
          </div>
        ) : (
          visible.map(ev => {
            const cfg   = getCfg(ev.action);
            const label = cfg.label(ev.new_value, ev.old_value);
            const actor = ev.actor?.full_name ?? 'System';

            return (
              <div
                key={ev.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '9px 18px',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: cfg.bg, color: cfg.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, marginTop: 1,
                }}>
                  {cfg.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--fg-default)', lineHeight: 1.4 }}>
                    <strong style={{ fontWeight: 600 }}>{actor}</strong>{' '}{label}
                  </div>
                </div>

                <span suppressHydrationWarning style={{ fontSize: 11, color: 'var(--fg-faint)', flexShrink: 0, whiteSpace: 'nowrap', marginTop: 1 }}>
                  {relativeTime(ev.created_at)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {filtered.length > PAGE && (
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--brand-teal)', padding: 0 }}
            onClick={() => setShowAll(s => !s)}
          >
            {showAll ? 'Show less' : `Load more (${filtered.length - PAGE} more)`}
          </button>
        </div>
      )}
    </div>
  );
}
