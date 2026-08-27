'use client';

import Link from 'next/link';
import { Megaphone, Users, Target, CalendarClock, Radio, Clock, ArrowRight, Send, CheckCircle2 } from 'lucide-react';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';

interface Props {
  role: string;
  isManager: boolean;
  prospectCount: number | null;
  opportunityCount: number | null;
  potentialCount: number | null;
  migration078Applied: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  marketing_pr: 'Marketing & PR',
  marketing_manager: 'Marketing Manager',
  ops_manager: 'Ops Manager',
  general_manager: 'General Manager',
};

export function MarketingWorkspaceClient({ role, isManager, prospectCount, opportunityCount, potentialCount, migration078Applied }: Props) {
  const canReachSalesHandoff = SALES_HANDOFF_ROLES.includes(role);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="card-head">
          <Megaphone size={18} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Marketing</div>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
              Signed in as <strong>{ROLE_LABEL[role] ?? role}</strong>
              {isManager ? ' — sees every Lead and Opportunity' : ' — sees leads/opportunities you created or are assigned to'}
            </div>
          </div>
          <span className="pill" style={{ background: 'var(--bg-subtle)', color: 'var(--fg-muted)' }}>
            Opportunities live — Phase 00.5
          </span>
        </div>
        <div className="card-body">
          <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
            Classification is fully automatic — there is no manual Lead/Potential/Opportunity
            selector anywhere in Marketing. An Opportunity is created and kept in sync by the
            system the moment a Lead&apos;s answers meet the Opportunity Candidate rules, and put
            on hold (never deleted) if they stop qualifying. Nothing here creates a project,
            reserves a project number, or touches Dropbox — that only happens once Sales accepts.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ display: 'flex', alignItems: 'stretch', gap: 4, flexWrap: 'wrap' }}>
          <Link href="/marketing/prospects" style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', padding: '10px 12px', borderRadius: 8 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Users size={18} style={{ color: 'var(--fg-muted)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Lead Cloud</div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>
                {prospectCount === null ? 'Migrations 072/073 needed' : `${prospectCount} lead${prospectCount === 1 ? '' : 's'}`}
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
                {potentialCount === null ? 'Migration 076 needed' : `${potentialCount} nurture & follow-up`}
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
                {opportunityCount === null ? 'Migration 075 needed' : `${opportunityCount} — primary business list`}
              </div>
            </div>
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        <div className="card">
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {migration078Applied ? <CheckCircle2 size={16} style={{ color: '#14532d' }} /> : <Send size={16} style={{ color: 'var(--fg-muted)' }} />}
              <span style={{ fontWeight: 600, fontSize: 13 }}>Sales Handoff</span>
              {migration078Applied ? (
                <span className="pill" style={{ marginLeft: 'auto', background: '#bbf7d0', color: '#14532d' }}>
                  Live — full pipeline
                </span>
              ) : (
                <span className="pill" style={{ marginLeft: 'auto', background: 'var(--status-warning-bg, #fef3c7)', color: 'var(--status-warning-fg, #92400e)' }}>
                  Migration 078 pending
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-muted)', lineHeight: 1.55 }}>
              {migration078Applied ? (
                <>Hand off, Accept, Return, Close Won and Close Lost are all live end-to-end. Once
                Sales accepts, the project/project-number/Dropbox creation happens for real — Sales
                works the handoff from their own board.</>
              ) : (
                <>&quot;Hand off to Sales&quot; already works from an Opportunity. Accept/Return/Close Won/Close
                Lost, and the project/project-number/Dropbox creation that only happens once Sales
                accepts, are built too — Sales sees them on their own Handoffs board. The one thing
                missing is applying migration 078 to the live database.</>
              )}
            </p>
            {canReachSalesHandoff && (
              <Link href="/sales-projects" className="pill" style={{ alignSelf: 'flex-start', background: 'var(--bg-subtle)', color: 'var(--brand-navy)', textDecoration: 'none' }}>
                Open Sales Handoffs board →
              </Link>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Radio size={16} style={{ color: 'var(--fg-muted)' }} />
              <span style={{ fontWeight: 600, fontSize: 13 }}>Sources, Campaigns & Events</span>
              <span className="pill" style={{ marginLeft: 'auto', background: 'var(--bg-subtle)', color: 'var(--fg-muted)' }}>
                Phase 00.6
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-muted)', lineHeight: 1.55 }}>
              Trade-show/website/referral attribution, kept all the way through to Closed Won — the
              tablet/kiosk event intake (Phase 00.7) writes into this. Not started yet.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <CalendarClock size={16} />
          <div style={{ fontWeight: 600, fontSize: 13 }}>My Day sections (already wired)</div>
        </div>
        <div className="card-body">
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
            Your Dashboard&apos;s My Day lists four Marketing sections. <strong>My Leads</strong>,
            <strong> Potentials due for contact</strong>, and <strong>overdue nurture follow-ups</strong> all
            show real data now.{' '}
            {migration078Applied
              ? <><strong>Opportunity handoffs waiting on Marketing</strong> shows real data too.</>
              : <><strong>Opportunity handoffs waiting on Marketing</strong> is real code too — it shows a &quot;Phase 00.5&quot; placeholder only until migration 078 is applied.</>}
          </p>
        </div>
      </div>
    </div>
  );
}
