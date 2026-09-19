'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { SalesDashboardData } from '@/lib/sales/dashboardData';
import type { ClosingRow, RegionRow, SilentDeal, StageBucket } from '@/lib/sales/dashboardMetrics';

// Sales dashboard, built around the questions a sales team actually asks:
//   what needs doing today · where do open deals sit · which ones have gone quiet · how is each
//   region doing · are we winning more or fewer than before.
// Palette: one blue hue for "ours / progress" (an ordinal ramp for the stage path, validated), warm gray
// for "lost / waiting" — colours were run through the dataviz validator. (The app has no dark theme, so
// there is only a light palette here; add a validated dark set together with a dark theme.)

function compactMoney(v: number): string {
  if (!v) return '$0';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
}
const n = (v: number) => v.toLocaleString('en-US');
const longDate = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const stageQuery = (status: string) => `/leads?stage=${status}`;

const CSS = `
.sd{
  --sd-accent:#2a78d6; --sd-lost:#6f6e69; --sd-wait:#b3b2ab;
  --sd-s1:#86b6ef; --sd-s2:#5598e7; --sd-s3:#2a78d6; --sd-s4:#1c5cab; --sd-s5:#104281;
  --sd-s1-ink:#0b0b0b; --sd-s2-ink:#0b0b0b; --sd-s3-ink:#fff; --sd-s4-ink:#fff; --sd-s5-ink:#fff;
  --sd-open:#b7d3f6;
  color:var(--fg-default);
}
.sd h2{margin:0}
.sd .sd-eyebrow{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-faint)}
.sd .sd-section{padding:28px 0;border-top:1px solid var(--border-subtle)}
.sd .sd-h{font-size:15px;font-weight:700;letter-spacing:-.005em}
.sd .sd-sub{font-size:13px;color:var(--fg-subtle);margin-top:3px;line-height:1.45}
.sd .sd-fact{display:block;text-decoration:none;color:inherit;padding:2px 0 2px 16px;border-left:2px solid var(--border-subtle);transition:border-color .12s}
.sd a.sd-fact:hover{border-left-color:var(--sd-accent)}
.sd .sd-fact b{display:block;font-size:30px;line-height:1.1;font-weight:700;letter-spacing:-.02em}
.sd .sd-fact span{font-size:12.5px;color:var(--fg-subtle)}
.sd table.sd-t{width:100%;border-collapse:collapse;font-size:13px}
.sd .sd-t th{text-align:left;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--fg-faint);padding:0 12px 8px 0;border-bottom:1px solid var(--border-subtle);white-space:nowrap}
.sd .sd-t td{padding:11px 12px 11px 0;border-bottom:1px solid var(--border-subtle);vertical-align:middle;font-variant-numeric:tabular-nums}
.sd .sd-t th.r,.sd .sd-t td.r{text-align:right}
.sd .sd-t tr.sd-row:hover td{background:var(--bg-subtle)}
.sd .sd-seg{display:block;height:100%;text-decoration:none;position:relative;transition:filter .12s, transform .12s}
.sd .sd-seg:hover,.sd .sd-seg:focus-visible{filter:brightness(1.08);outline:none}
.sd .sd-tab{font-size:12px;font-weight:600;padding:4px 10px;border-radius:6px;border:1px solid var(--border-default);background:transparent;color:var(--fg-muted);cursor:pointer}
.sd .sd-tab[aria-pressed="true"]{background:var(--fg-default);border-color:var(--fg-default);color:var(--bg-surface)}
.sd .sd-col:focus-visible rect.sd-hit{stroke:var(--sd-accent);stroke-width:1.5;fill:color-mix(in srgb,var(--sd-accent) 8%, transparent)}
.sd .sd-col:hover rect.sd-hit{fill:color-mix(in srgb,var(--sd-accent) 8%, transparent)}
`;

interface Tip { x: number; y: number; head: string; rows: { key: string; label: string; value: string }[]; foot?: string }

