import { describe, expect, it } from 'vitest';
import { addressFromName, brandFromDropboxPath, trustRowInfo } from '@/lib/projects/listInfo';
import type { TrustProject } from '@/lib/trust/board';

describe('projects list info', () => {
  it('reads the brand from the Dropbox client folder', () => {
    expect(brandFromDropboxPath('/D-Projects/T LINES/1-Store Maker/T Lines SE Projects/Under Working/Clients/Mountain View Gas/STSE 500 - Cumming, GA')).toBe('Mountain View Gas');
    expect(brandFromDropboxPath('/Design/Pre-Project/abc')).toBeNull();
    expect(brandFromDropboxPath(null)).toBeNull();
  });

  it('drops the code from the project name to leave the address', () => {
    expect(addressFromName('STSE 500 - Cumming, 1620 Buford Dam Rd, GA', 'STSE 500')).toBe('Cumming, 1620 Buford Dam Rd, GA');
    expect(addressFromName('Brew Oil', 'STNW 1')).toBe('Brew Oil');
  });

  it('gives the Trust stage, one status per type and the latest ETD', () => {
    const p = {
      id: 't', projectNo: '490', name: 'X', address: null, bucket: 'TLINES_NE', status: 'PRE_PROJECT', types: null, createdAt: '2026-01-01', deletedAt: null,
      items: [
        { type: 'MILLWORK', status: 'ORDERED', pfCode: 'PF', containerNo: null, containerDate: null, etd: '2026-12-01T00:00:00Z' },
        { type: 'IMAGE', status: 'NOT_ORDERED', pfCode: null, containerNo: null, containerDate: null, etd: '2026-11-15' },
      ],
    } as unknown as TrustProject;
    expect(trustRowInfo(p, '2026-11-03')).toEqual({
      stage: 'in_production', onHold: false, etd: '2026-12-01',
      types: [{ type: 'Millwork', status: 'Ordered' }, { type: 'Image', status: 'Not ordered' }],
    });
  });
});
