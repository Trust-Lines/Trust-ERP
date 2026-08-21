
import { SKILLS, type Skill, type Department } from '@/lib/profile/metadata';

export const TEAM_TYPES = ['Millwork', 'Shelving', 'Ceiling', 'Image', 'Furniture', 'Decoration'] as const;
export type TeamType = (typeof TEAM_TYPES)[number];

const TYPE_SKILL: Record<TeamType, Skill> = {
  Millwork: 'millwork', Shelving: 'shelving', Ceiling: 'ceiling',
  Image: 'image', Furniture: 'furniture', Decoration: 'decoration',
};

export const skillForType = (type: string): Skill | null =>
  (TEAM_TYPES as readonly string[]).includes(type) ? TYPE_SKILL[type as TeamType] : null;

const TYPE_FALLBACK_DEPARTMENTS: Record<string, Department[]> = {
  Millwork:   ['design', 'production', 'supply'],
  Shelving:   ['design', 'production', 'supply'],
  Ceiling:    ['design', 'production', 'supply'],
  Image:      ['design', 'production', 'supply'],
  Furniture:  ['design', 'production', 'supply'],
  Decoration: ['design', 'production', 'supply'],
};

export interface TeamCandidate {
  id: string;
  full_name: string;
  role: string;
  skills: string[] | null;
  department: string | null;
}

export interface TeamPerson {
  id: string;
  full_name: string;
  role: string;
  reasons: string[];
}

export interface ProjectRoles {
  ops_manager?:   { id: string; full_name: string } | null;
  trustlines_pm?: { id: string; full_name: string } | null;
  tlines_pm?:     { id: string; full_name: string } | null;
  prod_pm_ms?:    { id: string; full_name: string } | null;
  prod_pm_ci?:    { id: string; full_name: string } | null;
  qc_inspector?:  { id: string; full_name: string } | null;
  pm_supervisor?: { id: string; full_name: string } | null;
}

const FIXED_LABELS: [keyof ProjectRoles, string][] = [
  ['ops_manager',   'Ops Manager'],
  ['trustlines_pm', 'Trust-Lines PM'],
  ['tlines_pm',     'T-Lines PM'],
  ['prod_pm_ms',    'Production PM · Millwork & Shelving'],
  ['prod_pm_ci',    'Production PM · Ceiling & Image'],
  ['qc_inspector',  'QC Inspector'],
  ['pm_supervisor', 'PM Supervisor'],
];

const isSkill = (v: unknown): v is Skill => SKILLS.includes(v as Skill);

function coversType(c: TeamCandidate, type: string): boolean {
  const want = skillForType(type);
  if (!want) return false;
  const skills = (c.skills ?? []).filter(isSkill);
  if (skills.length > 0) return skills.includes(want);
  const depts = TYPE_FALLBACK_DEPARTMENTS[type] ?? [];
  return !!c.department && (depts as string[]).includes(c.department);
}

export function deriveTeam(roles: ProjectRoles, types: string[], candidates: TeamCandidate[]): TeamPerson[] {
  const byUser = new Map<string, TeamPerson>();
  const add = (id: string | null | undefined, full_name: string, role: string, reason: string) => {
    if (!id) return;
    const hit = byUser.get(id);
    if (hit) { if (!hit.reasons.includes(reason)) hit.reasons.push(reason); }
    else byUser.set(id, { id, full_name, role, reasons: [reason] });
  };

  for (const [key, label] of FIXED_LABELS) {
    const p = roles[key];
    if (p) add(p.id, p.full_name, key, label);
  }

  const seenTypes = new Set<string>();
  for (const type of types) {
    if (seenTypes.has(type)) continue;
    seenTypes.add(type);
    for (const c of candidates) {
      if (coversType(c, type)) add(c.id, c.full_name, c.role, type);
    }
  }

  const fixedIds = new Set(FIXED_LABELS.map(([k]) => roles[k]?.id).filter(Boolean) as string[]);
  return [...byUser.values()].sort((a, b) => {
    const af = fixedIds.has(a.id) ? 0 : 1;
    const bf = fixedIds.has(b.id) ? 0 : 1;
    return af - bf || a.full_name.localeCompare(b.full_name);
  });
}

export function skillsForTypes(types: string[]): Skill[] {
  const out = new Set<Skill>();
  for (const t of types) { const s = skillForType(t); if (s) out.add(s); }
  return [...out];
}
