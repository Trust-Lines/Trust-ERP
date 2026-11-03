// Project numbers. Sales sets where numbering starts (Sales Team → next number, the global counter
// of migration 035); every new project then takes the next number from there that isn't already
// in use anywhere — our projects, the ClickUp project numbers on Opportunities / Potentials, and
// the Trust System's projects (finished ones too). A used number is skipped, never given twice.
import { loadTrustProjects } from '@/lib/trust/board';
import { projectNumber } from '@/lib/keyClients/match';

/* eslint-disable @typescript-eslint/no-explicit-any */

export class ProjectNumberError extends Error {}

async function readAll(admin: any, table: string, col: string): Promise<(string | null)[]> {
  const out: (string | null)[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(col).not(col, 'is', null).range(from, from + 999);
    if (error) throw new ProjectNumberError(`${table}: ${error.message}`);
    out.push(...(data ?? []).map((r: Record<string, string | null>) => r[col]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Every project number already in use. Throws when the Trust System can't be read — a number
 *  picked without it could already be a Trust project's. */
export async function usedProjectNumbers(admin: any): Promise<Set<number>> {
  const [projects, opps, pots, trust] = await Promise.all([
    readAll(admin, 'projects', 'code'),
    readAll(admin, 'opportunities', 'external_project_code'),
    readAll(admin, 'prospect_potentials', 'external_project_code'),
    loadTrustProjects({ includeDone: true }),
  ]);
  if (trust.error) throw new ProjectNumberError(`The Trust System couldn't be read to check the project number (${trust.error}) — try again in a moment.`);
  const used = new Set<number>();
  for (const code of [...projects, ...opps, ...pots, ...trust.projects.map(p => p.projectNo)]) {
    const n = Number(projectNumber(code));
    if (Number.isFinite(n) && n > 0) used.add(n);
  }
  return used;
}

/** The first number from `from` on that isn't in `used`. */
export function firstFree(from: number, used: Set<number>): number {
  let n = Math.max(1, Math.trunc(from));
  while (used.has(n)) n++;
  return n;
}

/** The number the next project will get (nothing reserved). */
export async function peekFreeProjectNumber(admin: any): Promise<number> {
  const { data, error } = await admin.rpc('peek_global_number');
  if (error) throw new ProjectNumberError(error.message);
  return firstFree(Number(data) || 1, await usedProjectNumbers(admin));
}

/** Reserves the next free number: takes counter numbers until one isn't in use. */
export async function reserveFreeProjectNumber(admin: any): Promise<number> {
  const used = await usedProjectNumbers(admin);
  for (let tries = 0; tries < 5000; tries++) {
    const { data, error } = await admin.rpc('reserve_global_number');
    if (error) throw new ProjectNumberError(error.message);
    const n = Number(data);
    if (!used.has(n)) return n;
  }
  throw new ProjectNumberError('No free project number found — set a new starting number on the Sales Team page.');
}
