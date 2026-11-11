import { describe, expect, it } from 'vitest';
import { PF_SIGN_OPTIONS, PO_SIGN_OPTIONS, STATUS_OPTIONS, currentFirst, normalizeSign, poRollup, signStyle, statusStyle } from '@/lib/production/statuses';

describe('production tracker statuses (Trust System rules)', () => {
  it('lists the Trust dropdowns in their order', () => {
    expect(STATUS_OPTIONS.map(o => o.label)).toEqual([
      'HOLD / T', 'HOLD / PM', 'HOLD BOOKS', 'NOT ORDERED', 'TO ORDER', 'BOOKS IN PROGRESS', 'ORDERED', 'WAITING PAYMENT',
      'ASSEMBLY', 'READY TO RECEIVE', 'RECEIVED', 'READY', 'SENT TO TLINES', 'PARTIAL SENT', 'SENT',
    ]);
    expect(PF_SIGN_OPTIONS.map(o => o.value)).toEqual(['NOT_SIGNED', 'READY_TO_SIGN', 'SIGNED', 'WAITING_T_TO_SIGN', 'SIGNED_WITH_EST_PRICE']);
    expect(PO_SIGN_OPTIONS.map(o => o.value)).toEqual(['NOT_SIGNED', 'READY_TO_SIGN', 'SIGNED', 'WAITING_TLINES_TO_SIGN', 'WAITING_T_TO_SIGN']);
  });

  it('fills cells with the Trust colours', () => {
    expect(statusStyle('NOT_ORDERED')).toMatchObject({ bg: '#dc2626', fg: '#ffffff' });
    expect(statusStyle('HOLD / T')).toMatchObject({ label: 'HOLD / T', bg: '#ffffff' });
    expect(signStyle('NOT_SIGNED')).toMatchObject({ bg: '#ff0000', fg: '#000000' });
    expect(signStyle('WAITING T TO SIGN').bg).toBe('#a78bfa');
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
