import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllAuth() {
  const { data: adminUsers, error: adminError } = await supabase.auth.admin.listUsers();
  
  if (adminError) {
    console.error('Error fetching auth users:', adminError);
  } else {
    console.log('ALL Users in auth.users:');
    adminUsers.users.forEach(u => console.log(`- ${u.email} (ID: ${u.id})`));
  }
}

checkAllAuth();
