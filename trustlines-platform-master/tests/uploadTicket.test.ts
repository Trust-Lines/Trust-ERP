import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signUploadTicket, verifyUploadTicket } from '@/lib/design/uploadTicket';

describe('upload tickets — only the path an upload-link step picked can be written', () => {
  const before = process.env.UPLOAD_TICKET_SECRET;
  beforeEach(() => { process.env.UPLOAD_TICKET_SECRET = 'test-secret'; });
  afterEach(() => { process.env.UPLOAD_TICKET_SECRET = before; });

  it('gives back the signed path', () => {
    expect(verifyUploadTicket(signUploadTicket('/Design/Library/CAD Blocks/a.dxf'))).toBe('/Design/Library/CAD Blocks/a.dxf');
  });

  it('refuses a tampered, expired or non-Design ticket', () => {
    const t = signUploadTicket('/Design/Library/a.dxf');
    const [payload, mac] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ p: '/Accounting/x.pdf', e: Date.now() + 1e6 })).toString('base64url');
    expect(verifyUploadTicket(`${forged}.${mac}`)).toBeNull();
    expect(verifyUploadTicket(`${payload}.x${mac.slice(1)}`)).toBeNull();
    expect(verifyUploadTicket(signUploadTicket('/Design/a.dxf', Date.now() - 7 * 3600e3))).toBeNull();
    expect(verifyUploadTicket(signUploadTicket('/Accounting/x.pdf'))).toBeNull();
    expect(verifyUploadTicket(null)).toBeNull();
  });
});
