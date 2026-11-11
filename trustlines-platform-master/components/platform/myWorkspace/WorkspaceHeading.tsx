import type { ReactNode } from 'react';
import { PageHeading } from '@/components/platform/marketing/pr/shared';

/** Page heading of a My Workspace page: "My Workspace / <title>" crumbs, title, subtitle, actions. */
export function WorkspaceHeading({ title, href, subtitle, actions }: { title: string; href: string; subtitle: ReactNode; actions?: ReactNode }) {
  const trail = href === '/workspace'
    ? [{ label: 'My Workspace', href: '/workspace' }]
    : [{ label: 'My Workspace', href: '/workspace' }, { label: title, href }];
  return <PageHeading trail={trail} title={title} subtitle={subtitle} actions={actions} />;
}
