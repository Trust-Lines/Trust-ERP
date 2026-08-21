import { NextResponse } from 'next/server';
import { createClient, requireUser } from '@/lib/supabase/server';

export async function GET() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('generate_project_code' as never);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ code: data as string });
}
