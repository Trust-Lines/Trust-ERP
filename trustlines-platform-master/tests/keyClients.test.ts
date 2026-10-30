import { describe, expect, it } from 'vitest';
import { buildMatcher, nameTokens, projectNumber, type KeyClientDef } from '@/lib/keyClients/match';

const CLIENTS: KeyClientDef[] = [
  { id: 'teddy', name: 'Teddy', aliases: ["Teddy's", 'Teddy/Cosmos'] },
  { id: 'ta', name: 'TA', aliases: ['TA Adirondak', 'Frontier Town Gateway'] },
  { id: 'hispeed', name: 'HISPEED', aliases: ['Hi Speed'] },
  { id: 'park', name: 'PARK & GO', aliases: ['Park and Go'] },
  { id: 'prov', name: 'Provisions', aliases: ['Provision'] },
  { id: 'jerry', name: 'Jerrys Market', aliases: ["Jerry's Market"] },
];

describe('nameTokens', () => {
  it('normalizes case, punctuation, possessives, & and plurals', () => {
    expect(nameTokens("Teddy's")).toEqual(['teddy']);
    expect(nameTokens('TEDDYS')).toEqual(['teddy']);
    expect(nameTokens('PARK & GO')).toEqual(['park', 'and', 'go']);
    expect(nameTokens('HISPEED- Honey Bear')).toEqual(['hispeed', 'honey', 'bear']);
    expect(nameTokens('  ')).toEqual([]);
  });
});

describe('buildMatcher.byName', () => {
  const m = buildMatcher(CLIENTS);
  it('matches a name that starts with the client, word for word', () => {
    expect(m.byName("Teddy's")?.id).toBe('teddy');
    expect(m.byName('TEDDY /COSMOS')?.id).toBe('teddy');
    expect(m.byName('HISPEED- Honey Bear')?.id).toBe('hispeed');
    expect(m.byName('Park and Go')?.id).toBe('park');
    expect(m.byName('Provision')?.id).toBe('prov');
    expect(m.byName("Jerry's Market")?.id).toBe('jerry');
    expect(m.byName('Frontier Town Gateway')?.id).toBe('ta');
    expect(m.byName('TA Junction')?.id).toBe('ta');
  });
  it('does not match on a shared first letters or a word in the middle', () => {
    expect(m.byName("Tabo's piggly wiggly")).toBeNull();
    expect(m.byName('Teddybear Inc')).toBeNull();
    expect(m.byName('Best Hub Market')).toBeNull();
    expect(m.byName(null, undefined, '')).toBeNull();
  });
  it('tries every name given (brand, then the prospect names)', () => {
    expect(m.byName('Unknown brand', 'Teddy Inc')?.id).toBe('teddy');
  });
});

describe('buildMatcher.forOpportunity — manual links win', () => {
  const opp = { id: 'o1', prospect_id: 'p1', brand: 'Some Gas Station' };
  it('includes an Opportunity whose name does not match', () => {
    const m = buildMatcher(CLIENTS, [{ key_client_id: 'ta', opportunity_id: 'o1', prospect_id: null, mode: 'include' }]);
    expect(m.forOpportunity(opp, [])?.id).toBe('ta');
  });
  it('includes every Opportunity of a linked Prospect', () => {
    const m = buildMatcher(CLIENTS, [{ key_client_id: 'teddy', opportunity_id: null, prospect_id: 'p1', mode: 'include' }]);
    expect(m.forOpportunity(opp, [])?.id).toBe('teddy');
  });
  it('excludes a name match that is not really the client', () => {
    const named = { id: 'o2', prospect_id: 'p2', brand: 'Teddy' };
    expect(buildMatcher(CLIENTS).forOpportunity(named, [])?.id).toBe('teddy');
    expect(buildMatcher(CLIENTS, [{ key_client_id: 'teddy', opportunity_id: 'o2', prospect_id: null, mode: 'exclude' }]).forOpportunity(named, [])).toBeNull();
    expect(buildMatcher(CLIENTS, [{ key_client_id: 'teddy', opportunity_id: null, prospect_id: 'p2', mode: 'exclude' }]).forOpportunity(named, [])).toBeNull();
  });
});

describe('projectNumber', () => {
  it('pulls the sheet number out of the ClickUp project code', () => {
    expect(projectNumber('STSE507')).toBe('507');
    expect(projectNumber('442-NW')).toBe('442');
    expect(projectNumber('#330-EXT2')).toBe('330');
    expect(projectNumber(null)).toBeNull();
  });
});

describe('buildMatcher — Potentials and explicit includes', () => {
  it('links on a Potential work like links on an Opportunity', () => {
    const m = buildMatcher(CLIENTS, [{ key_client_id: 'teddy', opportunity_id: null, potential_id: 'pot1', prospect_id: null, mode: 'include' }]);
    expect(m.forOpportunity({ id: 'pot1', prospect_id: 'p9', brand: 'Amin Ali + Nizar' }, [])?.id).toBe('teddy');
    expect(m.includedItem('pot1')).toBe(true);
    expect(m.includedItem('other')).toBe(false);
  });
  it('a Prospect-level include is not an item include (the WAITING rule still applies)', () => {
    const m = buildMatcher(CLIENTS, [{ key_client_id: 'teddy', opportunity_id: null, prospect_id: 'p1', mode: 'include' }]);
    expect(m.includedItem('o1')).toBe(false);
  });
});
