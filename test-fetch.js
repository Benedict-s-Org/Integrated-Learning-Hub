import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.VITE_SUPABASE_URL) dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkUser() {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, class, managed_by_id')
    .eq('username', 'benedictcftsang@outlook.com')
    .single();

  if (error) console.error('Error fetching user:', error.message);
  else console.log('User found:', JSON.stringify(data, null, 2));
}

checkUser();
