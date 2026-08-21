'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Boxes, Clock, AlertTriangle, FileCheck2, FileX2, Lock, Truck, PackageCheck,
  Grid3x3, ShieldCheck,
} from 'lucide-react';
import {
  REGIONS4, REGION4_LABEL, SERVICES, SERVICE_LABEL,
  scopeTotals as salesScopeTotals,
} from '@/lib/demo/execData';
import {
  TYPES, STATUS_LABEL, projectsFor, projectsForCompany,
  aggregateProduction, byType, forRole,
  type Region4, type ServiceLine, type ProdStatus, type ProdProject, type ViewerRole,
} from '@/lib/demo/productionData';
import { MASCOT_CONFIG } from './mascotConfig';
import { HeaderMark } from './HeaderMark';

const MascotViewer = dynamic(() => import('./MascotViewer'), { ssr: false });

const T = {
  bg: '#F3EEF2', panel: '#FBF9FB', panelHi: '#F6F1F5', border: '#E4D9E2', borderStrong: '#D6C8D4',
  text: '#241823', muted: '#5E4E5B', faint: '#8C7D89', track: '#E9DFE7',
  green: '#3E7D5A', red: '#A9463A', amber: '#B87C2A', amberSoft: '#F4E9D6',
};
const SERVICE_ACCENT: Record<ServiceLine, string> = {
  STORE_MAKER: '#2E6B46', DESIGN_BUILD: '#33607E', PREMIUM_STORE_FITOUT: '#5A2F55',
};
const STATUS_COLOR: Record<ProdStatus, string> = {
  not_started: T.faint, ordered: '#B87C2A', in_production: '#33607E', qc: '#8A6DAB', packing: '#2E6B46', sent: T.green,
};
const panelSx: React.CSSProperties = { background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: '0 1px 2px rgba(40,20,38,.04)' };
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.faint };

