import { NextResponse } from 'next/server';
import { getRolePermissions } from '@/lib/permissions/server';
import { pageAllowed } from '@/lib/permissions/catalog';
import { seesAllProjects } from '@/lib/permissions/ownProjects';

// Dashboard card popup → "T Lines Tasks" / "Trust Lines Tasks": the project's meeting to-dos
// (trust_lines_tasks, migrations 153-154; `side` tells the two lists apart). A task hangs on an
// anchor: the card's project number ("no-507", so every card of the project shares the list), else
// the card itself ("opportunity-<uuid>").

export const TASK_COLUMNS = 'id, title, status, assignee_id, due_date, created_at, created_by';
export const TASK_STATUSES = new Set(['todo', 'in_progress', 'done']);
export type TaskSide = 'tlines' | 'trust';
const ANCHOR = /^(no|opportunity|potential|project|trust)-[A-Za-z0-9-]{1,64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The anchor from the URL, or null when it isn't one. */
export function parseAnchor(raw: string): string | null {
  const a = decodeURIComponent(raw);
  return ANCHOR.test(a) ? a : null;
}

/** ?side=tlines | trust (default trust); null when it is something else. */
export function parseSide(req: Request): TaskSide | null {
  const s = new URL(req.url).searchParams.get('side') ?? 'trust';
  return s === 'tlines' || s === 'trust' ? s : null;
}

/**
 * 'assign' — add tasks for anyone, reassign, rename, delete: dashboard managers, roles with
 * edit.board_tasks (Roles page), or a person marked Coordinator (profiles.sees_all_projects).
 * 'self'   — everyone else on the dashboard: add tasks for themselves, edit / delete those, and
 * tick a task assigned to them.
 */
export type TaskAccess = 'assign' | 'self';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function boardTaskAccess(admin: any, userId: string, role: string, canManage: boolean): Promise<TaskAccess> {
  if (canManage) return 'assign';
  if (pageAllowed(role, await getRolePermissions(admin, role), 'edit.board_tasks')) return 'assign';
  return (await seesAllProjects(userId)) ? 'assign' : 'self';
}

/** A task someone wrote for themselves — they may change or delete it without 'assign'. */
export const ownSelfTask = (t: { created_by?: string | null; assignee_id: string | null }, userId: string) =>
  t.created_by === userId && t.assignee_id === userId;

export const sideLabel = (side: TaskSide) => (side === 'tlines' ? 'T Lines' : 'Trust Lines');

/** "#507" / "a dashboard card" for notifications. */
export function anchorLabel(anchor: string): string {
  return anchor.startsWith('no-') ? `#${anchor.slice(3)}` : 'a dashboard card';
}

/** A yyyy-mm-dd date, else null. */
export const cleanDate = (v: unknown) => (typeof v === 'string' && DATE.test(v) ? v : null);

/** The id of an active profile, else null; `bad` when one was given but isn't valid. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cleanAssignee(admin: any, v: unknown): Promise<string | null | 'bad'> {
  const id = typeof v === 'string' && v ? v : null;
  if (!id) return null;
  const { data } = await admin.from('profiles').select('id').eq('id', id).eq('is_active', true).maybeSingle();
  return data ? id : 'bad';
}

export function tasksFailed(where: string, error: { code?: string; message: string }) {
  if (error.code === '42P01' || /trust_lines_tasks/.test(error.message)) {
    return NextResponse.json({ error: 'Task lists aren’t set up yet (migrations 153 and 154)' }, { status: 503 });
  }
  if (error.code === '42703' || /\bside\b/.test(error.message)) {
    return NextResponse.json({ error: 'Task lists need migration 154' }, { status: 503 });
  }
  console.error(`[board-tasks] ${where}:`, error.message);
  return NextResponse.json({ error: 'Could not save the task' }, { status: 500 });
}
