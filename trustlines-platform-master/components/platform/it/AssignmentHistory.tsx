import Link from 'next/link';
import { History, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTicketDate } from './ticketStyles';
import { MUTED, OUTLINE_CHIP, SOLID_CHIP, STRONG } from './itemStyles';

// Assignment history of an IT item or phone line (it_assignments, migration 159): who held it,
// from when to when, and for a line the company phone it ran on. Newest first; the open spell is
// "Current".

export interface AssignmentSpellView {
  id: string;
  personId: string | null;
  personName: string;
  deviceName: string | null;
  startedAt: string;
  endedAt: string | null;
}

const PANEL = 'flex flex-col gap-3 rounded-lg border border-solid border-primary-100 bg-primary-50 px-5 pb-5 pt-4 dark:border-primary-600 dark:bg-primary-700';

export function AssignmentHistory({ spells, showDevice = false }: { spells: AssignmentSpellView[]; showDevice?: boolean }) {
  return (
    <section aria-labelledby="it-assign-history" className={PANEL}>
      <h2 id="it-assign-history" className={cn('m-0 flex items-center gap-2 text-[18px] font-semibold leading-normal', STRONG)}>
        <History className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
        Assignment History
      </h2>
      {spells.length === 0 ? (
        <p className="m-0 text-[13px] text-ui-body">No assignments recorded yet. They are kept from now on, each time it changes hands.</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {spells.map(s => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-solid border-primary-100 bg-white px-3 py-2.5 dark:border-transparent dark:bg-secondary-800">
              <span className="flex min-w-0 flex-1 flex-col">
                {s.personId ? (
                  <Link href={`/it/staff/${s.personId}`} className={cn('truncate text-[14px] font-semibold no-underline hover:underline', STRONG)}>{s.personName}</Link>
                ) : (
                  <span className={cn('truncate text-[14px] font-semibold', STRONG)}>{s.personName}</span>
                )}
                <span className={cn('text-[12px]', MUTED)}>
                  {formatTicketDate(s.startedAt)} → {s.endedAt ? formatTicketDate(s.endedAt) : 'now'}
                </span>
              </span>
              {showDevice && s.deviceName && (
                <span className={cn('inline-flex h-6 items-center gap-1 rounded px-2 text-[12px] font-semibold', OUTLINE_CHIP)}>
                  <Smartphone className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />{s.deviceName}
                </span>
              )}
              {!s.endedAt && <span className={cn('inline-flex h-6 items-center rounded px-2 text-[12px] font-semibold', SOLID_CHIP)}>Current</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
