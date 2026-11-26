import Link from 'next/link';
import { allowedPages } from '@/lib/permissions/requirePage';
import { cn } from '@/lib/utils';

// Pages that share one sidebar link (Sales & Marketing → Contacts, Email, Trash) show each other as
// tabs, so they read as one page. Only the tabs this user may open are shown; one tab = no bar.

type Tab = { href: string; label: string; perm: string };

export const SECTION_TABS = {
  contacts: [
    { href: '/marketing/contact-manager', label: 'Search', perm: 'page.marketing_contact_manager' },
    { href: '/marketing/prospects', label: 'Advanced query', perm: 'page.marketing_contacts' },
    { href: '/marketing/import', label: 'Import', perm: 'page.marketing_import' },
  ],
  email: [
    { href: '/marketing/email', label: 'Campaigns', perm: 'page.marketing_email' },
    { href: '/marketing/mail-templates', label: 'Templates', perm: 'page.marketing_mail_templates' },
  ],
  trash: [
    { href: '/leads/trash', label: 'Deals', perm: 'page.leads_trash' },
    { href: '/marketing/prospects/trash', label: 'Contacts', perm: 'page.marketing_trash' },
  ],
} satisfies Record<string, Tab[]>;

export async function SectionTabs({ group, current, className }: { group: keyof typeof SECTION_TABS; current: string; className?: string }) {
  const tabs: Tab[] = SECTION_TABS[group];
  const ok = await allowedPages(tabs.map(t => t.perm));
  const shown = tabs.filter(t => ok.has(t.perm));
  if (shown.length < 2) return null;
  return (
    <nav aria-label="Section pages" className={cn('mb-5 flex gap-1 border-b border-ui-divider font-ui', className)}>
      {shown.map(t => {
        const active = t.href === current;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-[13px] font-semibold no-underline transition-colors',
              active
                ? 'border-secondary-700 text-secondary-700 dark:border-secondary-50 dark:text-secondary-50'
                : 'border-transparent text-ui-body hover:text-secondary-700 dark:hover:text-secondary-50',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