function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: Math.min(tip.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 250), top: tip.y + 14, zIndex: 10070,
        pointerEvents: 'none', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,.16)', padding: '9px 12px', minWidth: 170, fontSize: 12.5,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{tip.head}</div>
      {tip.rows.map(r => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <span style={{ width: 12, height: 3, borderRadius: 2, background: r.key, flexShrink: 0 }} />
          <span style={{ fontWeight: 700 }}>{r.value}</span>
          <span style={{ color: 'var(--fg-subtle)' }}>{r.label}</span>
        </div>
      ))}
      {tip.foot && <div style={{ marginTop: 6, color: 'var(--fg-subtle)', fontSize: 12 }}>{tip.foot}</div>}
    </div>
  );
}

// ── pipeline: one bar, proportional to how many open deals sit at each step ───────────────────────
function PipelineBar({ path, waiting }: { path: StageBucket[]; waiting: { count: number; value: number } }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const steps = path.filter(s => s.count > 0);
  const total = steps.reduce((a, s) => a + s.count, 0) + waiting.count;
  if (total === 0) return <div className="sd-sub">No open deals right now.</div>;
  const ramp = ['s1', 's2', 's3', 's4', 's5'];
  const idx = (key: string) => path.findIndex(p => p.key === key);
  const pct = (c: number) => (c / total) * 100;

  const show = (e: React.PointerEvent | React.FocusEvent, label: string, key: string, count: number, value: number) => {
    const r = 'clientX' in e ? { x: e.clientX, y: e.clientY } : (() => { const b = (e.currentTarget as HTMLElement).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.bottom }; })();
    setTip({ ...r, head: label, rows: [{ key, label: count === 1 ? 'deal' : 'deals', value: n(count) }], foot: value ? `${compactMoney(value)} with a deal size` : undefined });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, height: 34, borderRadius: 6, overflow: 'hidden' }} onPointerLeave={() => setTip(null)}>
        {steps.map(s => {
          const i = idx(s.key);
          return (
            <Link
              key={s.key} href={stageQuery(s.crmStatus)} className="sd-seg" aria-label={`${s.label}: ${s.count} deals`}
              style={{ width: `${pct(s.count)}%`, background: `var(--sd-${ramp[i]})`, color: `var(--sd-${ramp[i]}-ink)` }}
              onPointerMove={e => show(e, s.label, `var(--sd-${ramp[i]})`, s.count, s.value)}
              onFocus={e => show(e, s.label, `var(--sd-${ramp[i]})`, s.count, s.value)} onBlur={() => setTip(null)}
            >
              {pct(s.count) >= 6 && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: 10, fontSize: 13, fontWeight: 700 }}>{s.count}</span>}
            </Link>
          );
        })}
        {waiting.count > 0 && (
          <Link
            href={stageQuery('waiting')} className="sd-seg" aria-label={`Waiting on the client: ${waiting.count} deals`}
            style={{ width: `${pct(waiting.count)}%`, background: 'var(--sd-wait)', color: '#0b0b0b', marginLeft: 6 }}
            onPointerMove={e => show(e, 'Waiting on the client', 'var(--sd-wait)', waiting.count, waiting.value)}
            onFocus={e => show(e, 'Waiting on the client', 'var(--sd-wait)', waiting.count, waiting.value)} onBlur={() => setTip(null)}
          >
            {pct(waiting.count) >= 6 && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: 10, fontSize: 13, fontWeight: 700 }}>{waiting.count}</span>}
          </Link>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 28px', marginTop: 14 }}>
        {steps.map(s => (
          <Link key={s.key} href={stageQuery(s.crmStatus)} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ width: 12, height: 3, borderRadius: 2, background: `var(--sd-${ramp[idx(s.key)]})`, alignSelf: 'center' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</span>
            <span style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>{s.count}{s.value ? ` · ${compactMoney(s.value)}` : ''}</span>
          </Link>
        ))}
        {waiting.count > 0 && (
          <Link href={stageQuery('waiting')} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ width: 12, height: 3, borderRadius: 2, background: 'var(--sd-wait)', alignSelf: 'center' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Waiting on the client</span>
            <span style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>{waiting.count}{waiting.value ? ` · ${compactMoney(waiting.value)}` : ''}</span>
          </Link>
        )}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

// ── deals that have gone quiet ────────────────────────────────────────────────────────────────────
function quietFor(days: number): string {
  if (days < 30) return `${days} d`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  const y = days / 365;
  return `${y.toFixed(y >= 2 ? 0 : 1).replace(/\.0$/, '')} yr`;
}

