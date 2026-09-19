'use client';

import { useState } from 'react';
import { Check, MessageSquare, FolderOpen, PenTool, Flag, Circle } from 'lucide-react';
import { PROGRESS_STEPS, stageStep, type DealProgress, type TimelineEvent } from '@/lib/sales/dealProgress';
import type { OpportunityStage } from '@/types/database';

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
};

function ago(iso: string | null | undefined): string {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (Number.isNaN(days)) return '—';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

const ICON: Record<TimelineEvent['type'], typeof Flag> = {
  milestone: Flag, change: Circle, comment: MessageSquare, project: FolderOpen, design: PenTool,
};
const TONE: Record<TimelineEvent['type'], string> = {
  milestone: 'var(--brand-navy)', change: 'var(--fg-subtle)', comment: 'var(--brand-teal-600)', project: '#7c3aed', design: '#0891b2',
};

const SHOWN_AT_FIRST = 8;

export function DealProgressPanel({ stage, progress }: { stage: OpportunityStage; progress: DealProgress | null }) {
  const [all, setAll] = useState(false);
  if (!progress) {
    return <div style={{ fontSize: 13.5, color: 'var(--fg-faint)', padding: '6px 2px' }}>Progress isn&apos;t available for this deal right now.</div>;
  }

  const cur = stageStep(stage);
  const won = stage === 'closed_won', lost = stage === 'closed_lost';
  const events = all ? progress.events : progress.events.slice(0, SHOWN_AT_FIRST);
  const banner =
    cur === -2 ? { text: 'Waiting on the client — the ball is in their court.', bg: 'var(--status-warning-bg)', fg: 'var(--status-warning-fg)' }
    : cur === -1 ? { text: 'Still with Marketing — not handed off to Sales yet.', bg: 'var(--bg-sunken)', fg: 'var(--fg-muted)' }
    : null;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* ── where it is on the path ── */}
      <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {PROGRESS_STEPS.map((s, i) => {
            const isClosedStep = i === PROGRESS_STEPS.length - 1;
            const done = cur >= 0 && (i < cur || (isClosedStep && cur === i));
            const current = cur === i && !isClosedStep;
            const accent = isClosedStep && lost ? 'var(--status-danger)' : 'var(--brand-teal)';
            const label = isClosedStep ? (won ? 'Closed — won' : lost ? 'Closed — lost' : 'Closed') : s.label;
            return (
              <div key={s.key} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                {i > 0 && (
                  <div style={{ position: 'absolute', top: 10, right: '50%', width: '100%', height: 2, background: cur >= i || (isClosedStep && cur === i) ? accent : 'var(--border-default)' }} />
                )}
                <div style={{
                  position: 'relative', zIndex: 1, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? accent : current ? 'var(--bg-surface)' : 'var(--bg-surface)',
                  border: `2px solid ${done ? accent : current ? 'var(--brand-navy)' : 'var(--border-default)'}`,
                  boxShadow: current ? '0 0 0 4px color-mix(in srgb, var(--brand-navy) 14%, transparent)' : 'none',
                }}>
                  {done ? <Check size={12} strokeWidth={3} color="#fff" /> : current ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-navy)' }} /> : null}
                </div>
                <div style={{
                  marginTop: 7, fontSize: 11.5, lineHeight: 1.25, textAlign: 'center', padding: '0 4px',
                  fontWeight: current || (isClosedStep && cur === i) ? 800 : 600,
                  color: current || done ? 'var(--fg-default)' : 'var(--fg-faint)',
                }}>{label}</div>
              </div>
            );
          })}
        </div>
        {banner && (
          <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 600, padding: '8px 12px', borderRadius: 8, background: banner.bg, color: banner.fg }}>{banner.text}</div>
        )}
      </div>

      {/* ── project / design / last activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
        <Fact label="Project">
          {progress.project ? (
            <>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{progress.project.code}</span>
              <Sub>{progress.project.stageLabel ? `Now in ${progress.project.stageLabel}` : 'Opened'}{progress.project.createdAt ? ` · since ${fmtDate(progress.project.createdAt)}` : ''}</Sub>
            </>
          ) : (
            <>
              <span style={{ color: 'var(--fg-muted)', fontWeight: 600 }}>No project yet</span>
              <Sub>Opens when Sales accepts the deal or it reaches Working on it Trust.</Sub>
            </>
          )}
        </Fact>
        <Fact label="Design">
          {progress.designJob ? (
            <>
              <span style={{ fontWeight: 700 }}>{progress.designJob.statusLabel}</span>
              <Sub>{progress.designJob.designerName ? `${progress.designJob.designerName} · ` : ''}updated {ago(progress.designJob.updatedAt)}</Sub>
            </>
          ) : (
            <>
              <span style={{ color: 'var(--fg-muted)', fontWeight: 600 }}>No design job</span>
              <Sub>Nobody has started one for this deal.</Sub>
            </>
          )}
        </Fact>
        <Fact label="Last activity">
          <span style={{ fontWeight: 700 }}>{ago(progress.lastActivityAt)}</span>
          <Sub>{progress.lastActivityAt ? fmtDate(progress.lastActivityAt) : 'Nothing recorded yet'}</Sub>
        </Fact>
      </div>

      {/* ── what happened ── */}
      <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '14px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg-subtle)', marginBottom: 10 }}>
          What happened · newest first
        </div>
        {progress.events.length === 0 ? (
          <div style={{ fontSize: 13.5, color: 'var(--fg-faint)' }}>Nothing recorded yet.</div>
        ) : (
          <div style={{ display: 'grid' }}>
            {events.map((e, i) => {
              const Icon = ICON[e.type];
              return (
                <div key={`${e.at}-${i}`} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: i === events.length - 1 ? 0 : 14 }}>
                  {i < events.length - 1 && <div style={{ position: 'absolute', left: 10, top: 22, bottom: 0, width: 2, background: 'var(--border-subtle)' }} />}
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-surface)', border: `1.5px solid ${TONE[e.type]}`, color: TONE[e.type], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                    <Icon size={11} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                      <div style={{ fontSize: 13.5, fontWeight: e.type === 'comment' ? 600 : 700, color: 'var(--fg-default)' }}>
                        {e.text}{e.by && <span style={{ fontWeight: 500, color: 'var(--fg-subtle)' }}> · {e.by}</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--fg-faint)', whiteSpace: 'nowrap' }} title={new Date(e.at).toLocaleString('en-US')}>{fmtDate(e.at)}</div>
                    </div>
                    {e.detail && <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 2, lineHeight: 1.45 }}>{e.detail}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {progress.events.length > SHOWN_AT_FIRST && (
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setAll(a => !a)}>
            {all ? 'Show fewer' : `Show all ${progress.events.length}`}
          </button>
        )}
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '11px 14px', fontSize: 13.5, color: 'var(--fg-default)' }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--fg-faint)', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'grid', gap: 2 }}>{children}</div>
    </div>
  );
}
function Sub({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 12, color: 'var(--fg-subtle)', lineHeight: 1.4 }}>{children}</span>;
}
