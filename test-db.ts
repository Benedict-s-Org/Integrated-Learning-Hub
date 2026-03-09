import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data, error } = await supabase
    .from('system_config')
    .select('*')
    .eq('key', 'broadcast_v2_settings');
  console.log('Docs:', JSON.stringify(data, null, 2));
  if (error) console.error('Error:', error);
}
run();
