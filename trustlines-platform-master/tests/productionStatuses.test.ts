import { describe, expect, it } from 'vitest';
import { PF_SIGN_OPTIONS, PO_SIGN_OPTIONS, STATUS_OPTIONS, currentFirst, normalizeSign, poRollup, signStyle, statusStyle } from '@/lib/production/statuses';

describe('production tracker statuses (Trust System rules)', () => {
  it('lists the Trust dropdowns in their order', () => {
    expect(STATUS_OPTIONS.map(o => o.label)).toEqual([
      'Hold / T', 'Hold / PM', 'Hold Books', 'Not Ordered', 'To Order', 'Books in Progress', 'Ordered', 'Waiting Payment',
      'Assembly', 'Ready to Receive', 'Received', 'Ready', 'Sent to T-Lines', 'Partial Sent', 'Sent',
    ]);
    expect(PF_SIGN_OPTIONS.map(o => o.value)).toEqual(['NOT_SIGNED', 'READY_TO_SIGN', 'SIGNED', 'WAITING_T_TO_SIGN', 'SIGNED_WITH_EST_PRICE']);
    expect(PO_SIGN_OPTIONS.map(o => o.value)).toEqual(['NOT_SIGNED', 'READY_TO_SIGN', 'SIGNED', 'WAITING_TLINES_TO_SIGN', 'WAITING_T_TO_SIGN']);
  });

  it('uses the Figma Status Chip tones and icons (theme tokens)', () => {
    expect(statusStyle('NOT_ORDERED')).toMatchObject({ tone: 't10', icon: 'circle-off', bg: 'var(--status-t10-bg)', fg: 'var(--status-t10-fg)' });
    expect(statusStyle('HOLD / T')).toMatchObject({ label: 'Hold / T', tone: 'n1', icon: 'pause' });
    expect(statusStyle('PARTIAL_SENT')).toMatchObject({ tone: 'n9', icon: 'circle-dashed-check' });
    expect(signStyle('NOT_SIGNED')).toMatchObject({ label: 'Not Signed', tone: 't10' });
    expect(signStyle('WAITING T TO SIGN')).toMatchObject({ tone: 't7', icon: 'hourglass' });
    expect(signStyle('Waiting T Lines to sign').value).toBe('WAITING_TLINES_TO_SIGN');
  });

  it('reads old signed values as SIGNED', () => {
    expect(normalizeSign('SIGNED_NO_PRICE')).toBe('SIGNED');
    expect(normalizeSign('SIGNED_WITH_PRICE')).toBe('SIGNED');
    expect(normalizeSign(null)).toBe('NOT_SIGNED');
  });

  it('rolls a type group up to one PO value', () => {
    expect(poRollup(['SIGNED', 'SIGNED'])).toBe('SIGNED');
    expect(poRollup(['SIGNED', 'READY_TO_SIGN', 'WAITING_T_TO_SIGN'])).toBe('WAITING_T_TO_SIGN');
    expect(poRollup(['WAITING_T_TO_SIGN', 'WAITING_TLINES_TO_SIGN'])).toBe('WAITING_TLINES_TO_SIGN');
    expect(poRollup(['SIGNED', 'READY_TO_SIGN'])).toBe('READY_TO_SIGN');
    expect(poRollup(['SIGNED', 'NOT_SIGNED'])).toBe('NOT_SIGNED');
  });

  it('puts the current value first', () => {
    expect(currentFirst(PF_SIGN_OPTIONS, 'SIGNED').map(o => o.value)[0]).toBe('SIGNED');
  });
});
