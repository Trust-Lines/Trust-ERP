import { describe, it, expect } from 'vitest';
import { canAccessLead } from '@/lib/sales/leadAccess';

type Lead = { created_by: string | null; assignee_id: string | null; region?: string | null } | null;

function fakeAdmin(lead: Lead, tasks: { id: string }[] = [], assignedRegions: string[] = []) {
  return {
    from(table: string) {
      if (table === 'lead_intake') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: lead }) }) }) };
      }
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { assigned_regions: assignedRegions } }) }) }) };
      }
      return { select: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: tasks }) }) }) }) };
    },
  };
}

const ME = 'user-me';
const OTHER = 'user-other';

describe('canAccessLead', () => {
  it('lets a manager reach any lead without querying ownership', async () => {
    const admin = fakeAdmin({ created_by: OTHER, assignee_id: OTHER });
    expect(await canAccessLead(admin, 'lead-1', ME, 'sales_marketing_manager')).toBe(true);
    expect(await canAccessLead(admin, 'lead-1', ME, 'ops_manager')).toBe(true);
    expect(await canAccessLead(admin, 'lead-1', ME, 'general_manager')).toBe(true);
  });

  it('lets a rep reach a lead they created', async () => {
    const admin = fakeAdmin({ created_by: ME, assignee_id: OTHER });
    expect(await canAccessLead(admin, 'lead-1', ME, 'sales_rep')).toBe(true);
  });

  it('lets a rep reach a lead assigned to them', async () => {
    const admin = fakeAdmin({ created_by: OTHER, assignee_id: ME });
    expect(await canAccessLead(admin, 'lead-1', ME, 'sales_rep')).toBe(true);
  });

  it('lets a rep reach a lead where they only have a subtask assigned', async () => {
    const admin = fakeAdmin({ created_by: OTHER, assignee_id: OTHER }, [{ id: 'task-1' }]);
    expect(await canAccessLead(admin, 'lead-1', ME, 'sales_rep')).toBe(true);
  });

  it('blocks a rep with no relationship to the lead', async () => {
    const admin = fakeAdmin({ created_by: OTHER, assignee_id: OTHER }, []);
    expect(await canAccessLead(admin, 'lead-1', ME, 'sales_rep')).toBe(false);
  });

  it('lets a rep reach an id that has no row yet (not-yet-created draft)', async () => {
    const admin = fakeAdmin(null);
    expect(await canAccessLead(admin, 'missing', ME, 'sales_rep')).toBe(true);
  });

  it('blocks an unknown role outright', async () => {
    const admin = fakeAdmin({ created_by: OTHER, assignee_id: OTHER }, []);
    expect(await canAccessLead(admin, 'lead-1', ME, 'tlines_pm')).toBe(false);
  });
});

describe('canAccessLead — region-based visibility (CRM Faz 4)', () => {
  it('lets a region-scoped rep reach a lead in their region they neither created nor own', async () => {
    const admin = fakeAdmin({ created_by: OTHER, assignee_id: OTHER, region: 'TLINES_NE' }, [], ['TLINES_NE']);
    expect(await canAccessLead(admin, 'lead-1', ME, 'sales_rep')).toBe(true);
  });

  it('blocks a region-scoped rep from a lead in a DIFFERENT region, even one they created', async () => {
    const admin = fakeAdmin({ created_by: ME, assignee_id: ME, region: 'TLINES_SE' }, [], ['TLINES_NE']);
    expect(await canAccessLead(admin, 'lead-1', ME, 'sales_rep')).toBe(false);
  });

  it('blocks a region-scoped rep from a lead with NO region set yet', async () => {
    const admin = fakeAdmin({ created_by: OTHER, assignee_id: OTHER, region: null }, [], ['TLINES_NE']);
    expect(await canAccessLead(admin, 'lead-1', ME, 'sales_rep')).toBe(false);
  });

  it('falls back to the ownership rule when the rep has no assigned region yet', async () => {
    const admin = fakeAdmin({ created_by: ME, assignee_id: OTHER, region: 'TLINES_SE' }, [], []);
    expect(await canAccessLead(admin, 'lead-1', ME, 'sales_rep')).toBe(true);
  });
});
