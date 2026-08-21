import { describe, it, expect } from 'vitest';
import { deriveTeam, skillForType, skillsForTypes, type TeamCandidate, type ProjectRoles } from '@/lib/team/derive';

const cand = (o: Partial<TeamCandidate> & { id: string }): TeamCandidate =>
  ({ full_name: o.id, role: 'designer', skills: null, department: null, ...o });

describe('skillForType', () => {
  it('maps each type to its discipline', () => {
    expect(skillForType('Millwork')).toBe('millwork');
    expect(skillForType('Image')).toBe('image');
    expect(skillForType('Ceiling')).toBe('ceiling');
  });
  it('is null for an unknown type (and case matters)', () => {
    expect(skillForType('millwork')).toBeNull();
    expect(skillForType('Plumbing')).toBeNull();
  });
});

describe('deriveTeam — fixed roles', () => {
  it('always includes the fixed PMs with their labels', () => {
    const roles: ProjectRoles = {
      trustlines_pm: { id: 'tp', full_name: 'Trust PM' },
      tlines_pm: { id: 'cp', full_name: 'Client PM' },
    };
    const team = deriveTeam(roles, [], []);
    expect(team.map(p => p.id).sort()).toEqual(['cp', 'tp']);
    expect(team.find(p => p.id === 'tp')!.reasons).toEqual(['Trust-Lines PM']);
  });

  it('returns nobody for an empty project', () => {
    expect(deriveTeam({}, [], [])).toEqual([]);
  });
});

describe('deriveTeam — skill match (primary)', () => {
  it('adds a person whose skill matches a project type, under the type name', () => {
    const team = deriveTeam({}, ['Millwork'], [
      cand({ id: 'a', skills: ['millwork'] }),
      cand({ id: 'b', skills: ['ceiling'] }),
    ]);
    expect(team.map(p => p.id)).toEqual(['a']);
    expect(team[0].reasons).toEqual(['Millwork']);
  });

  it('a multi-skilled person matches on each relevant type, with one row', () => {
    const team = deriveTeam({}, ['Millwork', 'Image'], [
      cand({ id: 'a', skills: ['millwork', 'image'] }),
    ]);
    expect(team).toHaveLength(1);
    expect(team[0].reasons.sort()).toEqual(['Image', 'Millwork']);
  });

  it('once someone HAS skills, they are NOT added by department fallback for a skill they lack', () => {
    const team = deriveTeam({}, ['Ceiling'], [
      cand({ id: 'a', skills: ['millwork'], department: 'design' }),
    ]);
    expect(team).toEqual([]);
  });
});

describe('deriveTeam — department fallback (skills empty)', () => {
  it('includes a person with NO skills but a matching department', () => {
    const team = deriveTeam({}, ['Millwork'], [
      cand({ id: 'a', skills: [], department: 'design' }),
      cand({ id: 'b', skills: null, department: 'production' }),
      cand({ id: 'c', skills: null, department: 'accounting' }),
    ]);
    expect(team.map(p => p.id).sort()).toEqual(['a', 'b']);
    expect(team.find(p => p.id === 'a')!.reasons).toEqual(['Millwork']);
  });

  it('does not invent members when nobody is relevant', () => {
    const team = deriveTeam({}, ['Millwork'], [cand({ id: 'a', skills: [], department: 'accounting' })]);
    expect(team).toEqual([]);
  });
});

describe('deriveTeam — dedup + ordering', () => {
  it('a fixed PM who also matches a type appears ONCE with both reasons', () => {
    const team = deriveTeam(
      { trustlines_pm: { id: 'x', full_name: 'X' } },
      ['Millwork'],
      [cand({ id: 'x', skills: ['millwork'] })],
    );
    expect(team).toHaveLength(1);
    expect(team[0].reasons.sort()).toEqual(['Millwork', 'Trust-Lines PM']);
  });

  it('puts fixed-role people before skill-matched people', () => {
    const team = deriveTeam(
      { trustlines_pm: { id: 'pm', full_name: 'ZZZ PM' } },
      ['Millwork'],
      [cand({ id: 'aaa', full_name: 'AAA', skills: ['millwork'] })],
    );
    expect(team[0].id).toBe('pm');
    expect(team[1].id).toBe('aaa');
  });
});

describe('skillsForTypes', () => {
  it('collects the skills a set of types needs, deduped', () => {
    expect(skillsForTypes(['Millwork', 'Image', 'Millwork']).sort()).toEqual(['image', 'millwork']);
  });
  it('ignores unknown types', () => {
    expect(skillsForTypes(['Plumbing'])).toEqual([]);
  });
});
