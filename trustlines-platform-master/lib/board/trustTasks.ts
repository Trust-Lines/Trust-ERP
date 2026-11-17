import { NextResponse } from 'next/server';

// Dashboard card popup → "Trust Lines Tasks" (migration 153, trust_lines_tasks). A task hangs on an
// anchor: the card's project number ("no-507", so every card of the project shares the list), else
// the card itself ("opportunity-<uuid>").

export const TASK_COLUMNS = 'id, title, status, assignee_id, due_date, created_at';
export const TASK_STATUSES = new Set(['todo', 'in_progress', 'done']);
const ANCHOR = /^(no|opportunity|potential|project|trust)-[A-Za-z0-9-]{1,64}$/;

/** The task list's anchor for a card: its project number, else its kind + id. */
export function taskAnchor(card: { kind: string; id: string; projectNo?: string | null }): string {
  return card.projectNo && /^\d{2,}$/.test(card.projectNo) ? `no-${card.projectNo}` : `${card.kind}-${card.id}`;
}

/** The anchor from the URL, or null when it isn't one. */
export function parseAnchor(raw: string): string | null {
  const a = decodeURIComponent(raw);
  return ANCHOR.test(a) ? a : null;
}

/** "#507" / "the card" for notifications. */
export function anchorLabel(anchor: string): string {
  return anchor.startsWith('no-') ? `#${anchor.slice(3)}` : 'a dashboard card';
}

export function tasksFailed(where: string, error: { code?: string; message: string }) {
  if (error.code === '42P01' || /trust_lines_tasks/.test(error.message)) {
    return NextResponse.json({ error: 'Trust Lines tasks aren’t set up yet (migration 153)' }, { status: 503 });
  }
  console.error(`[trust-tasks] ${where}:`, error.message);
  return NextResponse.json({ error: 'Could not save the task' }, { status: 500 });
}
