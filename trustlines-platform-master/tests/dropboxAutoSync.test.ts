import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { buildTargets, isDesignVersionPath, packCursor, projectForPath, unpackCursor, validWebhookSignature, versionOf } from '@/lib/dropbox/autoSync';

const ROOT = '/D-Projects/T LINES/1-Store Maker/T Lines NW Projects/Under Working/Clients/Brew Oil/STNW 395 - Stuart, IA';

describe('versionOf', () => {
  const t = { basePath: '/P/3-Production & Delivery/Millwork', pdfSubfolder: '2-Item Plan/PDF' };
  it('reads the version of a PDF in the right subfolder', () => {
    expect(versionOf('/p/3-production & delivery/millwork/v3/2-item plan/pdf/plan.pdf', t)).toBe(3);
    expect(versionOf('/P/3-Production & Delivery/Millwork/V12/2-Item Plan/PDF/a/b.PDF', t)).toBe(12);
  });
  it('skips other folders, non-PDFs and files outside a version folder', () => {
    expect(versionOf('/p/3-production & delivery/millwork/v3/2-item plan/dwg/plan.pdf', t)).toBeNull();
    expect(versionOf('/p/3-production & delivery/millwork/v3/2-item plan/pdf/plan.dwg', t)).toBeNull();
    expect(versionOf('/p/3-production & delivery/millwork/2-item plan/pdf/plan.pdf', t)).toBeNull();
    expect(versionOf('/p/3-production & delivery/millworkx/v3/2-item plan/pdf/plan.pdf', t)).toBeNull();
  });
});

describe('buildTargets', () => {
  it('covers the project-level steps under the root', () => {
    const ts = buildTargets(ROOT);
    expect(ts.length).toBeGreaterThan(3);
    expect(ts.every(t => t.basePath.startsWith(ROOT + '/'))).toBe(true);
    expect(ts.map(t => t.docType)).toEqual(expect.arrayContaining(['plan_layout', 'proposal', 'construction_drawings', 'item_plan', 'po_bo']));
  });
});

describe('projectForPath', () => {
  const roots = [
    { id: 'a', root: '/D-Projects/Clients/X/STNE 409 - Town' },
    { id: 'b', root: '/D-Projects/Clients/X/STNE 409 - Town/Sub' },
    { id: 'c', root: '/D-Projects/Clients/X/STNE 40' },
  ];
  it('matches case-insensitively, longest root first', () => {
    expect(projectForPath('/d-projects/clients/x/stne 409 - town/v1/a.pdf', roots)).toBe('a');
    expect(projectForPath('/d-projects/clients/x/stne 409 - town/sub/a.pdf', roots)).toBe('b');
  });
  it('does not match a root that is only a name prefix', () => {
    expect(projectForPath('/d-projects/clients/x/stne 40/a.pdf', roots)).toBe('c');
    expect(projectForPath('/d-projects/clients/x/stne 4091/a.pdf', roots)).toBeNull();
  });
});

describe('validWebhookSignature', () => {
  const body = '{"list_folder":{"accounts":["dbid:1"]}}';
  const sig = createHmac('sha256', 'shh').update(body).digest('hex');
  it('accepts the HMAC of the body', () => expect(validWebhookSignature(body, sig, 'shh')).toBe(true));
  it('rejects a wrong / missing signature or secret', () => {
    expect(validWebhookSignature(body + ' ', sig, 'shh')).toBe(false);
    expect(validWebhookSignature(body, 'abc', 'shh')).toBe(false);
    expect(validWebhookSignature(body, null, 'shh')).toBe(false);
    expect(validWebhookSignature(body, sig, undefined)).toBe(false);
  });
});

describe('cursor tagging', () => {
  it('round-trips a cursor for the same root', () => {
    expect(unpackCursor(packCursor('', 'AAA'), '')).toBe('AAA');
    expect(unpackCursor(packCursor('/D-Projects', 'BBB'), '/D-Projects')).toBe('BBB');
  });
  it('starts over for another root or an untagged cursor', () => {
    expect(unpackCursor(packCursor('/D-Projects', 'BBB'), '')).toBeNull();
    expect(unpackCursor('AAAA-untagged', '')).toBeNull();
    expect(unpackCursor(null, '')).toBeNull();
  });
});

describe('isDesignVersionPath', () => {
  it('matches files in a design job version area only', () => {
    expect(isDesignVersionPath('/design/t lines/x/stne 409/3-design proposal/design proposal/v2/a.pdf')).toBe(true);
    expect(isDesignVersionPath('/design/pre-project/ab12 - x/3-design proposal/design proposal/v1/a.jpg')).toBe(true);
    expect(isDesignVersionPath('/d-projects/t lines/x/3-design proposal/design proposal/v1/a.pdf')).toBe(false);
    expect(isDesignVersionPath('/design/t lines/x/1-plan layout/1-pdf/a.pdf')).toBe(false);
  });
});
