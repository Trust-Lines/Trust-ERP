import { describe, expect, it } from 'vitest';
import { cleanItemInput, cleanResolution, cleanTicketInput, isRemoteAddress, rdpFile, safeFileName } from '@/lib/it/validate';
import { pageAllowed } from '@/lib/permissions/catalog';

describe('cleanTicketInput', () => {
  it('accepts a full ticket and trims text', () => {
    const r = cleanTicketInput({ subject: '  Outlook down ', category: 'email', priority: 'important', description: ' x ', neededBy: '2026-11-20' });
    expect(r.error).toBeNull();
    expect(r.value).toEqual({ subject: 'Outlook down', category: 'email', priority: 'important', description: 'x', needed_by: '2026-11-20' });
  });
  it('defaults priority to medium', () => {
    expect(cleanTicketInput({ subject: 'a', category: 'other' }).value?.priority).toBe('medium');
  });
  it('rejects missing subject, bad category, bad date', () => {
    expect(cleanTicketInput({ subject: ' ', category: 'email' }).error).toMatch(/Subject/);
    expect(cleanTicketInput({ subject: 'a', category: 'coffee' }).error).toMatch(/category/);
    expect(cleanTicketInput({ subject: 'a', category: 'email', neededBy: '2026-02-30' }).error).toMatch(/date/);
    expect(cleanTicketInput({ subject: 'a', category: 'email', priority: 'urgent' }).error).toMatch(/priority/);
  });
});

describe('cleanResolution', () => {
  it('solved needs no note; not solved needs one', () => {
    expect(cleanResolution({ status: 'solved' }).value).toEqual({ status: 'solved', note: null });
    expect(cleanResolution({ status: 'not_solved', note: '  ' }).error).toMatch(/note/);
    expect(cleanResolution({ status: 'not_solved', note: 'no part' }).value?.note).toBe('no part');
    expect(cleanResolution({ status: 'open' }).error).not.toBeNull();
  });
});

describe('cleanItemInput', () => {
  const holder = '11111111-2222-3333-4444-555555555555';
  it('keeps specs and remote address only on computers', () => {
    const pc = cleanItemInput({ name: 'PC 1', category: 'pc', specs: { cpu: 'i7', ram: ' ' }, remoteAddress: 'pc-ahmet' });
    expect(pc.value?.specs).toEqual({ cpu: 'i7' });
    expect(pc.value?.remote_address).toBe('pc-ahmet');
    const tv = cleanItemInput({ name: 'TV', category: 'tv', specs: { cpu: 'x' }, remoteAddress: 'tv' });
    expect(tv.value?.specs).toEqual({});
    expect(tv.value?.remote_address).toBeNull();
  });
  it('assigned needs a holder; other statuses drop it', () => {
    expect(cleanItemInput({ name: 'a', category: 'phone', status: 'assigned' }).error).toMatch(/holds/);
    expect(cleanItemInput({ name: 'a', category: 'phone', status: 'assigned', assigneeId: holder }).value?.assignee_id).toBe(holder);
    expect(cleanItemInput({ name: 'a', category: 'phone', status: 'repair', assigneeId: holder }).value?.assignee_id).toBeNull();
  });
  it('location must be an office', () => {
    expect(cleanItemInput({ name: 'a', category: 'tv', location: 'Istanbul' }).value?.location).toBe('Istanbul');
    expect(cleanItemInput({ name: 'a', category: 'tv', location: 'Mars' }).error).toMatch(/office/);
  });
  it('rejects a bad remote address', () => {
    expect(cleanItemInput({ name: 'a', category: 'laptop', remoteAddress: 'pc; rm -rf' }).error).toMatch(/Remote/);
  });
});

describe('remote desktop', () => {
  it('accepts names and IPs only', () => {
    expect(isRemoteAddress('pc-ahmet')).toBe(true);
    expect(isRemoteAddress('100.64.0.12')).toBe(true);
    expect(isRemoteAddress('pc-ahmet.tail1234.ts.net')).toBe(true);
    expect(isRemoteAddress('a\nfull address:s:evil')).toBe(false);
    expect(isRemoteAddress('a..b')).toBe(false);
  });
  it('builds an .rdp file that asks for credentials', () => {
    const f = rdpFile('pc-ahmet');
    expect(f).toContain('full address:s:pc-ahmet\r\n');
    expect(f).toContain('prompt for credentials:i:1');
  });
  it('makes file names safe', () => {
    expect(safeFileName('a/b:c?.png')).toBe('a_b_c_.png');
    expect(safeFileName('..')).toBe('file');
  });
});

describe('IT permissions', () => {
  it('everyone may send requests until switched off; GM / ops manage', () => {
    expect(pageAllowed('designer', {}, 'page.it_requests')).toBe(true);
    expect(pageAllowed('designer', { 'page.it_requests': false }, 'page.it_requests')).toBe(false);
    expect(pageAllowed('designer', {}, 'edit.it')).toBe(false);
    expect(pageAllowed('ops_manager', {}, 'edit.it')).toBe(true);
    expect(pageAllowed('general_manager', {}, 'page.it')).toBe(true);
  });
});
