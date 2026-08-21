import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: 'c:/Users/Trust/Desktop/Trust/trustlines-platform/.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase.from('opportunities')
  .select('id, project_id, scope_types, return_reason').limit(1);
console.log('error:', error?.message ?? null);
console.log('data:', data);
