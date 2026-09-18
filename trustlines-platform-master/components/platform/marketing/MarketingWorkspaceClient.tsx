'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users, Target, ArrowRight, CheckCircle2, PartyPopper } from 'lucide-react';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import type { MyDaySection } from '@/lib/dashboard/myDay';

const PAGE_SIZE = 20;

interface MyStats {
  contactsTotal: number;
  incompleteCount: number;
  unqualifiedCount: number;
  contractSignedCount: number;
  weeklyActivityCount: number;
}

interface Props {
  role: string;
  fullName: string | null;
  isManager: boolean;
  prospectCount: number | null;
  potentialCount: number | null;
  myDaySections: MyDaySection[];
  // Team-wide, real-data-gap tasks (unfollowed Potentials, Contacts with missing info,
  // missing-region records, anniversaries, upcoming events) — generated the same way for
  // everyone now, not scoped to "assigned to me" (myDaySections), which turned out to be an
  // unreliable signal. See lib/marketing/teamGaps.ts.
  teamGapSections: MyDaySection[];
  // Personal completion percentages — everything here is derived from data this person
  // already owns/is assigned (never a $ figure; marketing_pr never sees pricing).
  myStats: MyStats;
}

const ROLE_LABEL: Record<string, string> = {
  marketing_pr: 'Marketing & PR',
  marketing_manager: 'Marketing Manager',
  ops_manager: 'Ops Manager',
  general_manager: 'General Manager',
};

// Only the sections that mean something on a Marketing home page — "Waiting for your
// signature" and "Unread notifications" are generic (already on the main /dashboard for
// every role) and would just be noise repeated here.
// 🔴 2026-09-17: 'prospects_assigned' ("My Leads") dropped from this list — it isn't a task,
// it's every Contact this person has ever created/owned/been assigned (thousands for the
// account that ran the ClickUp imports), which just buried the real actionable items under a
// giant "Load More" list. That inventory already lives on the Contacts page itself.
const MARKETING_SECTION_ORDER = ['nurture_overdue', 'handoffs_waiting', 'potentials_due'];

const TONE_COLOR: Record<string, { bg: string; fg: string; dot: string }> = {
  danger:  { bg: 'var(--status-danger-bg, #fee2e2)',  fg: 'var(--status-danger, #b91c1c)',  dot: '#dc2626' },
  warn:    { bg: 'var(--status-warning-bg, #fef3c7)',  fg: 'var(--status-warning-fg, #92400e)', dot: '#d97706' },
  good:    { bg: '#dcfce7', fg: '#166534', dot: '#16a34a' },
  default: { bg: 'var(--bg-subtle)', fg: 'var(--fg-muted)', dot: 'var(--fg-faint)' },
};

function firstName(fullName: string | null): string | null {
  if (!fullName?.trim()) return null;
  return fullName.trim().split(/\s+/)[0];
}

