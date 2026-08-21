'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Boxes, Truck, AlertTriangle, TrendingUp, TrendingDown, Wallet, Grid3x3, ArrowRight,
  Target, CheckCircle2, XCircle, Percent, Clock,
} from 'lucide-react';
import {
  REGIONS4, REGION4_LABEL, SERVICES, SERVICE_LABEL, PIPELINE,
  cellsFor, aggregate, weakest,
  type Region4, type ServiceLine, type Scope,
} from '@/lib/demo/execData';
import {
  projectsFor, projectsForRegion, projectsForCompany, aggregateProduction,
  financials, financialsByType, financialsByCompany, STATUS_LABEL,
  type ProdProject,
} from '@/lib/demo/productionData';
import { MASCOT_CONFIG } from './mascotConfig';
import { HeaderMark } from './HeaderMark';
import { useLiveTick, jitterPct } from '@/lib/demo/liveJitter';

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
const eyebrow: React.CSSProperties = { fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.faint };
const fmtM = (v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : v >= 1_000 ? `$${Math.round(v / 1_000)}K` : `$${v}`;
const fmtPct = (v: number) => `${Math.round(v * 100)}%`;

function Kpi({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon: React.ReactNode; accent: string }) {
  return (
    <div style={{ ...panelSx, background: T.panelHi, padding: '8px 11px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={eyebrow}>{label}</span><span style={{ color: accent, opacity: 0.9 }}>{icon}</span>
      </div>
      <span style={{ fontSize: 18, fontWeight: 800, color: T.text, lineHeight: 1, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      {sub && <div style={{ fontSize: 10, color: T.faint }}>{sub}</div>}
    </div>
  );
}

function PipelineStrip({ scope, accent }: { scope: Scope; accent: string }) {
  const t = aggregate(cellsFor(scope));
  const max = Math.max(1, ...PIPELINE.map(s => t.funnel[s.key]));
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
      {PIPELINE.map((s, i) => {
        const v = t.funnel[s.key];
        const h = Math.max(6, (v / max) * 100);
        const isProdSide = i >= 6;
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: '1 1 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
              <div style={{ width: '100%', height: 30, display: 'flex', alignItems: 'flex-end', background: T.track, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: '100%', height: `${h}%`, background: isProdSide ? accent : T.borderStrong, borderRadius: '4px 4px 0 0' }} />
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: isProdSide ? accent : T.muted, textAlign: 'center', whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
            {i < PIPELINE.length - 1 && <ArrowRight size={10} color={T.faint} style={{ flexShrink: 0, margin: '0 1px 14px' }} />}
          </div>
        );
      })}
    </div>
  );
}

function TypeMarginBar({ type, revenue, margin, marginPct, maxRevenue, accent }: { type: string; revenue: number; margin: number; marginPct: number; maxRevenue: number; accent: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{type}</span>
        <span style={{ fontSize: 11, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>PO {fmtM(revenue)}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: margin >= 0 ? T.green : T.red }}>{fmtM(margin)} · {fmtPct(marginPct)}</span>
      </div>
      <div style={{ height: 14, background: T.track, borderRadius: 5, overflow: 'hidden', minWidth: 0 }}>
        <div style={{ width: `${maxRevenue ? (revenue / maxRevenue) * 100 : 0}%`, height: '100%', background: accent, borderRadius: 5 }} />
      </div>
    </div>
  );
}

function StageConversion({ scope, tick }: { scope: Scope; tick: number }) {
  const t = aggregate(cellsFor(scope));
  const rows = PIPELINE.slice(0, -1).map((s, i) => {
    const next = PIPELINE[i + 1];
    const from = t.funnel[s.key], to = t.funnel[next.key];
    const pct = from > 0 ? to / from : 0;
    return { key: s.key, from: s.label, to: next.label, pct: jitterPct(pct, `conv|${s.key}|${scope.region}|${scope.service}`, tick, 0.02) };
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map(r => (
        <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ flex: '0 0 78px', fontSize: 10.5, color: T.muted, textAlign: 'right' }}>{r.from}</span>
          <ArrowRight size={10} color={T.faint} style={{ flexShrink: 0 }} />
          <span style={{ flex: '0 0 66px', fontSize: 10.5, fontWeight: 700, color: T.text }}>{r.to}</span>
          <div style={{ flex: '1 1 auto', height: 8, background: T.track, borderRadius: 4, overflow: 'hidden', minWidth: 0 }}>
            <div style={{ width: `${Math.min(100, r.pct * 100)}%`, height: '100%', background: r.pct >= 0.6 ? T.green : r.pct >= 0.4 ? T.amber : T.red, borderRadius: 4 }} />
          </div>
          <span style={{ flex: '0 0 32px', fontSize: 10.5, fontWeight: 700, color: T.text, textAlign: 'right' }}>{fmtPct(r.pct)}</span>
        </div>
      ))}
    </div>
  );
}

const STATUS_COLOR_MINI: Record<string, string> = {
  not_started: '#8C7D89', ordered: '#B87C2A', in_production: '#33607E', qc: '#8A6DAB', packing: '#3E7D5A', sent: '#3E7D5A',
};

function MiniProjectRow({ p, accent }: { p: ProdProject; accent: string }) {
  const anyDelayed = p.types.some(t => t.isDelayed);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 8, background: anyDelayed ? T.amberSoft : T.panelHi, border: `1px solid ${anyDelayed ? '#e8cf9f' : T.border}` }}>
      <div style={{ flex: '0 0 96px', minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.code}</div>
        <div style={{ fontSize: 9, color: T.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
      </div>
      <div style={{ flex: '1 1 auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {p.types.map(t => (
          <span key={t.type} title={`${t.type} · ${STATUS_LABEL[t.status]}${t.isDelayed ? ` · ${t.delayDays}d late` : ''}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, padding: '2px 5px', borderRadius: 5, background: `${accent}12`, border: `1px solid ${accent}33` }}>
            <span style={{ fontWeight: 700, color: T.text }}>{t.type[0]}</span>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLOR_MINI[t.status] }} />
            {t.isDelayed && <AlertTriangle size={9} color={T.red} />}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PipelineDashboard() {
  const [region, setRegion] = useState<Region4>('SE');
  const [allRegions, setAllRegions] = useState(false);
  const [service, setService] = useState<ServiceLine>('PREMIUM_STORE_FITOUT');

  const effectiveRegion: Region4 | 'ALL' = allRegions ? 'ALL' : region;
  const accent = SERVICE_ACCENT[service];
  const scope: Scope = { region: effectiveRegion, service };

  const projectsCompanyScope = useMemo<ProdProject[]>(
    () => allRegions ? projectsForCompany(service) : projectsFor(region, service),
    [allRegions, region, service],
  );
  const projectsRegionAllCompanies = useMemo<ProdProject[]>(
    () => allRegions ? SERVICES.flatMap(projectsForCompany) : projectsForRegion(region),
    [allRegions, region],
  );

  const salesT = useMemo(() => aggregate(cellsFor(scope)), [scope]);
  const prod = useMemo(() => aggregateProduction(projectsCompanyScope), [projectsCompanyScope]);
  const fin = useMemo(() => financials(projectsCompanyScope), [projectsCompanyScope]);
  const byType = useMemo(() => financialsByType(projectsCompanyScope), [projectsCompanyScope]);
  const byCompany = useMemo(() => financialsByCompany(projectsRegionAllCompanies), [projectsRegionAllCompanies]);

  const tick = useLiveTick();
  const liveKey = `${effectiveRegion}|${service}`;
  const liveWinRate = jitterPct(salesT.winRate, `wr|${liveKey}`, tick, 0.02);
  const liveMarginPct = jitterPct(fin.marginPct, `margin|${liveKey}`, tick, 0.02);

  const weak = weakest(cellsFor(scope.region === 'ALL' ? { region: 'ALL', service: 'ALL' } : { region, service: 'ALL' }));
  const maxTypeRevenue = Math.max(1, ...byType.map(b => b.f.poRevenue));
  const maxCoRevenue = Math.max(1, ...byCompany.map(b => b.f.poRevenue));

  const chip = (active: boolean, a: string) => ({
    padding: '4px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
    border: `1px solid ${active ? a : T.border}`, background: active ? `${a}18` : T.panel,
    color: active ? a : T.muted, transition: 'all .12s',
  } as React.CSSProperties);

  const psf = MASCOT_CONFIG.PREMIUM_STORE_FITOUT;

  return (
    <div style={{
      height: '100vh', width: '100%', overflow: 'hidden', background: `radial-gradient(1000px 420px at 84% -10%, ${accent}14, transparent), ${T.bg}`,
      color: T.text, fontFamily: 'var(--font-ui, "Segoe UI", system-ui, sans-serif)',
      padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HeaderMark region={region} allRegions={allRegions} />
          <span style={{ fontSize: 12.5, color: T.muted }}>Full Pipeline · Trust Lines internal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...eyebrow, marginRight: 2 }}>Company</span>
          {SERVICES.map(s => <button key={s} onClick={() => setService(s)} style={chip(service === s, SERVICE_ACCENT[s])}>{SERVICE_LABEL[s]}</button>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: allRegions ? 0.45 : 1 }}>
          <span style={{ ...eyebrow, marginRight: 2 }}>Region</span>
          {REGIONS4.map(r => <button key={r} disabled={allRegions} onClick={() => setRegion(r)} style={{ ...chip(!allRegions && region === r, accent), cursor: allRegions ? 'default' : 'pointer' }}>{r}</button>)}
        </div>
        <button onClick={() => setAllRegions(v => !v)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 8, cursor: 'pointer',
          fontSize: 11.5, fontWeight: 700, border: `1.5px solid ${allRegions ? accent : T.borderStrong}`,
          background: allRegions ? accent : T.panel, color: allRegions ? '#fff' : T.muted,
        }}><Grid3x3 size={13} /> All regions</button>
        <span style={{ fontSize: 11, color: T.faint }}>{allRegions ? 'All regions' : REGION4_LABEL[region]} · FY 2026 YTD</span>
        {weak && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: T.amber, background: T.amberSoft, padding: '3px 8px', borderRadius: 999 }}>
            <AlertTriangle size={11} /> Focus: {weak.service === service ? '' : SERVICE_LABEL[weak.service] + ' · '}{weak.region} lowest win rate
          </span>
        )}
      </div>

      <div style={{ ...panelSx, padding: '9px 16px 6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700 }}>Lead → Installation</span>
          <span style={{ fontSize: 9.5, color: T.faint }}>deal &amp; job counts · <span style={{ color: accent, fontWeight: 700 }}>production</span> highlighted</span>
        </div>
        <PipelineStrip scope={scope} accent={accent} />
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '0.95fr 1.1fr 1fr', gap: 8 }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7 }}>
            <Kpi label="Opportunities" value={String(salesT.opportunities)} accent={T.borderStrong} icon={<Target size={12} />} />
            <Kpi label="Working" value={String(salesT.working)} accent={accent} icon={<Clock size={12} />} />
            <Kpi label="Won YTD" value={String(salesT.won)} accent={T.green} icon={<CheckCircle2 size={12} />} />
            <Kpi label="Win rate" value={fmtPct(liveWinRate)} accent={T.amber} icon={<Percent size={12} />} />
          </div>
          <div style={{ ...panelSx, padding: '10px 14px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 8 }}>Stage conversion <span style={{ fontWeight: 500, color: T.faint }}>· Lead → Installation</span></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
              <StageConversion scope={scope} tick={tick} />
            </div>
            <div style={{ paddingTop: 8, fontSize: 9.5, color: T.faint, borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 5 }}>
              <XCircle size={11} color={T.red} /> {salesT.lost} lost YTD · deal counts only, no sale price shown
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
            <Kpi label="Active jobs" value={String(prod.inProduction)} accent={accent} icon={<Boxes size={12} />} />
            <Kpi label="Sent" value={String(prod.sent)} accent={T.green} icon={<Truck size={12} />} />
            <Kpi label="Delayed" value={String(prod.delayed)} accent={T.red} icon={<AlertTriangle size={12} />} />
            <Kpi label="PO signed" value={`${prod.poSigned}/${prod.poSigned + prod.poPending}`} accent="#33607E" icon={<Wallet size={12} />} />
          </div>
          <div style={{ ...panelSx, padding: '10px 14px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 6 }}>Projects — what&apos;s happening now</div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'space-evenly' }}>
              {projectsCompanyScope.map(p => <MiniProjectRow key={p.code} p={p} accent={accent} />)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7 }}>
            <Kpi label="PO revenue" value={fmtM(fin.poRevenue)} sub="billed to T-Lines" accent="#33607E" icon={<Wallet size={12} />} />
            <Kpi label="PF cost" value={fmtM(fin.pfCost)} sub="paid to vendors" accent={T.red} icon={<TrendingDown size={12} />} />
            <Kpi label="Margin" value={fmtM(fin.margin)} sub={`${fin.costedLines} costed lines`} accent={T.green} icon={<TrendingUp size={12} />} />
            <Kpi label="Margin %" value={fmtPct(liveMarginPct)} sub={`${SERVICE_LABEL[service]}`} accent={accent} icon={<TrendingUp size={12} />} />
          </div>
          <div style={{ ...panelSx, padding: '10px 14px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 8 }}>Margin by type <span style={{ fontWeight: 500, color: T.faint }}>· {SERVICE_LABEL[service]}, {allRegions ? 'all regions' : REGION4_LABEL[region]}</span></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', gap: 12 }}>
              {byType.map(({ type, f }) => (
                <TypeMarginBar key={type} type={type} revenue={f.poRevenue} margin={f.margin}
                  marginPct={jitterPct(f.marginPct, `margin|type|${type}|${liveKey}`, tick, 0.02)}
                  maxRevenue={maxTypeRevenue} accent={accent} />
              ))}
            </div>
            <div style={{ paddingTop: 8, fontSize: 9.5, color: T.faint, borderTop: `1px solid ${T.border}`, maxWidth: '54%' }}>
              PO = what T-Lines pays Trust Lines · PF = what Trust Lines pays the vendor · Margin = PO − PF.
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...panelSx, padding: '9px 14px', flexShrink: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 7 }}>Margin by company <span style={{ fontWeight: 500, color: T.faint }}>· across the region scope · Trust-Lines-internal, not visible to T-Lines PM</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {byCompany.map(({ service: s, f }) => {
            const liveCoMarginPct = jitterPct(f.marginPct, `margin|co|${s}|${effectiveRegion}`, tick, 0.02);
            return (
            <div key={s} onClick={() => setService(s)} style={{ cursor: 'pointer', padding: '8px 10px', borderRadius: 9, background: service === s ? `${SERVICE_ACCENT[s]}14` : T.panelHi, outline: service === s ? `1.5px solid ${SERVICE_ACCENT[s]}66` : `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: SERVICE_ACCENT[s] }}>{SERVICE_LABEL[s]}</span>
                <span style={{ flex: 1 }} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 800, color: f.margin >= 0 ? T.green : T.red }}>
                  {f.margin >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {fmtPct(liveCoMarginPct)}
                </span>
              </div>
              <div style={{ height: 12, background: T.track, borderRadius: 4, overflow: 'hidden', marginBottom: 5 }}>
                <div style={{ width: `${maxCoRevenue ? (f.poRevenue / maxCoRevenue) * 100 : 0}%`, height: '100%', background: SERVICE_ACCENT[s], borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>
                <span>PO {fmtM(f.poRevenue)}</span><span>PF {fmtM(f.pfCost)}</span><span style={{ fontWeight: 700, color: T.text }}>{fmtM(f.margin)}</span>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.faint, borderTop: `1px solid ${T.border}`, paddingTop: 5, flexShrink: 0 }}>
        <span>T&nbsp;Lines · Full Pipeline · <span style={{ color: accent, fontWeight: 600 }}>demo — sample figures</span></span>
        <span>Trust Lines view — no end-customer sale price shown</span>
      </div>

      <div style={{ position: 'absolute', right: '0.5vw', bottom: 0, width: 'clamp(340px, 25vw, 520px)', height: 'clamp(440px, 74vh, 680px)', zIndex: 60, pointerEvents: 'none' }}>
        <MascotViewer glbPath={psf.glbPath} mood={liveMarginPct > 0.2 ? 'champion' : liveMarginPct > 0 ? 'working' : 'worried'} bodyColor={psf.body} bellyColor={psf.belly} accent={accent} grounded />
      </div>
    </div>
  );
}
