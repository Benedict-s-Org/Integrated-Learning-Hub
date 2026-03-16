
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read from .env
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyRobustness() {
  console.log("Starting Global Robustness Verification...");
  
  // 1. Check a valid existing user (e.g., from public.users)
  const { data: users, error: userError } = await supabase.from('users').select('id, username').limit(1);
  if (userError || !users?.length) {
    console.error("No users found to test with.");
    return;
  }
  
  const testUser = users[0];
  console.log(`Testing with user: ${testUser.username} (${testUser.id})`);

  // 2. Check user_room_data
  const { data: roomData, error: roomError } = await supabase.from('user_room_data').select('id').eq('user_id', testUser.id).maybeSingle();
  console.log(`Room Data status: ${roomData ? 'Present' : 'Missing'}`);

  // 3. Check user_avatar_config
  const { data: avatarData, error: avatarError } = await supabase.from('user_avatar_config').select('id').eq('user_id', testUser.id).maybeSingle();
  console.log(`Avatar Data status: ${avatarData ? 'Present' : 'Missing'}`);

  // 4. Invoke the Deep Sync for this user
  console.log("Invoking Deep Sync...");
  const { data: syncData, error: syncError } = await supabase.functions.invoke('user-management/sync-current-user', {
    body: { userId: testUser.id }
  });
  
  if (syncError) {
    console.error("Deep Sync failed:", syncError);
  } else {
    console.log("Deep Sync successful:", syncData);
    
    // 5. Re-verify records
    const { data: finalRoom } = await supabase.from('user_room_data').select('id').eq('user_id', testUser.id).maybeSingle();
    const { data: finalAvatar } = await supabase.from('user_avatar_config').select('id').eq('user_id', testUser.id).maybeSingle();
    console.log(`Final Room Data status: ${finalRoom ? 'Present (REPAIRED/SYNCED)' : 'Missing'}`);
    console.log(`Final Avatar Data status: ${finalAvatar ? 'Present (REPAIRED/SYNCED)' : 'Missing'}`);
  }
}

verifyRobustness();
