import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ApprovalsPageClient } from '@/components/platform/approvals/ApprovalsPageClient';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <ApprovalsPageClient />;
}
