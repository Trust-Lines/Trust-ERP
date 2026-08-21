import { describe, it, expect } from 'vitest';
import {
  createCampaign, updateCampaign, setCampaignStatus, computeCampaignStats,
  publicSurveyUrl, publicSurveyPath, CampaignError,
} from '@/lib/marketing/campaigns';

 
function makeFakeAdmin(seed: Record<string, any[]> = {}) {
   
  const db: Record<string, any[]> = {
    marketing_campaigns: [], survey_submissions: [], prospects: [], prospect_needs: [],
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
      or: () => builder,
      order: () => builder,
      limit: (n: number) => { filtered = filtered.slice(0, n); return builder; },
      insert: (row: Record<string, unknown>) => {
        pendingInsert = { id: `row-${idCounter++}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row };
        return builder;
      },
      update: (patch: Record<string, unknown>) => { pendingUpdate = patch; return builder; },
      maybeSingle: async () => {
        if (pendingInsert) { rows.push(pendingInsert); return { data: pendingInsert, error: null }; }
        if (pendingUpdate) { filtered.forEach(r => Object.assign(r, pendingUpdate)); return { data: filtered[0] ?? null, error: null }; }
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

   
  return { admin: { from } as any, db };
}

describe('publicSurveyUrl / publicSurveyPath', () => {
  it('builds {base}/survey/{slug} from env, never hardcoding a domain', () => {
    const prevSurvey = process.env.NEXT_PUBLIC_SURVEY_BASE_URL;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_SURVEY_BASE_URL = 'https://external.trust-lines.com/';
    expect(publicSurveyUrl('atlanta-build-expo-2026')).toBe('https://external.trust-lines.com/survey/atlanta-build-expo-2026');
    expect(publicSurveyPath('atlanta-build-expo-2026')).toBe('/survey/atlanta-build-expo-2026');
    process.env.NEXT_PUBLIC_SURVEY_BASE_URL = prevSurvey;
    process.env.NEXT_PUBLIC_APP_URL = prevApp;
  });
});

describe('createCampaign', () => {
  it('creates a DRAFT campaign with a generated, unique slug', async () => {
    const { admin, db } = makeFakeAdmin();
    const campaign = await createCampaign(admin, {
      name: 'ZZTEST Atlanta Expo', campaignType: 'trade_fair', source: 'trade_fair',
    }, 'user-1');

    expect(campaign.status).toBe('draft');
    expect(campaign.slug).toBe('zztest-atlanta-expo');
    expect(db.marketing_campaigns).toHaveLength(1);
  });

  it('rejects an empty name', async () => {
    const { admin } = makeFakeAdmin();
    await expect(createCampaign(admin, { name: '  ', campaignType: 'trade_fair', source: 'trade_fair' }, 'user-1'))
      .rejects.toThrow(CampaignError);
  });
});

describe('updateCampaign', () => {
  it('rejects any edit once the campaign is CLOSED', async () => {
    const { admin } = makeFakeAdmin({
      marketing_campaigns: [{ id: 'c1', name: 'X', status: 'closed', deleted_at: null }],
    });
    await expect(updateCampaign(admin, 'c1', { name: 'Y' })).rejects.toThrow(CampaignError);
  });

  it('never lets slug be set via the update path (no `slug` field is even accepted)', async () => {
    const { admin, db } = makeFakeAdmin({
      marketing_campaigns: [{ id: 'c1', name: 'X', slug: 'x-slug', status: 'draft', deleted_at: null }],
    });
    await updateCampaign(admin, 'c1', { name: 'Renamed' });
    expect(db.marketing_campaigns[0].slug).toBe('x-slug');
    expect(db.marketing_campaigns[0].name).toBe('Renamed');
  });
});

describe('setCampaignStatus', () => {
  it('allows draft → active', async () => {
    const { admin } = makeFakeAdmin({ marketing_campaigns: [{ id: 'c1', status: 'draft', deleted_at: null }] });
    const c = await setCampaignStatus(admin, 'c1', 'active');
    expect(c.status).toBe('active');
  });

  it('rejects draft → paused (must go through active first)', async () => {
    const { admin } = makeFakeAdmin({ marketing_campaigns: [{ id: 'c1', status: 'draft', deleted_at: null }] });
    await expect(setCampaignStatus(admin, 'c1', 'paused')).rejects.toThrow(CampaignError);
  });

  it('rejects any transition out of closed — terminal state', async () => {
    const { admin } = makeFakeAdmin({ marketing_campaigns: [{ id: 'c1', status: 'closed', deleted_at: null }] });
    await expect(setCampaignStatus(admin, 'c1', 'active')).rejects.toThrow(CampaignError);
  });

  it('sets closed_at when closing', async () => {
    const { admin } = makeFakeAdmin({ marketing_campaigns: [{ id: 'c1', status: 'active', deleted_at: null }] });
    const c = await setCampaignStatus(admin, 'c1', 'closed');
    expect(c.status).toBe('closed');
    expect(c.closed_at).toBeTruthy();
  });
});

describe('computeCampaignStats', () => {
  it('derives new-vs-existing prospect counts from prospects.campaign_id (the ORIGINAL touch)', async () => {
    const { admin } = makeFakeAdmin({
      survey_submissions: [
        { id: 's1', campaign_id: 'c1', status: 'processed', prospect_id: 'p-new', need_id: 'n1' },
        { id: 's2', campaign_id: 'c1', status: 'processed', prospect_id: 'p-old', need_id: 'n2' },
        { id: 's3', campaign_id: 'c1', status: 'needs_review', prospect_id: null, need_id: null },
        { id: 's4', campaign_id: 'c1', status: 'rejected_spam', prospect_id: null, need_id: null },
      ],
      prospects: [
        { id: 'p-new', campaign_id: 'c1' },
        { id: 'p-old', campaign_id: 'c0' },
      ],
      prospect_needs: [
        { id: 'n1', classification: 'opportunity' },
        { id: 'n2', classification: 'potential' },
      ],
    });

    const stats = await computeCampaignStats(admin, 'c1');

    expect(stats.totalSubmissions).toBe(4);
    expect(stats.newProspects).toBe(1);
    expect(stats.existingProspects).toBe(1);
    expect(stats.needsCreated).toBe(2);
    expect(stats.needsReview).toBe(1);
    expect(stats.rejectedSpam).toBe(1);
    expect(stats.opportunities).toBe(1);
    expect(stats.potentials).toBe(1);
    expect(stats.conversionRate).toBe(25);
  });

  it('returns all zeros for a campaign with no submissions, no division-by-zero crash', async () => {
    const { admin } = makeFakeAdmin();
    const stats = await computeCampaignStats(admin, 'c-empty');
    expect(stats.totalSubmissions).toBe(0);
    expect(stats.conversionRate).toBe(0);
  });
});
