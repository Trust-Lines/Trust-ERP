import Link from 'next/link';
import { formatMoney } from '@/lib/sales/format';

interface Props {
  kpis: { totalLeads: number; pipelineValue: number; delivered: number; conversionPct: number; overdue: number };
  byStatus: { key: string; label: string; color: string; count: number; value: number }[];
  byAssignee: { name: string; count: number; value: number }[];
  byRegion: { label: string; count: number; value: number }[];
}

const money = formatMoney;

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 170 }}>
      <div className="card-body">
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: accent ?? 'var(--fg-default)', marginTop: 2, lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function Bar({ label, pct, valueLabel, color, title }: { label: string; pct: number; valueLabel: string; color: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{ width: 150, flexShrink: 0, fontSize: 12, color: 'var(--fg-muted)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ flex: 1, height: 10, background: 'var(--bg-sunken)', borderRadius: 5, overflow: 'hidden' }}>
        <div title={title} style={{ width: `${pct}%`, minWidth: pct > 0 ? 4 : 0, height: '100%', background: color, borderRadius: '5px 4px 4px 5px' }} />
      </div>
      <div style={{ width: 120, flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--fg-default)' }}>{valueLabel}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 320 }}>
      <div className="card-head"><div><div className="form-section-title">{title}</div></div></div>
      <div className="card-body">{children}</div>
    </div>
  );
}

export function SalesDashboard({ kpis, byStatus, byAssignee, byRegion }: Props) {
  const maxStatus   = Math.max(1, ...byStatus.map(s => s.count));
  const maxAssignee = Math.max(1, ...byAssignee.map(a => a.count));
  const maxRegion   = Math.max(1, ...byRegion.map(r => r.value));
  const teal = 'var(--brand-teal)';

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Sales dashboard</h1>
        <p className="page-head-sub" style={{ margin: 0 }}>Pipeline overview across all leads</p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatTile label="Total leads" value={String(kpis.totalLeads)} />
        <StatTile label="Pipeline value" value={money(kpis.pipelineValue)} sub="sum of estimated deal sizes" />
        <StatTile label="Delivered" value={String(kpis.delivered)} sub={`${kpis.conversionPct}% conversion`} accent="var(--brand-teal-600)" />
        <StatTile label="Follow-ups overdue" value={String(kpis.overdue)} accent={kpis.overdue > 0 ? 'var(--status-danger)' : undefined} />
      </div>

      {kpis.totalLeads === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
          No leads yet. <Link href="/leads/new" style={{ color: 'var(--brand-teal)' }}>Create the first one →</Link>
        </div></div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <ChartCard title="Leads by status">
              {byStatus.map(s => (
                <Bar
                  key={s.key}
                  label={s.label}
                  pct={(s.count / maxStatus) * 100}
                  color={s.color}
                  valueLabel={`${s.count}${s.value > 0 ? ` · ${money(s.value)}` : ''}`}
                  title={`${s.label}: ${s.count} leads · ${money(s.value)}`}
                />
              ))}
            </ChartCard>

            <ChartCard title="Leads by assignee">
              {byAssignee.map(a => (
                <Bar
                  key={a.name}
                  label={a.name}
                  pct={(a.count / maxAssignee) * 100}
                  color={teal}
                  valueLabel={`${a.count}${a.value > 0 ? ` · ${money(a.value)}` : ''}`}
                  title={`${a.name}: ${a.count} leads · ${money(a.value)}`}
                />
              ))}
            </ChartCard>
          </div>

          <ChartCard title="Pipeline value by region">
            {byRegion.map(r => (
              <Bar
                key={r.label}
                label={r.label}
                pct={(r.value / maxRegion) * 100}
                color={teal}
                valueLabel={`${money(r.value)} · ${r.count}`}
                title={`${r.label}: ${money(r.value)} across ${r.count} leads`}
              />
            ))}
          </ChartCard>
        </>
      )}
    </>
  );
}
