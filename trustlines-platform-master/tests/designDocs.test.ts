import { describe, it, expect, vi } from 'vitest';
import { filesToLink, linkDesignFilesToProject, type DesignFile } from '@/lib/sales/designDocs';

vi.mock('@/lib/audit/log', () => ({ logAudit: vi.fn(async () => {}) }));

const f = (path: string, name = path.split('/').pop()!): DesignFile => ({ dropbox_path: path, file_name: name });

describe('filesToLink — idempotent pointer selection', () => {
  it('links files the project does not already have', () => {
    const out = filesToLink([f('/a.pdf'), f('/b.pdf')], [{ dropbox_path: '/a.pdf' }]);
    expect(out.map(x => x.dropbox_path)).toEqual(['/b.pdf']);
  });

  it('is a no-op when everything is already linked (re-approval safe)', () => {
    expect(filesToLink([f('/a.pdf')], [{ dropbox_path: '/a.pdf' }])).toEqual([]);
  });

  it('de-duplicates the same path listed twice in the input', () => {
    expect(filesToLink([f('/a.pdf'), f('/a.pdf')], [])).toHaveLength(1);
  });

  it('ignores an empty dropbox_path', () => {
    expect(filesToLink([{ dropbox_path: '', file_name: 'x' }], [])).toEqual([]);
  });

  it('links all when the project has none', () => {
    expect(filesToLink([f('/a.pdf'), f('/b.pdf')], [])).toHaveLength(2);
  });
});

function fakeDb(seed: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = { sales_design_version_files: [], documents: [], audit_log: [], ...seed };
  return {
    tables,
    from(table: string) {
      const eqs: [string, any][] = [];
      const q: any = {
        select: () => q,
        eq: (c: string, v: any) => { eqs.push([c, v]); return q; },
        limit: () => q,
        then: (res: any) => Promise.resolve({ data: (tables[table] ?? []).filter(r => eqs.every(([c, v]) => r[c] === v)), error: null }).then(res),
        insert: async (rows: any) => { for (const r of (Array.isArray(rows) ? rows : [rows])) tables[table].push(r); return { error: null }; },
      };
      return q;
    },
  } as any;
}

describe('linkDesignFilesToProject', () => {
  it('creates sales_design pointers with the EXISTING dropbox path (never moves the file)', async () => {
    const db = fakeDb({
      sales_design_version_files: [
        { version_id: 'v1', dropbox_path: '/Design/STW/final.pdf', file_name: 'final.pdf' },
        { version_id: 'v1', dropbox_path: '/Design/STW/detail.pdf', file_name: 'detail.pdf' },
      ],
    });
    const n = await linkDesignFilesToProject(db, 'v1', 'p1', 'u1');
    expect(n).toBe(2);
    const docs = db.tables.documents;
    expect(docs).toHaveLength(2);
    expect(docs.every((d: any) => d.doc_type === 'sales_design')).toBe(true);
    expect(docs.every((d: any) => d.project_id === 'p1')).toBe(true);
    expect(docs.map((d: any) => d.dropbox_path)).toEqual(['/Design/STW/final.pdf', '/Design/STW/detail.pdf']);
  });

  it('is idempotent — a second call adds nothing', async () => {
    const db = fakeDb({
      sales_design_version_files: [{ version_id: 'v1', dropbox_path: '/x.pdf', file_name: 'x.pdf' }],
    });
    await linkDesignFilesToProject(db, 'v1', 'p1', 'u1');
    const second = await linkDesignFilesToProject(db, 'v1', 'p1', 'u1');
    expect(second).toBe(0);
    expect(db.tables.documents).toHaveLength(1);
  });

  it('returns 0 when the version has no files', async () => {
    const db = fakeDb();
    expect(await linkDesignFilesToProject(db, 'v1', 'p1', 'u1')).toBe(0);
  });
});
