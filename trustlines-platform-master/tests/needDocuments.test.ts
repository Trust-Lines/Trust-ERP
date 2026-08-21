import { describe, it, expect, vi } from 'vitest';
import { ensureProjectForNeed, addNeedDocument, NeedDocumentError } from '@/lib/marketing/needDocuments';

vi.mock('@/lib/audit/log', () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock('@/lib/dropbox/upload', () => ({
  createProjectFolders: vi.fn(async () => ({ rootPath: '/fake', subFolders: [], alreadyExists: false })),
}));
vi.mock('@/lib/dropbox/client', () => ({
  getDropboxClient: () => ({ filesUpload: vi.fn(async ({ path }: { path: string }) => ({ result: { path_lower: path.toLowerCase() } })) }),
}));

function makeFakeAdmin(seed: Record<string, any[]> = {}) {
  const db: Record<string, any[]> = {
    prospects: [], prospect_needs: [], prospect_locations: [], prospect_need_documents: [],
    opportunities: [], prospect_potentials: [], projects: [],
    ...seed,
  };
  let idCounter = 1;
  let rpcCallCount = 0;

  function from(table: string) {
    const rows = db[table] ?? (db[table] = []);
    let filtered = rows;
    let pendingInsert: Record<string, unknown> | null = null;
    let pendingUpdate: Record<string, unknown> | null = null;

    const builder: any = {
      select: () => builder,
      eq: (f: string, v: unknown) => { filtered = filtered.filter(r => r[f] === v); return builder; },
      is: (f: string, v: unknown) => { filtered = filtered.filter(r => (v === null ? r[f] == null : r[f] === v)); return builder; },
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
    admin: {
      from,
      rpc: async (name: string) => {
        if (name === 'reserve_global_number') { rpcCallCount += 1; return { data: 100 + rpcCallCount, error: null }; }
        return { data: null, error: null };
      },
    } as any,
    db,
    rpcCallCount: () => rpcCallCount,
  };
}

const baseNeed = {
  id: 'need-1', prospect_id: 'p1', location_id: 'loc-1', scope_types: [],
  region: 'TLINES_NE', service_line: 'store_maker', state: 'NY', project_id: null,
};

describe('ensureProjectForNeed', () => {
  it('reserves a real project number and creates a Dropbox folder exactly once', async () => {
    const { admin, db, rpcCallCount } = makeFakeAdmin({
      prospect_needs: [{ ...baseNeed }],
      prospects: [{ id: 'p1', display_name: 'ZZTEST Acme', organization_name: 'ZZTEST Acme' }],
      prospect_locations: [{ id: 'loc-1', city: 'Austin' }],
    });

    const project = await ensureProjectForNeed(admin, 'need-1', 'u1');

    expect(project).toBeTruthy();
    expect(rpcCallCount()).toBe(1);
    expect(db.projects).toHaveLength(1);
    expect((project as { dropbox_root_path: string }).dropbox_root_path).toMatch(/^\/Marketing\//);
    expect((project as { dropbox_root_path: string }).dropbox_root_path).not.toContain('/D-Projects/');
    expect(db.prospect_needs[0].project_id).toBe(db.projects[0].id);
  });

  it('is idempotent — a second call never reserves a second number or creates a second project', async () => {
    const { admin, db, rpcCallCount } = makeFakeAdmin({
      prospect_needs: [{ ...baseNeed }],
      prospects: [{ id: 'p1', display_name: 'ZZTEST Acme', organization_name: 'ZZTEST Acme' }],
      prospect_locations: [{ id: 'loc-1', city: 'Austin' }],
    });

    await ensureProjectForNeed(admin, 'need-1', 'u1');
    await ensureProjectForNeed(admin, 'need-1', 'u1');

    expect(rpcCallCount()).toBe(1);
    expect(db.projects).toHaveLength(1);
  });

  it('refuses to create a project when region/service_line/state are not all set', async () => {
    const { admin } = makeFakeAdmin({
      prospect_needs: [{ ...baseNeed, region: null }],
      prospects: [{ id: 'p1', display_name: 'ZZTEST Acme' }],
      prospect_locations: [{ id: 'loc-1', city: 'Austin' }],
    });

    await expect(ensureProjectForNeed(admin, 'need-1', 'u1')).rejects.toThrow(NeedDocumentError);
  });

  it('refuses when the linked Location has no city set', async () => {
    const { admin } = makeFakeAdmin({
      prospect_needs: [{ ...baseNeed }],
      prospects: [{ id: 'p1', display_name: 'ZZTEST Acme' }],
      prospect_locations: [{ id: 'loc-1', city: null }],
    });

    await expect(ensureProjectForNeed(admin, 'need-1', 'u1')).rejects.toThrow(NeedDocumentError);
  });
});

describe('addNeedDocument — the Opportunity signal', () => {
  it('a link attached to a fully-set-up Need promotes it to Opportunity and links the new Project onto both the Need and the Opportunity', async () => {
    const { admin, db } = makeFakeAdmin({
      prospect_needs: [{ ...baseNeed, has_active_project: null, deadline: null, expected_start_date: null, layout_available: null, timing: null, project_types: [], title: 'Need', source: null, target_contact_date: null }],
      prospects: [{ id: 'p1', display_name: 'ZZTEST Acme', organization_name: 'ZZTEST Acme', owner_id: null, assigned_marketing_user_id: null }],
      prospect_locations: [{ id: 'loc-1', city: 'Austin' }],
    });

    const result = await addNeedDocument(admin, 'need-1', 'u1', { category: 'matterport', url: 'https://matterport.example/tour' });

    expect(result.sync.needClassification).toBe('opportunity');
    expect(result.project).toBeTruthy();
    expect(db.prospect_needs[0].project_id).toBe(result.project!.id);
    expect(db.opportunities).toHaveLength(1);
    expect(db.opportunities[0].project_id).toBe(result.project!.id);
    expect(db.opportunities[0].region).toBe('TLINES_NE');
  });

  it('rejects a file upload when region/service_line/state are not set yet', async () => {
    const { admin } = makeFakeAdmin({
      prospect_needs: [{ ...baseNeed, region: null }],
      prospects: [{ id: 'p1', display_name: 'ZZTEST Acme' }],
      prospect_locations: [{ id: 'loc-1', city: 'Austin' }],
    });

    await expect(addNeedDocument(admin, 'need-1', 'u1', { category: 'layout', file: { name: 'plan.pdf', buffer: Buffer.from('x') } }))
      .rejects.toThrow(NeedDocumentError);
  });
});
