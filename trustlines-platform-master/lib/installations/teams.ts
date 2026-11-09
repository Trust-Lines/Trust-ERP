import { BRANCHES } from './compute';

/** A team form from the browser → the row to store, or an error. */
export function cleanTeam(body: Record<string, unknown>, partial: boolean):
  { team: Record<string, unknown> } | { error: string } {
  const out: Record<string, unknown> = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);

  if (!partial || has('name')) {
    const name = String(body.name ?? '').trim().replace(/\s+/g, ' ');
    if (!name) return { error: 'Give the team a name' };
    if (name.length > 60) return { error: 'Team name is too long' };
    out.name = name;
  }
  if (has('branch')) {
    const b = body.branch == null || body.branch === '' ? null : String(body.branch).toUpperCase();
    if (b !== null && !(BRANCHES as readonly string[]).includes(b)) return { error: 'Branch must be NE, SE, NW or CVW' };
    out.branch = b;
  }
  if (has('members')) {
    if (!Array.isArray(body.members)) return { error: 'Members must be a list' };
    const seen = new Set<string>();
    const members: string[] = [];
    for (const m of body.members) {
      const n = String(m ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      if (n && !seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); members.push(n); }
    }
    if (members.length > 40) return { error: 'Too many members' };
    out.members = members;
  }
  if (has('size')) {
    if (body.size == null || body.size === '') out.size = null;
    else {
      const n = Number(body.size);
      if (!Number.isInteger(n) || n < 0 || n > 500) return { error: 'Head count must be a whole number' };
      out.size = n;
    }
  }
  if (has('notes')) out.notes = body.notes == null ? null : String(body.notes).trim().slice(0, 1000) || null;
  if (has('active')) out.active = body.active !== false;
  return { team: out };
}
