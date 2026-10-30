// `/sales-tasks?filter=…` presets (the Sales dashboard links here). Kept out of TasksClient.tsx:
// a server page importing a value from a 'use client' module gets a client reference, not the array.
export const TASK_QUICK_FILTERS = ['overdue', 'today', 'unassigned', 'mine'] as const;
export type TaskQuickFilter = typeof TASK_QUICK_FILTERS[number];