function Kpi({ label, value, sub, icon, accent }: { label: string; value: string; sub?: React.ReactNode; icon: React.ReactNode; accent: string }) {
  return (
    <div style={{ ...panelSx, background: T.panelHi, padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={eyebrow}>{label}</span><span style={{ color: accent, opacity: 0.9 }}>{icon}</span>
      </div>
      <span style={{ fontSize: 20, fontWeight: 800, color: T.text, lineHeight: 1, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      {sub && <div style={{ fontSize: 10.5, color: T.faint }}>{sub}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: ProdStatus }) {
  const c = STATUS_COLOR[status];
  return (
    <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: `${c}1c`, color: c, whiteSpace: 'nowrap' }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function ProjectRow({ p, accent }: { p: ProdProject; accent: string }) {
  const anyDelayed = p.types.some(t => t.isDelayed);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 9, background: anyDelayed ? T.amberSoft : T.panelHi, border: `1px solid ${anyDelayed ? '#e8cf9f' : T.border}` }}>
      <div style={{ flex: '0 0 108px', minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.code}</div>
        <div style={{ fontSize: 10, color: T.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
      </div>
      <div style={{ flex: '1 1 auto', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {p.types.map(t => (
          <span key={t.type} title={`${t.type} · ${STATUS_LABEL[t.status]}${t.isDelayed ? ` · ${t.delayDays}d late` : ''}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 6px', borderRadius: 6, background: `${accent}12`, border: `1px solid ${accent}33` }}>
            <span style={{ fontWeight: 700, color: T.text }}>{t.type[0]}</span>
            <StatusPill status={t.status} />
            {t.isDelayed && <AlertTriangle size={10} color={T.red} />}
          </span>
        ))}
      </div>
    </div>
  );
}

function CategoryBar({ label, total, active, delayed, accent }: { label: string; total: number; active: number; delayed: number; accent: string }) {
  const pct = total ? (active / total) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ flex: '0 0 58px', fontSize: 11, fontWeight: 700, color: T.text }}>{label}</span>
      <div style={{ flex: '1 1 auto', height: 14, background: T.track, borderRadius: 5, overflow: 'hidden', minWidth: 0 }}>
        <div style={{ width: `${Math.max(pct, active ? 3 : 0)}%`, height: '100%', background: accent, borderRadius: 5 }} />
      </div>
      <span style={{ flex: '0 0 auto', fontSize: 10.5, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>{active}/{total}</span>
      {delayed > 0 && <span style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: T.red }}><AlertTriangle size={10} />{delayed}</span>}
    </div>
  );
}

function CompareByCompany({ service, highlightRegion, accent }: { service: ServiceLine; highlightRegion: Region4 | 'ALL'; accent: string }) {
  const rows = REGIONS4.map(r => {
    const t = aggregateProduction(projectsFor(r, service));
    return { region: r, t };
  });
  const max = Math.max(1, ...rows.map(r => r.t.typeLines));
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      {rows.map(({ region, t }) => {
        const isActive = highlightRegion === region;
        return (
          <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: isActive ? '3px 6px' : '3px 0', borderRadius: 7, background: isActive ? `${accent}14` : 'transparent', outline: isActive ? `1px solid ${accent}55` : 'none' }}>
            <span style={{ flex: '0 0 40px', fontSize: 12, fontWeight: 700, color: T.text }}>{region}</span>
            <div style={{ flex: '1 1 auto', height: 14, background: T.track, borderRadius: 5, overflow: 'hidden', display: 'flex', minWidth: 0 }}>
              <div style={{ width: `${(t.inProduction / max) * 100}%`, background: accent, borderRadius: '5px 0 0 5px' }} />
              <div style={{ width: `${(t.sent / max) * 100}%`, background: T.green }} />
            </div>
            <span style={{ flex: '0 0 auto', fontSize: 10.5, color: T.muted, fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'right' }}>
              {t.inProduction} active{t.delayed > 0 && <span style={{ color: T.red, fontWeight: 700 }}> · {t.delayed} late</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ProductionDashboard() {
  const [region, setRegion] = useState<Region4>('SE');
  const [allRegions, setAllRegions] = useState(false);
  const [service, setService] = useState<ServiceLine>('PREMIUM_STORE_FITOUT');
  const [role, setRole] = useState<ViewerRole>('trust');

  const effectiveRegion: Region4 | 'ALL' = allRegions ? 'ALL' : region;
  const accent = SERVICE_ACCENT[service];

  const rawProjects = useMemo(() => {
    if (allRegions) return projectsForCompany(service);
    return projectsFor(region, service);
  }, [allRegions, region, service]);
  const projects = useMemo(() => forRole(rawProjects, role), [rawProjects, role]);
  const totals = useMemo(() => aggregateProduction(projects), [projects]);
  const cats = useMemo(() => byType(projects), [projects]);
  const salesCtx = useMemo(() => salesScopeTotals({ region: effectiveRegion, service }), [effectiveRegion, service]);

  const delayedProjects = [...projects].filter(p => p.types.some(t => t.isDelayed))
    .sort((a, b) => Math.max(...b.types.map(t => t.delayDays)) - Math.max(...a.types.map(t => t.delayDays)));
  const activeProjects = projects.filter(p => !delayedProjects.includes(p));

  const poLines = projects.flatMap(p => p.types.map(t => ({ project: p, line: t })));

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
      padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HeaderMark region={region} allRegions={allRegions} />
          <span style={{ fontSize: 12.5, color: T.muted }}>Production Overview</span>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
          <span style={{ ...eyebrow, marginRight: 2 }}>Viewing as</span>
          <button onClick={() => setRole('trust')} style={chip(role === 'trust', '#33607E')}>Trust Lines</button>
          <button onClick={() => setRole('tlines')} style={chip(role === 'tlines', '#33607E')}>T-Lines PM</button>
        </div>

        <span style={{ fontSize: 11.5, color: T.faint }}>{allRegions ? 'All regions' : REGION4_LABEL[region]} · FY 2026 YTD</span>
        {totals.delayed > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: T.amber, background: T.amberSoft, padding: '3px 8px', borderRadius: 999 }}>
            <AlertTriangle size={11} /> {totals.delayed} item{totals.delayed === 1 ? '' : 's'} running late
          </span>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1.5fr 1fr', gridTemplateRows: 'auto auto 1fr auto', gap: 10 }}>

        <div style={{ gridColumn: '1 / 2', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 7 }}>
          <Kpi label="Projects" value={String(totals.projects)} accent={accent} icon={<Boxes size={13} />} sub={`${salesCtx.activeJobs} deals active`} />
          <Kpi label="Not started" value={String(totals.notStarted)} accent={T.faint} icon={<Clock size={13} />} sub="types" />
          <Kpi label="In production" value={String(totals.inProduction)} accent={accent} icon={<Truck size={13} />} sub="moving" />
          <Kpi label="Sent" value={String(totals.sent)} accent={T.green} icon={<PackageCheck size={13} />} sub="to T-Lines" />
          <Kpi label="Delayed" value={String(totals.delayed)} accent={T.red} icon={<AlertTriangle size={13} />} sub="past target date" />
          <Kpi label="PO signed" value={`${totals.poSigned}/${totals.poSigned + totals.poPending}`} accent="#33607E" icon={<FileCheck2 size={13} />} sub={`${totals.poPending} pending`} />
        </div>

        <div style={{ gridColumn: '2 / 3', ...panelSx, padding: '9px 13px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{SERVICE_LABEL[service]}</span>
            <span style={{ fontSize: 10.5, color: T.faint }}>production, across the 4 regions</span>
          </div>
          <CompareByCompany service={service} highlightRegion={effectiveRegion} accent={accent} />
        </div>

        <div style={{ gridColumn: '1 / 2', ...panelSx, padding: '9px 16px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 7 }}>By category · Millwork · Shelving · Ceiling · Image</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {cats.map(c => <CategoryBar key={c.type} label={c.type} total={c.total} active={c.inProduction} delayed={c.delayed} accent={accent} />)}
          </div>
        </div>

        <div style={{ gridColumn: '2 / 3', ...panelSx, padding: '9px 13px', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700 }}>
            <FileCheck2 size={13} color="#33607E" /> Supply — Purchase Orders
            <span style={{ fontSize: 10, color: T.faint, fontWeight: 500 }}>{allRegions ? 'this company' : REGION4_LABEL[region]}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, fontSize: 10.5, color: T.muted }}>
            <span style={{ color: T.green, fontWeight: 700 }}>{totals.poSigned} signed</span> · <span style={{ color: T.amber, fontWeight: 700 }}>{totals.poPending} pending</span>
          </div>
          {role === 'trust' ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#8A6DAB', marginTop: 2 }}>
              <ShieldCheck size={13} /> PF — {totals.pfSigned} signed · {totals.pfPending} pending
              <span style={{ fontSize: 9.5, fontWeight: 600, color: T.faint }}>(Trust-Lines internal)</span>
            </div>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: T.faint, background: T.panelHi, border: `1px dashed ${T.border}`, borderRadius: 7, padding: '4px 8px', marginTop: 2 }}>
              <Lock size={12} /> Production Forms are Trust-Lines internal — not shown to T-Lines PM
            </div>
          )}
        </div>

        <div style={{ gridColumn: '1 / 2', ...panelSx, padding: '10px 14px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 7 }}>Projects — what's happening now</div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'grid', gap: 5, paddingRight: 2 }}>
            {delayedProjects.map(p => <ProjectRow key={p.code} p={p} accent={accent} />)}
            {activeProjects.map(p => <ProjectRow key={p.code} p={p} accent={accent} />)}
          </div>
        </div>

        <div style={{ gridColumn: '2 / 3', ...panelSx, padding: '10px 14px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 7 }}>PO status by type</div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'grid', gap: 4, paddingRight: 2 }}>
            {poLines.map(({ project, line }, i) => (
              <div key={project.code + line.type + i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, padding: '4px 6px', borderRadius: 6, background: T.panelHi }}>
                <span style={{ flex: '0 0 76px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.code}</span>
                <span style={{ flex: '0 0 auto', color: T.muted }}>{line.type}</span>
                <span style={{ flex: '1 1 auto' }} />
                {line.poSigned
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: T.green, fontWeight: 700 }}><FileCheck2 size={11} /> PO signed</span>
                  : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: T.amber, fontWeight: 700 }}><FileX2 size={11} /> PO pending</span>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ gridColumn: '1 / 3', display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: T.faint, borderTop: `1px solid ${T.border}`, paddingTop: 6 }}>
          <span>T&nbsp;Lines · Production Overview · <span style={{ color: accent, fontWeight: 600 }}>demo — sample figures</span></span>
          <span>PO visible to T-Lines · PF Trust-Lines internal only</span>
        </div>
      </div>

      <div style={{ position: 'absolute', right: '0.5vw', bottom: 0, width: 'clamp(320px, 24vw, 480px)', height: 'clamp(420px, 70vh, 620px)', zIndex: 60, pointerEvents: 'none', opacity: 0.95 }}>
        <MascotViewer glbPath={psf.glbPath} mood={totals.delayed > 2 ? 'worried' : 'working'} bodyColor={psf.body} bellyColor={psf.belly} accent={accent} grounded />
      </div>
    </div>
  );
}

export { TYPES };
