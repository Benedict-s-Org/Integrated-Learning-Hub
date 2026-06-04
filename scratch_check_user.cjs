const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
let supabaseUrl = '';
let supabaseKey = '';

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (key === 'VITE_SUPABASE_URL') supabaseUrl = val;
      if (key === 'VITE_SUPABASE_ANON_KEY') supabaseKey = val;
    }
  }
} catch (e) {
  console.error("Error reading/parsing .env file:", e.message);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  console.log("--- Querying User benedictcftsang@outlook.com ---");
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('username', 'benedictcftsang@outlook.com');

  if (userError) {
    console.error('Error fetching profile:', userError);
    return;
  }
  console.log('User profiles matching benedictcftsang@outlook.com:', JSON.stringify(userData, null, 2));

  console.log("--- Querying All Users ---");
  const { data: allUsers, error: allUsersError } = await supabase
    .from('users')
    .select('id, username, email, display_name, role, class');

  if (allUsersError) {
    console.error('Error fetching all users:', allUsersError);
    return;
  }
  console.log(`Found ${allUsers.length} total users.`);
}

checkUser();
