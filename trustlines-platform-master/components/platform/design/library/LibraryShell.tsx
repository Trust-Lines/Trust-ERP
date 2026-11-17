import { PageHeading } from '@/components/platform/shared/PageHeading';

/** Page heading shared by the Design library pages (same layout as the CRM pages). */
export function LibraryHeader({ href, title, subtitle, action }: { href: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <PageHeading
      trail={[{ label: 'Design', href: '/design' }, { label: title, href }]}
      title={title} subtitle={subtitle} actions={action}
      className="items-center" bodyClassName="max-w-[720px]"
    />
  );
}

export function NotReady({ message }: { message: string }) {
  return <div className="rounded-xl border border-warning-normal bg-warning-light px-4 py-2.5 text-xs text-warning-dark dark:bg-warning-dark/45 dark:text-warning-light">{message}</div>;
}
