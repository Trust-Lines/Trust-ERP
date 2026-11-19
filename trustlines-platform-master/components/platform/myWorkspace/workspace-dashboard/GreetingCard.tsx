'use client';

import { CalendarDays } from 'lucide-react';
import { roleLabel } from '@/components/platform/shell/Sidebar';

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });
const LONG_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function GreetingCard({ userName, role, now }: { userName: string; role: string; now: Date }) {
  const greeting = now.getHours() < 12 ? 'Good Morning,' : now.getHours() < 18 ? 'Good Afternoon,' : 'Good Evening,';
  return (
    <section aria-label="Today" className="relative flex min-h-[266px] flex-col justify-between overflow-hidden rounded-[16px] bg-ui-btn-accent p-5 text-white">
      <div aria-hidden className="pointer-events-none absolute -top-16 left-[263px] flex">
        {[1, 2, 3, 4].map((n, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={n} src={`/workspace/greeting-stripe-${n}.svg`} alt="" width={126} height={326}
            className="absolute h-[322px] w-[121px] max-w-none rotate-[17.91deg] skew-x-[2.89deg]" style={{ left: i * 45, top: i * 14.5 }} />
        ))}
      </div>
      <div className="relative flex flex-col gap-2.5">
        <p className="m-0 text-[24px] font-medium leading-[1.35]">{greeting}</p>
        <div>
          <p className="m-0 truncate text-[36px] font-semibold leading-normal">{userName}</p>
          {role && <p className="m-0 text-[16px] font-medium leading-[1.35]">{roleLabel(role)}</p>}
        </div>
      </div>
      <div className="relative flex items-start gap-2.5">
        <CalendarDays className="size-[51px] shrink-0" strokeWidth={1.5} aria-hidden />
        <div>
          <p className="m-0 text-[16px] font-medium leading-[1.35]">{WEEKDAY.format(now)}</p>
          <p className="m-0 text-[24px] font-semibold leading-normal">{LONG_DATE.format(now)}</p>
        </div>
      </div>
    </section>
  );
}
