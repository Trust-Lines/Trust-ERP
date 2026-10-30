import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { roleCan } from '@/lib/permissions/server';
import { ProductionClient } from '@/components/platform/production/ProductionClient';
import { TrustProjectsBoard } from '@/components/platform/production/TrustProjectsBoard';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const TAB = 'inline-flex h-9 items-center rounded-[6px] border px-5 text-[13px] font-medium no-underline transition-colors';

// Operations / Production: the Trust System Projects board (live Trust System data through
// /api/trust) and T-ERP's own production tracker.
export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requirePage('page.production');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { view } = await searchParams;
  const tracker = view === 'tracker';
  const classic = view === 'classic';

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canEdit = await roleCan(createAdminClient() as any, role, 'edit.production');

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4 px-7 pt-7">
        <div className="flex flex-col gap-[5px] leading-[1.35]">
          <p className="m-0 text-[11px] font-semibold text-ui-nav-active">Operations / Production</p>
          <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Production</h1>
          <p className="m-0 text-[13px] text-ui-body">
            {tracker ? 'Production statuses tracked in T-ERP.' : classic ? 'The Trust System board as it looks there — every action is available.' : 'Trust System projects, live — changes here show up there and the other way round.'}
          </p>
        </div>
        <nav aria-label="Production views" className="flex gap-2">
          {([['Projects board', '/production', !tracker && !classic], ['Classic board', '/production?view=classic', classic], ['Production tracker', '/production?view=tracker', tracker]] as [string, string, boolean][]).map(([label, href, on]) => (
            <Link key={href} href={href} aria-current={on ? 'page' : undefined}
              className={cn(TAB, on
                ? 'border-[var(--color-secondary-700)] text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading'
                : 'border-ui-divider bg-ui-surface-elevated text-ui-body hover:bg-ui-hover-bg')}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {tracker ? <ProductionClient canEdit={canEdit} /> : <div className="px-7 pb-7"><TrustProjectsBoard classic={classic} canEdit={canEdit} /></div>}
    </div>
  );
}
