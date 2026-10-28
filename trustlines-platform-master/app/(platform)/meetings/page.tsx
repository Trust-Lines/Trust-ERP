import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MyMeetingsClient } from '@/components/platform/meetings/MyMeetingsClient';

export const dynamic = 'force-dynamic';

// Personal page: everyone sees only their own Google Calendar, so any signed-in person may open it.
export default async function MyMeetingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return (
    <div className="main-inner">
      <MyMeetingsClient />
    </div>
  );
}
