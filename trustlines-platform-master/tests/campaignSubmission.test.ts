import { describe, it, expect, vi } from 'vitest';
import { processSurveySubmission, parsePublicSurveyBody, SubmissionValidationError } from '@/lib/marketing/campaignSubmission';
import type { MarketingCampaign } from '@/types/database';

vi.mock('@/lib/audit/log', () => ({ logAudit: vi.fn(async () => {}) }));

 
function makeFakeAdmin(seed: Record<string, any[]> = {}) {
   
  const db: Record<string, any[]> = {
    prospects: [], prospect_contacts: [], prospect_locations: [], prospect_needs: [],
    prospect_need_documents: [], opportunities: [], prospect_potentials: [],
    marketing_campaigns: [], survey_submissions: [], campaign_interactions: [],
    ...seed,
  };
  let idCounter = 1;

  function from(table: string) {
    const rows = db[table] ?? (db[table] = []);
    let filtered = rows;
     
    let pendingInsert: Record<string, unknown> | null = null;
    let pendingUpdate: Record<string, unknown> | null = null;

     
    const builder: any = {
      select: () => builder,
      eq: (f: string, v: unknown) => { filtered = filtered.filter(r => r[f] === v); return builder; },
      is: (f: string, v: unknown) => { filtered = filtered.filter(r => (v === null ? r[f] == null : r[f] === v)); return builder; },
      in: (f: string, vs: unknown[]) => { filtered = filtered.filter(r => vs.includes(r[f])); return builder; },
      not: (f: string, _op: string, v: string) => { const excl = v.replace(/[()]/g, '').split(','); filtered = filtered.filter(r => !excl.includes(r[f] as string)); return builder; },
      limit: (n: number) => { filtered = filtered.slice(0, n); return builder; },
      order: () => builder,
      insert: (row: Record<string, unknown>) => {
        pendingInsert = { id: `${table}-${idCounter++}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row };
        return builder;
      },
      update: (patch: Record<string, unknown>) => { pendingUpdate = patch; return builder; },
      maybeSingle: async () => {
        if (pendingInsert) { rows.push(pendingInsert); return { data: pendingInsert, error: null }; }
        if (pendingUpdate) { filtered.forEach(r => Object.assign(r, pendingUpdate)); const t = filtered[0]; return { data: t ?? null, error: null }; }
        return { data: filtered[0] ?? null, error: null };
      },
      single: async () => builder.maybeSingle(),
      then: (resolve: (v: { data: unknown; error: null }) => void) => {
        if (pendingInsert) { rows.push(pendingInsert); resolve({ data: [pendingInsert], error: null }); return; }
        if (pendingUpdate) { filtered.forEach(r => Object.assign(r, pendingUpdate)); resolve({ data: filtered, error: null }); return; }
        resolve({ data: filtered, error: null });
      },
    };
    return builder;
  }

  return {
     
    admin: { from } as any,
    db,
  };
}

const baseCampaign: MarketingCampaign = {
  id: 'camp-1', name: 'ZZTEST Atlanta Expo', code: 'ATL26', slug: 'zztest-atlanta-expo',
  campaign_type: 'trade_fair', source: 'trade_fair', city: 'Atlanta', state: 'GA', country: 'US', venue: null,
  description: null, start_date: null, end_date: null, default_language: 'en',
  owner_user_id: 'owner-1', status: 'active', public_title: null, public_description: null,
  consent_text_version: 'v1', survey_template: 'none', created_by: 'owner-1', created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z', closed_at: null, deleted_at: null,
};

const validBody = {
  leadType: 'organization', organizationName: 'ZZTEST Acme Retail', firstName: 'Jane', lastName: 'Doe',
  email: 'jane@zztest-acme.example', phone: '+1 212 555 0100', city: 'Atlanta', state: 'GA',
  consentAccepted: true, consentTextVersion: 'v1',
};

describe('parsePublicSurveyBody', () => {
  it('only extracts the fixed whitelist — never reads source/campaignId/ownerId/classification/status', () => {
    const dto = parsePublicSurveyBody({
      ...validBody, source: 'referral', campaignId: 'other-campaign', ownerId: 'someone-else',
      classification: 'opportunity_candidate', status: 'converted',
    });
    expect((dto as Record<string, unknown>).source).toBeUndefined();
    expect((dto as Record<string, unknown>).campaignId).toBeUndefined();
    expect((dto as Record<string, unknown>).ownerId).toBeUndefined();
    expect((dto as Record<string, unknown>).classification).toBeUndefined();
    expect((dto as Record<string, unknown>).status).toBeUndefined();
    expect(dto.organizationName).toBe('ZZTEST Acme Retail');
  });
});

describe('processSurveySubmission — new Prospect path', () => {
  it('creates a new Prospect + Need, attributes source/campaign, and runs real classification', async () => {
    const { admin, db } = makeFakeAdmin();

    const outcome = await processSurveySubmission(admin, baseCampaign, validBody);

    expect(outcome.status).toBe('processed');
    expect(db.prospects).toHaveLength(1);
    const prospect = db.prospects[0];
    expect(prospect.organization_name).toBe('ZZTEST Acme Retail');
    expect(prospect.source_label).toBe('trade_fair');
    expect(prospect.campaign_id).toBe('camp-1');
    expect(prospect.latest_source_label).toBe('trade_fair');
    expect(prospect.latest_campaign_id).toBe('camp-1');

    expect(db.prospect_needs).toHaveLength(1);
    expect(db.prospect_needs[0].classification).toBe('potential');
    expect(db.prospect_potentials).toHaveLength(1);

    expect(db.campaign_interactions).toHaveLength(1);
    expect(db.campaign_interactions[0].prospect_id).toBe(prospect.id);
    expect(db.campaign_interactions[0].survey_submission_id).toBe(outcome.submissionId);

    expect(db.survey_submissions).toHaveLength(1);
    expect(db.survey_submissions[0].normalized_email).toBe('jane@zztest-acme.example');
  });
});

describe('processSurveySubmission — existing Prospect path', () => {
  it('reuses the existing Prospect, never overwrites Original Source, only updates Latest Source/Campaign', async () => {
    const { admin, db } = makeFakeAdmin({
      prospects: [{
        id: 'p-existing', entity_type: 'organization', organization_name: 'ZZTEST Acme Retail',
        main_email: 'jane@zztest-acme.example', main_phone: null,
        source_label: 'website', campaign_id: 'old-campaign-1',
        latest_source_label: 'website', latest_campaign_id: 'old-campaign-1',
        deleted_at: null,
      }],
    });

    const outcome = await processSurveySubmission(admin, baseCampaign, validBody);

    expect(outcome.status).toBe('processed');
    expect(db.prospects).toHaveLength(1);
    const prospect = db.prospects[0];
    expect(prospect.source_label).toBe('website');
    expect(prospect.campaign_id).toBe('old-campaign-1');
    expect(prospect.latest_source_label).toBe('trade_fair');
    expect(prospect.latest_campaign_id).toBe('camp-1');
  });

  it('fills an empty phone but never overwrites an existing one', async () => {
    const { admin, db } = makeFakeAdmin({
      prospects: [{
        id: 'p-existing', entity_type: 'organization', organization_name: 'ZZTEST Acme Retail',
        main_email: 'jane@zztest-acme.example', main_phone: '+1 999 999 9999',
        source_label: 'website', campaign_id: null, deleted_at: null,
      }],
    });

    await processSurveySubmission(admin, baseCampaign, validBody);

    expect(db.prospects[0].main_phone).toBe('+1 999 999 9999');
  });
});

describe('processSurveySubmission — idempotency', () => {
  it('a repeated submissionToken returns the same result without creating a second Prospect/Need', async () => {
    const { admin, db } = makeFakeAdmin();
    const body = { ...validBody, submissionToken: 'tok-abc123' };

    const first = await processSurveySubmission(admin, baseCampaign, body);
    const second = await processSurveySubmission(admin, baseCampaign, body);

    expect(second.submissionId).toBe(first.submissionId);
    expect(db.prospects).toHaveLength(1);
    expect(db.prospect_needs).toHaveLength(1);
    expect(db.survey_submissions).toHaveLength(1);
  });
});

describe('processSurveySubmission — ambiguous match', () => {
  it('never guesses between conflicting Prospect matches — records NEEDS_REVIEW instead', async () => {
    const { admin, db } = makeFakeAdmin({
      prospects: [
        { id: 'p-a', organization_name: 'A', main_email: 'jane@zztest-acme.example', main_phone: null, deleted_at: null },
        { id: 'p-b', organization_name: 'B', main_email: null, main_phone: '12125550100', deleted_at: null },
      ],
    });

    const outcome = await processSurveySubmission(admin, baseCampaign, validBody);

    expect(outcome.status).toBe('needs_review');
    expect(db.prospect_needs).toHaveLength(0);
    expect(db.survey_submissions).toHaveLength(1);
    expect(db.survey_submissions[0].status).toBe('needs_review');
  });
});

describe('processSurveySubmission — consent gate', () => {
  it('rejects with a validation error and creates no rows when consent is not accepted', async () => {
    const { admin, db } = makeFakeAdmin();
    const body = { ...validBody, consentAccepted: false };

    await expect(processSurveySubmission(admin, baseCampaign, body)).rejects.toThrow(SubmissionValidationError);
    expect(db.prospects).toHaveLength(0);
    expect(db.survey_submissions).toHaveLength(0);
  });
});

describe('processSurveySubmission — honeypot', () => {
  it('records rejected_spam and never creates Prospect/Need data', async () => {
    const { admin, db } = makeFakeAdmin();
    const body = { ...validBody, honeypot: 'i-am-a-bot' };

    const outcome = await processSurveySubmission(admin, baseCampaign, body);

    expect(outcome.status).toBe('rejected_spam');
    expect(db.prospects).toHaveLength(0);
    expect(db.prospect_needs).toHaveLength(0);
    expect(db.survey_submissions).toHaveLength(1);
    expect(db.survey_submissions[0].status).toBe('rejected_spam');
  });
});
