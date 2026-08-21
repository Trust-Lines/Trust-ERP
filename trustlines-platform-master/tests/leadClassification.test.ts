import { describe, it, expect } from 'vitest';
import {
  classifyLead, CLASSIFICATION_TO_STATUS, STATUS_TO_CLASSIFICATION, LEAD_CLASSIFICATION_LABEL,
  PROJECT_TYPES, SCOPE_TYPES, SOURCES, TIMINGS,
} from '@/lib/marketing/classification';
import { DEFAULT_PERMISSIONS } from '@/lib/permissions/catalog';

const BLANK = {
  hasActiveProject: null, deadline: null, expectedStartDate: null, projectTypes: [],
  locationCount: null, futureExpansion: false, layoutAvailable: null, timing: null,
  hasDocumentEvidence: false,
};

describe('classifyLead — Opportunity Candidate signal (v2: document evidence only)', () => {
  it('document evidence alone is enough', () => {
    const r = classifyLead({ ...BLANK, hasDocumentEvidence: true });
    expect(r.classification).toBe('opportunity_candidate');
    expect(r.reasons).toEqual(expect.arrayContaining([expect.stringContaining('document')]));
  });

  it('recommends handoff to Sales as the next action', () => {
    const r = classifyLead({ ...BLANK, hasDocumentEvidence: true });
    expect(r.recommendedNextAction.toLowerCase()).toContain('sales');
  });

  it('an active project alone is NOT enough anymore', () => {
    expect(classifyLead({ ...BLANK, hasActiveProject: true }).classification).not.toBe('opportunity_candidate');
  });

  it('a deadline alone is NOT enough anymore, no matter how near or far', () => {
    expect(classifyLead({ ...BLANK, deadline: '2026-12-01' }).classification).not.toBe('opportunity_candidate');
    expect(classifyLead({ ...BLANK, deadline: '2030-01-01' }).classification).not.toBe('opportunity_candidate');
  });

  it('a selected project type alone is NOT enough anymore', () => {
    expect(classifyLead({ ...BLANK, projectTypes: ['full_remodel'] }).classification).not.toBe('opportunity_candidate');
  });

  it('layout/drawings-available (the old Yes/No toggle) alone is NOT enough anymore', () => {
    expect(classifyLead({ ...BLANK, layoutAvailable: true }).classification).not.toBe('opportunity_candidate');
  });
});

describe('classifyLead — Potential signals (no active-need signal present)', () => {
  it('a location count > 0 with no active-project signal → Potential', () => {
    const r = classifyLead({ ...BLANK, locationCount: 3 });
    expect(r.classification).toBe('potential');
  });

  it('future expansion indicated → Potential', () => {
    const r = classifyLead({ ...BLANK, futureExpansion: true });
    expect(r.classification).toBe('potential');
  });

  it('"contact later" timing → Potential', () => {
    const r = classifyLead({ ...BLANK, timing: 'contact_later' });
    expect(r.classification).toBe('potential');
  });

  it('6-12 or 12+ month timing → Potential', () => {
    expect(classifyLead({ ...BLANK, timing: '6_12_months' }).classification).toBe('potential');
    expect(classifyLead({ ...BLANK, timing: '12_plus_months' }).classification).toBe('potential');
  });

  it('recommends nurture as the next action', () => {
    const r = classifyLead({ ...BLANK, locationCount: 2 });
    expect(r.recommendedNextAction.toLowerCase()).toContain('nurture');
  });
});

describe('classifyLead — no signals at all still means Potential, never a separate "Lead" state', () => {
  it('no signals at all → Potential, with an explanatory reason', () => {
    const r = classifyLead(BLANK);
    expect(r.classification).toBe('potential');
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('"no current project" / "immediate"/"0-3 months" timing alone still means Potential, not Opportunity', () => {
    expect(classifyLead({ ...BLANK, timing: 'no_current_project' }).classification).toBe('potential');
    expect(classifyLead({ ...BLANK, timing: 'immediate' }).classification).toBe('potential');
  });
});

describe('classifyLead — never auto-suggests Disqualified', () => {
  it('no combination of inputs produces "disqualified" — that is human-only', () => {
    const combos = [
      BLANK,
      { ...BLANK, hasActiveProject: true },
      { ...BLANK, locationCount: 5, futureExpansion: true },
      { ...BLANK, timing: 'immediate' as const },
    ];
    for (const input of combos) expect(classifyLead(input).classification).not.toBe('disqualified');
  });
});

describe('classification ↔ status mapping (reuses the existing ProspectStatus enum)', () => {
  it('is a consistent round trip for the 4 wizard classifications', () => {
    for (const c of ['lead', 'potential', 'opportunity_candidate', 'disqualified'] as const) {
      const status = CLASSIFICATION_TO_STATUS[c];
      expect(STATUS_TO_CLASSIFICATION[status]).toBe(c);
    }
  });

  it('every ProspectStatus value maps to a real label', () => {
    for (const status of Object.keys(STATUS_TO_CLASSIFICATION) as (keyof typeof STATUS_TO_CLASSIFICATION)[]) {
      expect(LEAD_CLASSIFICATION_LABEL[STATUS_TO_CLASSIFICATION[status]]).toBeTruthy();
    }
  });
});

describe('wizard vocabulary matches the instruction exactly', () => {
  it('sources', () => {
    expect(SOURCES.sort()).toEqual([
      'cold_outreach', 'event', 'existing_customer', 'instagram', 'linkedin',
      'other', 'partner', 'referral', 'trade_fair', 'website',
    ].sort());
  });
  it('project types', () => {
    expect(PROJECT_TYPES.sort()).toEqual(['bid', 'full_remodel', 'new_construction', 'small_remodel'].sort());
  });
  it('scope types', () => {
    expect(SCOPE_TYPES.sort()).toEqual([
      'ceiling', 'decoration', 'furniture', 'graphic', 'image', 'millwork', 'shelving', 'shop_drawing',
    ].sort());
  });
  it('timing buckets', () => {
    expect(TIMINGS.sort()).toEqual([
      '0_3_months', '12_plus_months', '3_6_months', '6_12_months',
      'contact_later', 'immediate', 'no_current_project',
    ].sort());
  });
});

describe('marketing roles are unaffected by the Lead Capture redesign', () => {
  it('marketing_pr / marketing_manager still have exactly the same page/edit grants', () => {
    expect(DEFAULT_PERMISSIONS.marketing_pr).toEqual({ 'page.dashboard': true, 'page.marketing': true, 'page.marketing_campaigns': true, 'page.notifications': true, 'page.settings': true, 'edit.marketing': true });
    expect(DEFAULT_PERMISSIONS.marketing_manager).toEqual({ 'page.dashboard': true, 'page.marketing': true, 'page.marketing_campaigns': true, 'page.notifications': true, 'page.settings': true, 'edit.marketing': true });
  });
});
