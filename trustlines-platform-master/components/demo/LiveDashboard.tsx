'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Briefcase, DollarSign, CheckCircle2, XCircle, Target, Boxes, Factory,
  TrendingUp, TrendingDown, Handshake, Wallet, AlertTriangle, Grid3x3,
} from 'lucide-react';
import {
  REGIONS4, REGION4_LABEL, SERVICES, SERVICE_LABEL, PIPELINE,
  scopeTotals, serviceAcrossRegions, servicesInRegion, monthlySeries, weakest,
  fmtM, fmtPct, fmtSignedPct,
  type Region4, type ServiceLine, type Scope, type Cell,
} from '@/lib/demo/execData';
import { MASCOT_CONFIG } from './mascotConfig';
import { HeaderMark } from './HeaderMark';
import { useLiveTick, liveJitter, jitterPct } from '@/lib/demo/liveJitter';

const MascotViewer = dynamic(() => import('./MascotViewer'), { ssr: false });

const T = {
  bg: '#F3EEF2', panel: '#FBF9FB', panelHi: '#F6F1F5', border: '#E4D9E2', borderStrong: '#D6C8D4',
  text: '#241823', muted: '#5E4E5B', faint: '#8C7D89', track: '#E9DFE7',
  green: '#3E7D5A', red: '#A9463A', amber: '#B87C2A', amberSoft: '#F4E9D6',
};
const SERVICE_ACCENT: Record<ServiceLine, string> = {
  STORE_MAKER: '#2E6B46', DESIGN_BUILD: '#33607E', PREMIUM_STORE_FITOUT: '#5A2F55',
};
const panelSx: React.CSSProperties = { background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: '0 1px 2px rgba(40,20,38,.04)' };
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.faint };

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  if (!now) return null;
  return (
    <div style={{ textAlign: 'right', fontSize: 12.5, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>
      {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      <span style={{ color: T.faint, margin: '0 6px' }}>·</span>
      {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
    </div>
  );
}

function Delta({ v }: { v: number }) {
  const up = v >= 0; const Icon = up ? TrendingUp : TrendingDown;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 700, color: up ? T.green : T.red }}><Icon size={12} /> {fmtSignedPct(v)}</span>;
}

function FocusFlag({ label }: { label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: T.amber, background: T.amberSoft, padding: '3px 8px', borderRadius: 999 }}>
      <AlertTriangle size={11} /> Focus: {label}
    </span>
  );
}

