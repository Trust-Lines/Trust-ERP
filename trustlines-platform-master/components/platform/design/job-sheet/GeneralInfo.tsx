'use client';

import type { SalesDesignJob } from '@/types/database';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { DatePicker } from '@/components/ui/date-picker';
import { formatDate } from '@/lib/formatDate';
import { cn } from '@/lib/utils';
import { DESIGNER_STATUSES, HEADING, JOB_STATUS_LABEL, JOB_STATUS_ORDER } from '../designShared';
import { INPUT_CLS, ReadOnly, cap, parseISODate, toISODate } from './sheetShared';

/**
 * Status / Designer / Priority / Due Date. Managers edit all four; designers move the status
 * through their own steps; Sales sees everything read-only.
 */
export function GeneralInfo({ job, isManager, sales, designers, designerName, overdue, onPatchJob }: {
  job: SalesDesignJob;
  isManager: boolean;
  sales: boolean;
  designers: { id: string; full_name: string }[];
  designerName: string | null;
  overdue: boolean;
  onPatchJob: (patch: Record<string, unknown>, okMessage?: string) => Promise<void>;
}) {
  const statusOptions = (isManager ? [...JOB_STATUS_ORDER] : DESIGNER_STATUSES.includes(job.status) ? DESIGNER_STATUSES : [job.status, ...DESIGNER_STATUSES])
    .map(s => ({ value: s, label: JOB_STATUS_LABEL[s] ?? cap(s) }));

  return (
    <section className="flex flex-col gap-2 rounded-[8px] border border-ui-divider bg-ui-surface px-3.5 pt-3.5 pb-6">
      <h3 className={cn('m-0 text-[16px] font-semibold leading-[1.45]', HEADING)}>General Info</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Field variant="loose" label="Status">
          {sales ? <ReadOnly>{JOB_STATUS_LABEL[job.status] ?? cap(job.status)}</ReadOnly> : (
            <Select aria-label="Job status" className={INPUT_CLS} value={job.status} options={statusOptions}
              onValueChange={v => { if (v && v !== job.status) void onPatchJob({ status: v }, `Moved to ${JOB_STATUS_LABEL[v] ?? cap(v)}`); }} />
          )}
        </Field>
        <Field variant="loose" label="Designer">
          {isManager ? (
            <Select aria-label="Designer" className={INPUT_CLS} value={job.assigned_designer_id ?? ''}
              options={[{ value: '', label: 'Unassigned' }, ...designers.map(d => ({ value: d.id, label: d.full_name }))]}
              onValueChange={v => void onPatchJob({ assigned_designer_id: v || null }, v ? 'Assigned — the designer has been notified' : 'Unassigned')} />
          ) : <ReadOnly>{designerName ?? 'Unassigned'}</ReadOnly>}
        </Field>
        <Field variant="loose" label="Priority">
          {isManager ? (
            <Select aria-label="Priority" className={cn(INPUT_CLS, 'uppercase')} value={job.priority}
              options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }]}
              onValueChange={v => { if (v) void onPatchJob({ priority: v }); }} />
          ) : <ReadOnly className="uppercase">{job.priority}</ReadOnly>}
        </Field>
        <Field variant="loose" label="Due Date">
          {isManager ? (
            <DatePicker aria-label="Due date" placeholder="No due date"
              className={cn(INPUT_CLS, 'w-full flex-row-reverse justify-between border-[var(--color-secondary-700)] dark:border-ui-heading [&_svg]:size-4', overdue && 'text-error-normal dark:text-error-normal')}
              value={parseISODate(job.due_date)} onValueChange={d => void onPatchJob({ due_date: toISODate(d) })} />
          ) : <ReadOnly className={overdue ? 'text-error-normal dark:text-error-normal' : undefined}>{job.due_date ? formatDate(job.due_date) : '—'}</ReadOnly>}
        </Field>
      </div>
    </section>
  );
}
