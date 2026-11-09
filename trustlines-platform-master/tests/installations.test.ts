import { describe, it, expect } from 'vitest';
import {
  alertOf, suggestedStatus, installersOf, headcount, doubleBookings, dashboardStats, durationDays,
  monthRows, weekStarts, statusNeedsUpdate, type Installation,
} from '@/lib/installations/compute';

const TODAY = '2026-11-09';
let n = 0;
const row = (p: Partial<Installation>): Installation => ({
  id: `r${++n}`, project_no: null, project_name: null, branch: null, city_state: null, planned_start: null,
  planned_finish: null, team: null, team_size: null, scope: null, pm_name: null, confidence: null, status: null,
  blockers: null, notes: null, sort_order: n, updated_at: '', ...p,
});

describe('installation plan — the workbook formulas', () => {
  it('alerts like the Alert (auto) column', () => {
    expect(alertOf(row({ planned_start: '2026-11-10', planned_finish: '2026-11-30', status: 'Not Started' }), TODAY)?.text).toBe('Starts in 1 day');
    expect(alertOf(row({ planned_start: '2026-11-16', planned_finish: '2026-12-15' }), TODAY)?.text).toBe('Starts in 7 days');
    expect(alertOf(row({ planned_start: '2026-08-10', planned_finish: '2026-11-05', status: 'In Progress' }), TODAY)?.text).toBe('Overdue - past finish date');
    expect(alertOf(row({ planned_start: '2026-11-01' }), TODAY)?.text).toBe('Missing finish date');
    expect(alertOf(row({ planned_start: '2026-11-01', planned_finish: '2026-12-01', status: 'Not Started' }), TODAY)?.text).toBe('Should have started');
    expect(alertOf(row({ planned_start: '2026-10-28', planned_finish: '2026-11-02', status: 'Completed' }), TODAY)).toBeNull();
    expect(alertOf(row({ planned_start: '2027-03-10', planned_finish: '2027-04-20' }), TODAY)).toBeNull();
  });

  it('suggests a status from the dates', () => {
    expect(suggestedStatus(row({ planned_start: '2026-08-10', planned_finish: '2026-11-05', status: 'In Progress' }), TODAY)).toBe('Delayed');
    expect(suggestedStatus(row({ planned_start: '2026-10-26', planned_finish: '2026-11-30' }), TODAY)).toBe('In Progress');
    expect(suggestedStatus(row({ planned_start: '2027-01-01', planned_finish: '2027-01-30' }), TODAY)).toBe('Not Started');
    expect(suggestedStatus(row({ status: 'Completed', planned_start: '2026-10-28' }), TODAY)).toBe('Completed');
    expect(statusNeedsUpdate(row({ planned_start: '2027-01-01', planned_finish: '2027-01-30' }), TODAY)).toBe(true);
    expect(statusNeedsUpdate(row({ planned_start: '2027-01-01', planned_finish: '2027-01-30', status: 'Not Started' }), TODAY)).toBe(false);
  });

  it('reads installers and head count from the team', () => {
    expect(installersOf('TEAM B( Terrence, Robert,Ronnie, Chris) ')).toEqual(['terrence', 'robert', 'ronnie', 'chris']);
    expect(installersOf('TEAM EXPRESS EM')).toEqual(['team express em']);
    expect(installersOf('TBD')).toEqual([]);
    expect(headcount({ team: 'TEAM A (ANAS,IMAD,HIS SON)', team_size: 9 })).toBe(3);
    expect(headcount({ team: 'TEAM EXPRESS EM', team_size: 7 })).toBe(7);
    expect(durationDays({ planned_start: '2026-11-10', planned_finish: '2026-11-30' })).toBe(21);
  });

  it('finds the same installer on two overlapping active jobs', () => {
    const a = row({ project_no: '#12PG', team: 'TEAM B (Terrence, Robert)', planned_start: '2026-11-16', planned_finish: '2027-01-25' });
    const b = row({ project_no: '#460', team: 'TEAM B (Robert, Chris)', planned_start: '2026-11-16', planned_finish: '2026-12-20' });
    const c = row({ project_no: '#341', team: 'TEAM B (Robert)', planned_start: '2027-02-01', planned_finish: '2027-02-20' });
    const d = row({ project_no: '#516', team: 'TEAM B (Robert)', planned_start: '2026-11-01', planned_finish: '2026-12-01', status: 'Completed' });
    const clashes = doubleBookings([a, b, c, d]);
    expect(clashes.get(a.id)?.map(x => x.projectNo)).toEqual(['#460']);
    expect(clashes.get(a.id)?.[0].people).toEqual(['robert']);
    expect(clashes.has(c.id)).toBe(false);
    expect(clashes.has(d.id)).toBe(false);
  });

  it('builds the dashboard numbers and months', () => {
    const rows = [
      row({ planned_start: '2026-11-10', planned_finish: '2026-11-30', team: 'X', team_size: 6, branch: 'NW', status: 'Not Started' }),
      row({ planned_start: '2026-08-10', planned_finish: '2026-11-05', team: 'Y (a, b)', branch: 'SE', status: 'In Progress' }),
      row({ planned_start: '2026-10-28', planned_finish: '2026-11-02', status: 'Completed', branch: 'NE' }),
      row({ planned_start: '2026-12-01', planned_finish: '2027-01-01', team_size: 1, branch: 'NE', confidence: 'Tentative' }),
    ];
    const s = dashboardStats(rows, TODAY);
    expect(s.active).toBe(3);
    expect(s.starting14).toBe(1);
    expect(s.overdue).toBe(1);
    expect(s.installingNow).toBe(0);
    expect(s.installersBooked14).toBe(6);
    const [nov, dec] = monthRows(rows, ['2026-11', '2026-12']);
    expect(nov.starting).toBe(1);
    expect(nov.byBranch.NW).toBe(6);
    expect(dec.tentative).toBe(1);
    expect(weekStarts('2026-11-01', '2026-11-20')).toEqual(['2026-11-01', '2026-11-08', '2026-11-15']);
  });
});