function Kpi({ label, value, sub, icon, accent }: { label: string; value: string; sub?: React.ReactNode; icon: React.ReactNode; accent: string }) {
  return (
    <div style={{ ...panelSx, background: T.panelHi, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={eyebrow}>{label}</span><span style={{ color: accent, opacity: 0.9 }}>{icon}</span>
      </div>
      <span style={{ fontSize: 22, fontWeight: 800, color: T.text, lineHeight: 1, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      {sub && <div style={{ fontSize: 11, color: T.faint }}>{sub}</div>}
    </div>
  );
}

function Stat({ label, value, tone, pct }: { label: string; value: string; tone?: string; pct?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 16.5, fontWeight: 800, color: tone ?? T.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
        {value}{pct && <span style={{ fontSize: 11, fontWeight: 700, color: T.faint, marginLeft: 5 }}>{pct}</span>}
      </span>
      <span style={{ fontSize: 10.5, color: T.faint }}>{label}</span>
    </div>
  );
}

function Funnel({ funnel, accent }: { funnel: Record<string, number>; accent: string }) {
  const max = Math.max(1, ...PIPELINE.map(s => funnel[s.key]));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%', height: '100%', justifyContent: 'space-evenly' }}>
      {PIPELINE.map((s, i) => {
        const v = funnel[s.key]; const w = (v / max) * 100;
        const deal = i === 5, delivery = i >= 6;
        const color = delivery ? T.green : accent;
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            <span style={{ flex: '0 0 92px', fontSize: 11.5, color: deal ? T.text : T.muted, fontWeight: deal ? 700 : 500, textAlign: 'right' }}>{s.label}</span>
            <div style={{ flex: '1 1 auto', height: 16, background: T.track, borderRadius: 5, overflow: 'hidden', minWidth: 0 }}>
              <div style={{ width: `${Math.max(w, 2)}%`, height: '100%', borderRadius: 5, background: color, opacity: delivery || deal ? 1 : 0.6 }} />
            </div>
            <span style={{ flex: '0 0 38px', fontSize: 12, fontWeight: 700, color: T.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
          </div>
        );
      })}
    </div>
  );
}

function CompareByCompany({ service, highlightRegion, tick }: { service: ServiceLine; highlightRegion: Region4 | 'ALL'; tick: number }) {
  const cells = serviceAcrossRegions(service);
  const max = Math.max(1, ...cells.map(c => c.revenueYTD));
  const best = Math.max(...cells.map(c => c.revenueYTD));
  const weak = weakest(cells);
  const a = SERVICE_ACCENT[service];
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      {cells.map(c => {
        const isBest = c.revenueYTD === best;
        const isWeak = weak?.region === c.region;
        const isActive = highlightRegion === c.region;
        const liveWr = jitterPct(c.winRate, `wr|${c.region}|${service}`, tick, 0.025);
        return (
          <div key={c.region} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: isActive ? '3px 6px' : '3px 0',
            borderRadius: 7, background: isActive ? `${a}14` : 'transparent', outline: isActive ? `1px solid ${a}55` : 'none',
          }}>
            <span style={{ flex: '0 0 54px', fontSize: 12, fontWeight: isBest ? 800 : 600, color: isBest ? a : T.text }}>
              {c.region}{isBest && <span style={{ marginLeft: 4, fontSize: 9, color: a }}>●</span>}
            </span>
            <div style={{ flex: '1 1 auto', height: 18, background: T.track, borderRadius: 5, overflow: 'hidden', minWidth: 0 }}>
              <div style={{ width: `${(c.revenueYTD / max) * 100}%`, height: '100%', borderRadius: 5, background: isBest ? a : `${a}90` }} />
            </div>
            <span style={{ flex: '0 0 auto', minWidth: 78, textAlign: 'right', fontSize: 12, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums' }}>
              {fmtM(c.revenueYTD)}<span style={{ color: T.faint, fontWeight: 500, marginLeft: 5, fontSize: 10.5 }}>{fmtPct(liveWr)}</span>
            </span>
            {isWeak && <AlertTriangle size={12} color={T.amber} />}
          </div>
        );
      })}
    </div>
  );
}

function Trend({ series, accent }: { series: { months: readonly string[]; cur: number[]; prev: number[] }; accent: string }) {
  const W = 520, H = 108, padL = 38, padR = 8, padT = 8, padB = 18;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxY = Math.max(...series.cur, ...series.prev) * 1.15 || 1;
  const x = (i: number) => padL + i * (plotW / (series.months.length - 1));
  const y = (v: number) => padT + (1 - v / maxY) * plotH;
  const line = (d: number[]) => d.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const last = series.cur.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: 'visible' }}>
      {[0, 1].map(f => <g key={f}>
        <line x1={padL} x2={W - padR} y1={y(maxY * f)} y2={y(maxY * f)} stroke={T.border} />
        <text x={padL - 6} y={y(maxY * f) + 3} textAnchor="end" fontSize="9" fill={T.faint}>{fmtM(maxY * f)}</text>
      </g>)}
      {series.months.map((m, i) => <text key={m} x={x(i)} y={H - 5} textAnchor="middle" fontSize="9" fill={T.faint}>{m}</text>)}
      <path d={`${line(series.cur)} L${x(last)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={accent} opacity={0.1} />
      <path d={line(series.prev)} fill="none" stroke={T.faint} strokeWidth={1.6} strokeDasharray="4 3" strokeLinecap="round" />
      <path d={line(series.cur)} fill="none" stroke={accent} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
      {series.cur.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === last ? 4 : 2.4} fill={T.panel} stroke={accent} strokeWidth={2} />)}
      <text x={x(last)} y={y(series.cur[last]) - 8} textAnchor="end" fontSize="10" fontWeight="700" fill={T.text}>{fmtM(series.cur[last])}</text>
    </svg>
  );
}

function MiniStat({ c, flagged, tick }: { c: Cell; flagged?: boolean; tick: number }) {
  const a = SERVICE_ACCENT[c.service];
  const liveWr = jitterPct(c.winRate, `wr|${c.region}|${c.service}`, tick, 0.025);
  const liveYoy = c.yoy + liveJitter(`yoy|${c.region}|${c.service}`, tick, 0.035);
  return (
    <div style={{ padding: '7px 9px', borderRadius: 9, background: T.panelHi, border: `1px solid ${flagged ? T.amber : T.border}`, borderLeft: `3px solid ${a}`, display: 'grid', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: T.muted, fontWeight: 600 }}>{SERVICE_LABEL[c.service]}</span>
        {flagged && <AlertTriangle size={11} color={T.amber} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{fmtM(c.revenueYTD)}</span>
        <Delta v={liveYoy} />
      </div>
      <div style={{ fontSize: 9.5, color: T.faint }}>{c.won}W · {c.lost}L · {fmtPct(liveWr)} win</div>
    </div>
  );
}

export function LiveDashboard() {
  const [region, setRegion] = useState<Region4>('SE');
  const [allRegions, setAllRegions] = useState(false);
  const [service, setService] = useState<ServiceLine>('PREMIUM_STORE_FITOUT');

  const effectiveRegion: Region4 | 'ALL' = allRegions ? 'ALL' : region;
  const scope: Scope = { region: effectiveRegion, service };
  const t = useMemo(() => scopeTotals(scope), [effectiveRegion, service]);
  const series = useMemo(() => monthlySeries(scope), [effectiveRegion, service]);
  const accent = SERVICE_ACCENT[service];

  const tick = useLiveTick();
  const liveKey = `${effectiveRegion}|${service}`;
  const liveWinRate = jitterPct(t.winRate, `wr|${liveKey}`, tick, 0.025);
  const liveYoy = t.yoy + liveJitter(`yoy|${liveKey}`, tick, 0.035);

  const dealTotal = Math.max(1, t.won + t.lost + t.working);
  const wonPct = t.won / dealTotal, lostPct = t.lost / dealTotal, workPct = t.working / dealTotal;

  const focusCell = useMemo(
    () => allRegions ? weakest(serviceAcrossRegions(service)) : weakest(servicesInRegion(region)),
    [allRegions, region, service],
  );
  const focusWinRate = focusCell ? jitterPct(focusCell.winRate, `wr|${focusCell.region}|${focusCell.service}`, tick, 0.025) : 0;
  const focusLabel = allRegions
    ? (focusCell ? `${focusCell.region} — ${fmtPct(focusWinRate)} win rate` : null)
    : (focusCell ? `${SERVICE_LABEL[focusCell.service]} — ${fmtPct(focusWinRate)} win rate` : null);

  const psf = MASCOT_CONFIG.PREMIUM_STORE_FITOUT;
  const chip = (active: boolean, a: string) => ({
    padding: '4px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
    border: `1px solid ${active ? a : T.border}`, background: active ? `${a}18` : T.panel,
    color: active ? a : T.muted, transition: 'all .12s',
  } as React.CSSProperties);

  return (
    <div style={{
      height: '100vh', width: '100%', overflow: 'hidden', background: `radial-gradient(1000px 420px at 84% -10%, ${accent}14, transparent), ${T.bg}`,
      color: T.text, fontFamily: 'var(--font-ui, "Segoe UI", system-ui, sans-serif)',
      padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', boxSizing: 'border-box',
      transition: 'background 0.25s',
    }}>
      <style>{`@keyframes ldpulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HeaderMark region={region} allRegions={allRegions} />
          <span style={{ fontSize: 12.5, color: T.muted }}>Business Overview</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: T.green }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.green, animation: 'ldpulse 1.6s infinite' }} /> LIVE
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...eyebrow, marginRight: 2 }}>Company</span>
          {SERVICES.map(s => (
            <button key={s} onClick={() => setService(s)} style={chip(service === s, SERVICE_ACCENT[s])}>{SERVICE_LABEL[s]}</button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: allRegions ? 0.45 : 1, transition: 'opacity .15s' }}>
          <span style={{ ...eyebrow, marginRight: 2 }}>Region</span>
          {REGIONS4.map(r => (
            <button key={r} disabled={allRegions} onClick={() => setRegion(r)}
              style={{ ...chip(!allRegions && region === r, accent), cursor: allRegions ? 'default' : 'pointer' }}>{r}</button>
          ))}
        </div>

        <button onClick={() => setAllRegions(v => !v)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 8, cursor: 'pointer',
          fontSize: 11.5, fontWeight: 700, border: `1.5px solid ${allRegions ? accent : T.borderStrong}`,
          background: allRegions ? accent : T.panel, color: allRegions ? '#fff' : T.muted,
        }}>
          <Grid3x3 size={13} /> All regions on one page
        </button>

        <span style={{ fontSize: 11.5, color: T.faint }}>{allRegions ? 'All regions' : REGION4_LABEL[region]} · FY 2026 YTD</span>
        {focusLabel && <FocusFlag label={focusLabel} />}
        <div style={{ marginLeft: 'auto' }}><LiveClock /></div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1.55fr 1fr', gridTemplateRows: 'auto 1fr auto', gap: 10 }}>

        <div style={{ gridColumn: '1 / 2', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
          <Kpi label="Opportunities" value={String(t.working)} accent={accent} icon={<Briefcase size={14} />} sub="worked" />
          <Kpi label="Won YTD" value={String(t.won)} accent={T.green} icon={<CheckCircle2 size={14} />} sub={fmtPct(wonPct)} />
          <Kpi label="Lost" value={String(t.lost)} accent={T.red} icon={<XCircle size={14} />} sub={fmtPct(lostPct)} />
          <Kpi label="Win rate" value={fmtPct(liveWinRate)} accent={accent} icon={<Target size={14} />} sub="decided" />
          <Kpi label="Revenue" value={fmtM(t.revenueYTD)} accent={accent} icon={<DollarSign size={14} />} sub={<Delta v={liveYoy} />} />
          <Kpi label="Active jobs" value={String(t.activeJobs)} accent={accent} icon={<Boxes size={14} />} sub="delivery" />
        </div>

        <div style={{ gridColumn: '2 / 3', ...panelSx, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: accent }}>{SERVICE_LABEL[service]}</span>
            <span style={{ fontSize: 10.5, color: T.faint }}>across the 4 regions</span>
          </div>
          <CompareByCompany service={service} highlightRegion={effectiveRegion} tick={tick} />
        </div>

        <div style={{ gridColumn: '1 / 2', display: 'grid', gridTemplateRows: 'auto 1fr', gap: 10, minHeight: 0 }}>
          <div style={{ ...panelSx, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Opportunities</span>
              <span style={{ fontSize: 10.5, color: T.faint }}>lead to installed — where every deal stands</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...eyebrow, color: accent }}><Handshake size={12} /> Sales</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Stat label="Working" value={String(t.working)} pct={fmtPct(workPct)} />
                  <Stat label="Win rate" value={fmtPct(liveWinRate)} />
                  <Stat label="Won" value={String(t.won)} tone={T.green} pct={fmtPct(wonPct)} />
                  <Stat label="Lost" value={String(t.lost)} tone={T.red} pct={fmtPct(lostPct)} />
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8, borderLeft: `1px solid ${T.border}`, paddingLeft: 16 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...eyebrow, color: accent }}><Factory size={12} /> Production</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Stat label="In production" value={String(t.funnel.production)} />
                  <Stat label="Installing" value={String(t.funnel.installation)} />
                  <Stat label="Active total" value={String(t.activeJobs)} />
                  <Stat label="Completed" value={String(t.funnel.installation)} tone={T.green} />
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8, borderLeft: `1px solid ${T.border}`, paddingLeft: 16 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...eyebrow, color: accent }}><Wallet size={12} /> Value</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Stat label="Won revenue" value={fmtM(t.revenueYTD)} tone={T.green} />
                  <Stat label="In play" value={fmtM(t.pipelineValue)} />
                  <Stat label="Avg deal" value={fmtM(t.avgDeal)} />
                  <Stat label="vs last yr" value={fmtSignedPct(liveYoy)} tone={liveYoy >= 0 ? T.green : T.red} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', height: 14, borderRadius: 5, overflow: 'hidden', gap: 2, background: T.track, marginTop: 12 }}>
              <span style={{ width: `${wonPct * 100}%`, background: T.green }} />
              <span style={{ width: `${lostPct * 100}%`, background: T.red }} />
              <span style={{ width: `${workPct * 100}%`, background: accent }} />
            </div>
          </div>

          <div style={{ ...panelSx, padding: '12px 16px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Pipeline</span>
              <span style={{ fontSize: 10.5, color: T.faint }}>Lead → Opportunity → Design → Estimate → Contract → Closed Deal → Production → Installation</span>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}><Funnel funnel={t.funnel} accent={accent} /></div>
          </div>
        </div>

        <div style={{ gridColumn: '2 / 3', display: 'grid', gridTemplateRows: '1fr auto', gap: 10, minHeight: 0 }}>
          <div style={{ ...panelSx, padding: '10px 14px', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
              {allRegions ? 'Every region, its 3 companies' : `${REGION4_LABEL[region]} · other companies here`}
            </div>
            {allRegions ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {REGIONS4.map(r => {
                  const weak = weakest(servicesInRegion(r));
                  return (
                    <div key={r} style={{ display: 'grid', gap: 5 }}>
                      <span style={{ fontSize: 11, fontWeight: 800 }}>{r}</span>
                      {servicesInRegion(r).map(c => <MiniStat key={c.service} c={c} flagged={weak?.service === c.service} tick={tick} />)}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {servicesInRegion(region).map(c => <MiniStat key={c.service} c={c} flagged={focusCell?.service === c.service} tick={tick} />)}
              </div>
            )}
          </div>
          <div style={{ ...panelSx, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>This year vs last</span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 10, fontSize: 10.5, color: T.muted }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 2.5, borderRadius: 2, background: accent }} />2026</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 2.5, borderRadius: 2, background: T.faint }} />2025</span>
              </span>
            </div>
            <Trend series={series} accent={accent} />
          </div>
        </div>

        <div style={{ gridColumn: '1 / 3', display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: T.faint, borderTop: `1px solid ${T.border}`, paddingTop: 6 }}>
          <span>T&nbsp;Lines · Business Overview · <span style={{ color: accent, fontWeight: 600 }}>demo — sample figures</span></span>
          <span>4 regions · 3 companies · one pipeline</span>
        </div>
      </div>

      <div style={{ position: 'absolute', right: '0.5vw', bottom: 0, width: 'clamp(380px, 28vw, 580px)', height: 'clamp(480px, 84vh, 800px)', zIndex: 60, pointerEvents: 'none' }}>
        <MascotViewer glbPath={psf.glbPath} mood={liveWinRate > 0.5 ? 'champion' : 'working'} bodyColor={psf.body} bellyColor={psf.belly} accent={accent} grounded />
      </div>
    </div>
  );
}
