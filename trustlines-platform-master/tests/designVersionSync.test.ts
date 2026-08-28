import { describe, it, expect } from 'vitest';
import { computeDesignVersionSyncPlan, type DropboxEntry } from '@/lib/sales/designVersionSync';

const folder = (name: string, path: string): DropboxEntry => ({ tag: 'folder', name, path_display: path });
const file = (name: string, path: string): DropboxEntry => ({ tag: 'file', name, path_display: path });

const ROOT = '/Design/T LINES/CVW/STW 1/3-Design proposal/Design Proposal';

describe('computeDesignVersionSyncPlan', () => {
  it('creates a new version for a brand-new V-folder with files', () => {
    const entries: DropboxEntry[] = [
      folder('V1', `${ROOT}/V1`),
      file('layout.pdf', `${ROOT}/V1/layout.pdf`),
      file('render.png', `${ROOT}/V1/render.png`),
    ];
    const plan = computeDesignVersionSyncPlan(entries, [], new Set());
    expect(plan.newVersions).toHaveLength(1);
    expect(plan.newVersions[0].versionNo).toBe(1);
    expect(plan.newVersions[0].files.map(f => f.name).sort()).toEqual(['layout.pdf', 'render.png']);
    expect(plan.newFilesForExisting).toHaveLength(0);
  });

  it('never duplicates a version that already exists — even if nothing changed', () => {
    const entries: DropboxEntry[] = [
      folder('V1', `${ROOT}/V1`),
      file('layout.pdf', `${ROOT}/V1/layout.pdf`),
    ];
    const plan = computeDesignVersionSyncPlan(
      entries,
      [{ id: 'ver-1', version_no: 1 }],
      new Set([`${ROOT}/V1/layout.pdf`.toLowerCase()]),
    );
    expect(plan.newVersions).toHaveLength(0);
    expect(plan.newFilesForExisting).toHaveLength(0);
  });

  it('adds a newly-dropped file to an EXISTING version instead of creating a duplicate version', () => {
    const entries: DropboxEntry[] = [
      folder('V1', `${ROOT}/V1`),
      file('layout.pdf', `${ROOT}/V1/layout.pdf`),
      file('extra-note.pdf', `${ROOT}/V1/extra-note.pdf`), // new
    ];
    const plan = computeDesignVersionSyncPlan(
      entries,
      [{ id: 'ver-1', version_no: 1 }],
      new Set([`${ROOT}/V1/layout.pdf`.toLowerCase()]),
    );
    expect(plan.newVersions).toHaveLength(0);
    expect(plan.newFilesForExisting).toHaveLength(1);
    expect(plan.newFilesForExisting[0].versionId).toBe('ver-1');
    expect(plan.newFilesForExisting[0].files.map(f => f.name)).toEqual(['extra-note.pdf']);
  });

  it('handles multiple version folders at once, sorted ascending', () => {
    const entries: DropboxEntry[] = [
      folder('V2', `${ROOT}/V2`),
      file('b.pdf', `${ROOT}/V2/b.pdf`),
      folder('V1', `${ROOT}/V1`),
      file('a.pdf', `${ROOT}/V1/a.pdf`),
    ];
    const plan = computeDesignVersionSyncPlan(entries, [], new Set());
    expect(plan.newVersions.map(v => v.versionNo)).toEqual([1, 2]);
  });

  it('assigns a file nested in a subfolder to the correct version via the longest matching prefix', () => {
    const entries: DropboxEntry[] = [
      folder('V1', `${ROOT}/V1`),
      folder('renders', `${ROOT}/V1/renders`),
      file('hero.png', `${ROOT}/V1/renders/hero.png`),
    ];
    const plan = computeDesignVersionSyncPlan(entries, [], new Set());
    expect(plan.newVersions).toHaveLength(1);
    expect(plan.newVersions[0].files[0].name).toBe('hero.png');
  });

  it('ignores non-V folders and files outside any version folder entirely', () => {
    const entries: DropboxEntry[] = [
      folder('reference', `${ROOT}/reference`),
      file('moodboard.pdf', `${ROOT}/reference/moodboard.pdf`),
      file('loose-file.pdf', `${ROOT}/loose-file.pdf`),
    ];
    const plan = computeDesignVersionSyncPlan(entries, [], new Set());
    expect(plan.newVersions).toHaveLength(0);
    expect(plan.newFilesForExisting).toHaveLength(0);
  });

  it('is case-insensitive on both the V-folder name and the tracked-file dedupe check', () => {
    const entries: DropboxEntry[] = [
      folder('v1', `${ROOT}/v1`),
      file('Layout.PDF', `${ROOT}/v1/Layout.PDF`),
    ];
    const plan = computeDesignVersionSyncPlan(
      entries, [], new Set([`${ROOT}/v1/Layout.PDF`.toLowerCase()]),
    );
    expect(plan.newVersions).toHaveLength(0); // already tracked, case-insensitively
  });
});