export function MarketingWorkspaceClient({ role, fullName, isManager, prospectCount, potentialCount, myDaySections, teamGapSections, myStats }: Props) {
  const canReachSalesHandoff = SALES_HANDOFF_ROLES.includes(role);
  const name = firstName(fullName);

  const mySections = MARKETING_SECTION_ORDER
    .map(key => myDaySections.find(s => s.key === key))
    .filter((s): s is MyDaySection => !!s && s.items.length > 0);
  // Team-wide gaps first — for a manager these are the real work (their own "assigned to
  // me" list is naturally empty), so they shouldn't have to scroll past an empty-looking
  // section to find them.
  const sections = [...teamGapSections, ...mySections];
  const totalActionCount = sections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>
          {name ? `Hi ${name} — here's what needs you today` : "Here's what needs you today"}
        </h1>
        <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 3 }}>
          {ROLE_LABEL[role] ?? role} · {isManager ? 'sees every Lead and Opportunity' : 'sees Leads and Opportunities in your region'}
          {totalActionCount > 0 && ` · ${totalActionCount} to handle today`}
        </div>
      </div>

      {/* ── Top cards — direct spec (2026-09-18): incomplete Contacts %, unqualified count,
          contract-signed % (from the real Sales `projects.closed_deal_date`), completed
          projects (deferred — "soon", not wired up yet). Never a $ figure. ────── */}
      {myStats.contactsTotal > 0 && (
        <div className="card">
          <div className="card-head">
            <div style={{ fontWeight: 700, fontSize: 14 }}>Your activity</div>
            <span className="pill" style={{ background: 'var(--bg-subtle)', color: 'var(--fg-muted)' }}>
              {myStats.weeklyActivityCount} action{myStats.weeklyActivityCount === 1 ? '' : 's'} this week
            </span>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
            <StatTile
              label="Incomplete Contacts"
              hint="Missing info, out of all visible Contacts"
              value={myStats.incompleteCount}
              total={myStats.contactsTotal}
              invert
            />
            <CountTile
              label="Unqualified clients"
              hint="Every Need disqualified"
              value={myStats.unqualifiedCount}
            />
            <StatTile
              label="Contract signed"
              hint="Closed deal on a real Sales project"
              value={myStats.contractSignedCount}
              total={myStats.contactsTotal}
            />
            <SoonTile label="Completed projects" hint="Coming soon" />
          </div>
        </div>
      )}

      {/* ── Today's actions — each kind of thing gets its own card, not one big mixed list ── */}
      {sections.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 16px' }}>
            <PartyPopper size={22} style={{ color: '#16a34a', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>You&apos;re all caught up</div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                No overdue follow-ups, no potentials due, no handoffs waiting on you right now.
              </div>
            </div>
          </div>
        </div>
      ) : (
        sections.map(section => <SectionCard key={section.key} section={section} />)
      )}

      {/* ── Pipeline shortcuts ───────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-body" style={{ display: 'flex', alignItems: 'stretch', gap: 4, flexWrap: 'wrap' }}>
          <Link href="/marketing/prospects" style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', padding: '10px 12px', borderRadius: 8 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Users size={18} style={{ color: 'var(--fg-muted)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Contacts</div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>
                {prospectCount === null ? '—' : `${prospectCount} contact${prospectCount === 1 ? '' : 's'}`}
              </div>
            </div>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--fg-subtle)' }}><ArrowRight size={16} /></div>

          <Link href="/marketing/opportunities" style={{ flex: '1.3 1 220px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--brand-navy)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Target size={18} style={{ color: 'var(--brand-navy)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Potentials</div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>
                {potentialCount === null ? '—' : `${potentialCount} nurture & follow-up`}
              </div>
            </div>
          </Link>
        </div>
      </div>

      {canReachSalesHandoff && (
        <Link href="/sales-projects" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
            <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Sales Handoffs board</span>
            <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>— track Opportunities you&apos;ve handed off to Sales</span>
            <ArrowRight size={14} style={{ color: 'var(--fg-faint)', marginLeft: 'auto' }} />
          </div>
        </Link>
      )}
    </div>
  );
}

function SectionCard({ section }: { section: MyDaySection }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = section.items.slice(0, visibleCount);
  const remaining = section.items.length - visible.length;

  return (
    <div className="card">
      <div className="card-head">
        <div style={{ fontWeight: 700, fontSize: 14 }}>{section.title.replace(/\s*\(\d+\)$/, '')}</div>
        <span className="pill" style={{ background: 'var(--status-warning-bg, #fef3c7)', color: 'var(--status-warning-fg, #92400e)' }}>
          {section.items.length} to handle
        </span>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {visible.map((item, i) => {
          const tone = TONE_COLOR[item.tone ?? 'default'];
          return (
            <Link
              key={`${section.key}-${i}`}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit',
                padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: tone.dot, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                {item.sublabel && <div style={{ fontSize: 11.5, color: 'var(--fg-muted)', marginTop: 1 }}>{item.sublabel}</div>}
              </div>
              {item.badge && (
                <span className="pill" style={{ background: tone.bg, color: tone.fg, flexShrink: 0 }}>{item.badge}</span>
              )}
              <ArrowRight size={13} style={{ color: 'var(--fg-faint)', flexShrink: 0 }} />
            </Link>
          );
        })}
        {remaining > 0 && (
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 4 }}
            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
          >
            Load {Math.min(PAGE_SIZE, remaining)} more ({remaining} left)
          </button>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, hint, value, total, invert }: { label: string; hint: string; value: number; total: number; invert?: boolean }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  // `invert`: for a tile where a HIGH number is bad (e.g. "Incomplete Contacts" — you want
  // this low), flip which end of the scale reads as good/bad instead of always treating a
  // bigger percentage as better.
  const good = invert ? pct <= 20 : pct >= 80;
  const mid = invert ? pct <= 50 : pct >= 50;
  const color = good ? '#16a34a' : mid ? '#d97706' : '#dc2626';
  return (
    <div style={{
      border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 16px',
      background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-default)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 1 }}>{hint}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: '-0.02em' }}>{pct}%</span>
        <span style={{ fontSize: 11.5, color: 'var(--fg-faint)' }}>{value} of {total}</span>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: 'var(--bg-surface)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function CountTile({ label, hint, value }: { label: string; hint: string; value: number }) {
  return (
    <div style={{
      border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 16px',
      background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-default)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 1 }}>{hint}</div>
      </div>
      <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--fg-default)', letterSpacing: '-0.02em' }}>{value}</span>
    </div>
  );
}

function SoonTile({ label, hint }: { label: string; hint: string }) {
  return (
    <div style={{
      border: '1px dashed var(--border-subtle)', borderRadius: 12, padding: '14px 16px',
      background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'space-between', opacity: 0.6,
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-default)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 1 }}>{hint}</div>
      </div>
      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-faint)' }}>Soon</span>
    </div>
  );
}
