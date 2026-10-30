import { describe, expect, it } from 'vitest';
import { focusFromMissing, parseQuickView, quickViewLink } from '@/lib/marketing/quickViewLink';

const ID = '7365d119-a38a-49e0-8b6a-405943bfe088';

describe('quickViewLink / parseQuickView', () => {
  it('round-trips a deal and the fields to fill', () => {
    const link = quickViewLink('potential', ID, ['region', 'state', 'bogus']);
    expect(link).toBe(`/marketing/opportunities?open=${ID}&kind=potential&focus=region%2Cstate`);
    expect(parseQuickView(link)).toEqual({ id: ID, kind: 'potential', focus: ['region', 'state'] });
    expect(parseQuickView({ open: ID, kind: 'opportunity' })).toEqual({ id: ID, kind: 'opportunity', focus: [] });
  });
  it('ignores anything else', () => {
    expect(parseQuickView('/leads')).toBeNull();
    expect(parseQuickView('/marketing/opportunities?open=nope&kind=opportunity')).toBeNull();
    expect(parseQuickView(`/marketing/opportunities?open=${ID}&kind=lead`)).toBeNull();
    expect(parseQuickView(null)).toBeNull();
  });
});

describe('focusFromMissing', () => {
  it('reads the notification title', () => {
    expect(focusFromMissing('Andy needs region/state')).toEqual(['region', 'state']);
    expect(focusFromMissing('X needs region/state and a way to contact them (no email or phone)')).toEqual(['region', 'state', 'contact']);
    expect(focusFromMissing('Something else')).toEqual([]);
  });
});
