'use client';

import Link from 'next/link';
import { Users, Target, Clock, ArrowRight, CheckCircle2, PartyPopper } from 'lucide-react';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import type { MyDaySection } from '@/lib/dashboard/myDay';

interface Props {
  role: string;
  fullName: string | null;
  isManager: boolean;
  prospectCount: number | null;
  opportunityCount: number | null;
  potentialCount: number | null;
  myDaySections: MyDaySection[];
  // Manager-only: team-wide gaps (unfollowed Potentials, missing-region records) — a
  // manager doesn't personally own Leads, so myDaySections ("assigned to me") is always
  // empty for them even when the team has real work sitting untouched. See
  // lib/marketing/teamGaps.ts.
  teamGapSections: MyDaySection[];
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
const MARKETING_SECTION_ORDER = ['nurture_overdue', 'handoffs_waiting', 'potentials_due', 'prospects_assigned'];

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

export function MarketingWorkspaceClient({ role, fullName, isManager, prospectCount, opportunityCount, potentialCount, myDaySections, teamGapSections }: Props) {
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
        </div>
      </div>

      {/* ── Today's actions — the real work, pulled straight from My Day ────────── */}
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
        <div className="card">
          <div className="card-head">
            <div style={{ fontWeight: 700, fontSize: 14 }}>Today&apos;s actions</div>
            <span className="pill" style={{ background: 'var(--status-warning-bg, #fef3c7)', color: 'var(--status-warning-fg, #92400e)' }}>
              {totalActionCount} to handle
            </span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {sections.map(section => (
              <div key={section.key}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                  {section.title}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {section.items.map((item, i) => {
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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pipeline shortcuts ───────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-body" style={{ display: 'flex', alignItems: 'stretch', gap: 4, flexWrap: 'wrap' }}>
          <Link href="/marketing/prospects" style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', padding: '10px 12px', borderRadius: 8 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Users size={18} style={{ color: 'var(--fg-muted)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Lead Cloud</div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>
                {prospectCount === null ? '—' : `${prospectCount} lead${prospectCount === 1 ? '' : 's'}`}
              </div>
            </div>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--fg-subtle)' }}><ArrowRight size={16} /></div>

          {/* Points straight at Opportunities (where the Potential column actually lives) —
              /marketing/potentials is only a redirect back to this same page, so linking to it
              here was a click that pretended to go somewhere and didn't. */}
          <Link href="/marketing/opportunities" style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', padding: '10px 12px', borderRadius: 8 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Clock size={18} style={{ color: 'var(--fg-muted)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Potentials</div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>
                {potentialCount === null ? '—' : `${potentialCount} nurture & follow-up`}
              </div>
            </div>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--fg-subtle)' }}><ArrowRight size={16} /></div>

          <Link href="/marketing/opportunities" style={{ flex: '1.3 1 220px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--brand-navy)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Target size={18} style={{ color: 'var(--brand-navy)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Opportunities</div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>
                {opportunityCount === null ? '—' : `${opportunityCount} — primary business list`}
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
