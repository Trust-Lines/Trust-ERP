import { cn } from '@/lib/utils';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { HEADING } from '../designShared';

/** Page heading shared by the Design library pages (same layout as the CRM pages). */
export function LibraryHeader({ href, title, subtitle, action }: { href: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex max-w-[720px] flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'Design', href: '/design' }, { label: title, href }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>{title}</h1>
        <p className="m-0 text-[13px] text-ui-body">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function NotReady({ message }: { message: string }) {
  return <div className="rounded-xl border border-warning-normal bg-warning-light px-4 py-2.5 text-xs text-warning-dark dark:bg-warning-dark/45 dark:text-warning-light">{message}</div>;
}
