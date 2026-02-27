import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testFetch() {
  // Login as admin
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'benedictcftsang@gmail.com',
    password: 'AUTH_MANAGED', // Or whatever password you use for testing, if we can't login we'll just check if the user is publicly visible which it shouldn't be
  });

  console.log("Auth attempt:", authError ? authError.message : "Success");

  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, class, managed_by_id')
    .eq('username', 'benedictcftsang@outlook.com');

  console.log('User data:', JSON.stringify(data, null, 2));
  console.log('Error if any:', error);
}

testFetch();