function SilentTable({ rows }: { rows: SilentDeal[] }) {
  const max = Math.max(1, ...rows.map(r => r.daysSilent));
  if (!rows.length) return <div className="sd-sub">Every active deal has had an update recently.</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="sd-t">
        <thead>
          <tr><th>Deal</th><th>Stage</th><th style={{ minWidth: 150 }}>Quiet for</th><th>Last update</th><th className="r">Deal size</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="sd-row">
              <td style={{ maxWidth: 320 }}>
                <Link href={`/leads?open=${r.id}`} style={{ color: 'var(--fg-default)', fontWeight: 600, textDecoration: 'none' }}>{r.title}</Link>
              </td>
              <td style={{ whiteSpace: 'nowrap', color: 'var(--fg-muted)' }}>{r.stageLabel}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 44, fontWeight: 700 }}>{quietFor(r.daysSilent)}</span>
                  <span style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-sunken)', maxWidth: 110 }}>
                    <span style={{ display: 'block', height: '100%', width: `${(r.daysSilent / max) * 100}%`, borderRadius: 2, background: 'var(--sd-accent)' }} />
                  </span>
                </div>
              </td>
              <td style={{ color: 'var(--fg-subtle)', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.lastSnippet ? <><span style={{ color: 'var(--fg-muted)', fontWeight: 600 }}>{r.lastBy ? `${r.lastBy}: ` : ''}</span>{r.lastSnippet}</> : 'Nothing since it was created'}
              </td>
              <td className="r" style={{ whiteSpace: 'nowrap' }}>{r.dealSize ? compactMoney(r.dealSize) : <span style={{ color: 'var(--fg-faint)' }}>—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── regions ───────────────────────────────────────────────────────────────────────────────────────
function RegionTable({ rows }: { rows: RegionRow[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="sd-t">
        <thead>
          <tr><th>Region</th><th className="r">Open</th><th className="r">Proposals out</th><th className="r">Waiting</th><th className="r">Won</th><th className="r">Lost</th><th style={{ minWidth: 130 }}>Win rate</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.region} className="sd-row">
              <td style={{ fontWeight: 600 }}>{r.label}</td>
              <td className="r">{n(r.open)}</td>
              <td className="r">{n(r.proposals)}</td>
              <td className="r" style={{ color: 'var(--fg-subtle)' }}>{n(r.waiting)}</td>
              <td className="r">{n(r.won)}</td>
              <td className="r" style={{ color: 'var(--fg-subtle)' }}>{n(r.lost)}</td>
              <td>
                {r.winRatePct == null ? <span style={{ color: 'var(--fg-faint)' }}>—</span> : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 36, fontWeight: 700 }}>{r.winRatePct}%</span>
                    <span style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-sunken)', maxWidth: 90 }}>
                      <span style={{ display: 'block', height: '100%', width: `${r.winRatePct}%`, borderRadius: 2, background: 'var(--sd-accent)' }} />
                    </span>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── won vs lost, by the quarter a deal closed ─────────────────────────────────────────────────────
function niceMax(v: number): { max: number; step: number } {
  const steps = [5, 10, 20, 25, 50, 100, 200];
  const step = steps.find(s => v / s <= 5) ?? 500;
  return { max: Math.max(step, Math.ceil(v / step) * step), step };
}
function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

function ClosingsChart({ rows, undated }: { rows: ClosingRow[]; undated: number }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [tip, setTip] = useState<Tip | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const W = 640, H = 250, L = 34, B = 26, T = 14, R = 8;
  const plotW = W - L - R, plotH = H - T - B;
  const peak = Math.max(1, ...rows.map(r => r.total));
  const { max, step } = niceMax(peak);
  const ticks = useMemo(() => Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step), [max, step]);
  const slot = rows.length ? plotW / rows.length : plotW;
  const bw = Math.min(24, slot * 0.62);
  const y = (v: number) => T + plotH - (v / max) * plotH;
  const labelEvery = rows.length > 14 ? 2 : 1;
  const peakKey = rows.reduce((b, r) => (r.total > (b?.total ?? -1) ? r : b), null as ClosingRow | null)?.key;
  const lastKey = rows.at(-1)?.key;

  const showTip = (e: React.PointerEvent | React.FocusEvent<SVGGElement>, r: ClosingRow) => {
    const pos = 'clientX' in e ? { x: e.clientX, y: e.clientY } : (() => { const b = (e.currentTarget as SVGGElement).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top }; })();
    setTip({
      ...pos, head: r.label,
      rows: [{ key: 'var(--sd-accent)', label: 'won', value: n(r.won) }, { key: 'var(--sd-lost)', label: 'lost', value: n(r.lost) }],
      foot: r.winRatePct == null ? 'Nothing closed' : `${r.winRatePct}% of what closed was won`,
    });
  };

  if (!rows.length) return <div className="sd-sub">No closed deals with a recorded close date yet.</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 16, fontSize: 12.5, color: 'var(--fg-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--sd-accent)' }} />Won</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--sd-lost)' }} />Lost</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="sd-tab" aria-pressed={view === 'chart'} onClick={() => setView('chart')}>Chart</button>
          <button className="sd-tab" aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
        </div>
      </div>

      {view === 'chart' ? (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Deals won and lost per quarter, stacked" onPointerLeave={() => setTip(null)} style={{ display: 'block', overflow: 'visible' }}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border-subtle)" strokeWidth={1} />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--fg-faint)" style={{ fontVariantNumeric: 'tabular-nums' }}>{t}</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const cx = L + slot * i + slot / 2, x0 = cx - bw / 2;
            const hWon = (r.won / max) * plotH, hLost = (r.lost / max) * plotH;
            const gap = r.won > 0 && r.lost > 0 ? 2 : 0;
            const yWon = y(0) - hWon, yLost = yWon - gap - hLost;
            const isLabelled = r.key === peakKey || r.key === lastKey;
            return (
              <g
                key={r.key} className="sd-col" tabIndex={0}
                aria-label={`${r.label}: ${r.won} won, ${r.lost} lost${r.winRatePct == null ? '' : `, ${r.winRatePct}% win rate`}`}
                onPointerMove={e => showTip(e, r)} onFocus={e => { setFocused(r.key); showTip(e, r); }} onBlur={() => { setFocused(null); setTip(null); }}
                style={{ outline: 'none' }}
              >
                <rect className="sd-hit" x={L + slot * i} y={T} width={slot} height={plotH} fill="transparent" rx={4} />
                {r.won > 0 && <path d={r.lost > 0 ? `M${x0},${yWon + hWon} L${x0},${yWon} L${x0 + bw},${yWon} L${x0 + bw},${yWon + hWon} Z` : roundedTop(x0, yWon, bw, hWon, 4)} fill="var(--sd-accent)" />}
                {r.lost > 0 && <path d={roundedTop(x0, yLost, bw, hLost, 4)} fill="var(--sd-lost)" />}
                {isLabelled && r.total > 0 && (
                  <text x={cx} y={yLost - 6} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="var(--fg-default)">{r.total}</text>
                )}
                {(i % labelEvery === 0 || focused === r.key) && (
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--fg-subtle)">{r.label}</text>
                )}
              </g>
            );
          })}
        </svg>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: 290, overflowY: 'auto' }}>
          <table className="sd-t">
            <thead><tr><th>Quarter</th><th className="r">Won</th><th className="r">Lost</th><th className="r">Closed</th><th className="r">Win rate</th></tr></thead>
            <tbody>
              {[...rows].reverse().map(r => (
                <tr key={r.key} className="sd-row">
                  <td style={{ fontWeight: 600 }}>{r.label}</td><td className="r">{n(r.won)}</td><td className="r">{n(r.lost)}</td>
                  <td className="r">{n(r.total)}</td><td className="r">{r.winRatePct == null ? '—' : `${r.winRatePct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {undated > 0 && (
        <div className="sd-sub" style={{ marginTop: 10 }}>{n(undated)} closed deals have no recorded close date, so they aren&apos;t in this chart.</div>
      )}
      <Tooltip tip={tip} />
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────────────────────────
export function SalesDesk({ data }: { data: SalesDashboardData }) {
  const { tasks, outcomes } = data;
  const proposalsOut = data.path.filter(p => p.key === 'proposal' || p.key === 'changes').reduce((a, p) => a + p.count, 0);
  const decided = outcomes.won + outcomes.lost;

  // Only say things that are true right now.
  const notes: string[] = [];
  if (tasks.unassigned > 0 && tasks.unassigned === tasks.open) notes.push(`None of the ${n(tasks.open)} open tasks has an owner yet — assign them from Tasks.`);
  else if (tasks.unassigned > 0) notes.push(`${n(tasks.unassigned)} open tasks have no owner yet.`);
  if (data.activeDeals > 0 && data.silentOver30 > 0) notes.push(`${n(data.silentOver30)} of ${n(data.activeDeals)} deals that should be moving haven’t had an update in over 30 days.`);

  return (
    <div className="sd" style={{ maxWidth: 1480, margin: '0 auto' }}>
      <style>{CSS}</style>

      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingBottom: 26 }}>
        <div>
          <div className="sd-eyebrow">Sales · {longDate()}</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Sales desk</h1>
        </div>
        <Link href="/leads" style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-accent)', textDecoration: 'none' }}>Open the CRM →</Link>
      </header>

      {/* ── now ── */}
      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.1fr) minmax(300px, 1.6fr)', gap: 40, alignItems: 'start', paddingBottom: 28 }}>
        <div>
          <div className="sd-eyebrow">Open deals</div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', margin: '8px 0 10px' }}>{n(data.openDeals)}</div>
          <div style={{ fontSize: 14, color: 'var(--fg-muted)', lineHeight: 1.55 }}>
            {data.openValue > 0 ? <><b style={{ color: 'var(--fg-default)' }}>{compactMoney(data.openValue)}</b> with a deal size · </> : null}
            {n(data.waiting.count)} waiting on the client · {n(data.potentials)} potentials still to qualify
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 22 }}>
          <Link href="/sales-tasks" className="sd-fact"><b>{n(tasks.dueToday)}</b><span>tasks due today</span></Link>
          <Link href="/sales-tasks" className="sd-fact"><b style={{ color: tasks.overdue > 0 ? 'var(--status-danger)' : undefined }}>{n(tasks.overdue)}</b><span>overdue</span></Link>
          <Link href={stageQuery('design_proposal_sent')} className="sd-fact"><b>{n(proposalsOut)}</b><span>proposals waiting for an answer</span></Link>
          <Link href="/sales-tasks" className="sd-fact"><b>{n(tasks.unassigned)}</b><span>tasks nobody owns yet</span></Link>
        </div>
      </section>
      {notes.length > 0 && (
        <div style={{ display: 'grid', gap: 6, padding: '0 0 24px' }}>
          {notes.map(t => (
            <div key={t} style={{ fontSize: 13.5, color: 'var(--fg-muted)', display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sd-accent)', flexShrink: 0, transform: 'translateY(-2px)' }} />{t}
            </div>
          ))}
        </div>
      )}

      {/* ── pipeline ── */}
      <section className="sd-section">
        <h2 className="sd-h">Where the open deals sit</h2>
        <div className="sd-sub" style={{ marginBottom: 16 }}>Every open deal, by step. Click a step to see those deals in the CRM.</div>
        <PipelineBar path={data.path} waiting={data.waiting} />
      </section>

      {/* ── gone quiet ── */}
      <section className="sd-section">
        <h2 className="sd-h">Deals that have gone quiet</h2>
        <div className="sd-sub" style={{ marginBottom: 14 }}>
          Deals in Ready to start, Working on it Trust, Proposal sent or Changes requested, longest without an update first. Waiting deals aren’t listed — they’re meant to sit.
        </div>
        <SilentTable rows={data.silent} />
      </section>

      {/* ── regions + closings ── */}
      <section className="sd-section" style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1fr)', gap: 48, alignItems: 'start' }}>
        <div>
          <h2 className="sd-h">Region by region</h2>
          <div className="sd-sub" style={{ marginBottom: 14 }}>Win rate is won ÷ (won + lost).</div>
          <RegionTable rows={data.regions} />
        </div>
        <div>
          <h2 className="sd-h">Won and lost, by quarter closed</h2>
          <div className="sd-sub" style={{ marginBottom: 14 }}>
            {decided > 0 ? <>Overall <b style={{ color: 'var(--fg-default)' }}>{outcomes.winRatePct}%</b> won — {n(outcomes.won)} of {n(decided)} deals that closed.</> : 'Nothing has closed yet.'}
          </div>
          <ClosingsChart rows={data.closings} undated={data.closingsUndated} />
        </div>
      </section>
    </div>
  );
}
