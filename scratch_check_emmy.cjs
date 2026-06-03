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

async function checkEmmy() {
  console.log("--- Querying Emmy's User Profile ---");
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .ilike('display_name', '%Emmy%');

  if (userError) {
    console.error('Error fetching Emmy profile:', userError);
    return;
  }
  console.log('User profiles matching Emmy:', JSON.stringify(userData, null, 2));

  if (!userData || userData.length === 0) {
    console.log("No Emmy user found.");
    return;
  }

  const emmy = userData[0];

  console.log("\n--- Querying spelling_practices ---");
  const { data: practices, error: practicesError } = await supabase
    .from('spelling_practices')
    .select('*');

  if (practicesError) {
    console.error('Error fetching spelling practices:', practicesError);
  } else {
    console.log(`Found ${practices.length} spelling practices.`);
    const vocabPractices = practices.filter(p => p.title.toLowerCase().includes('vocab') || p.title.toLowerCase().includes('vocabulary'));
    console.log('Vocabulary practices:', JSON.stringify(vocabPractices, null, 2));
  }

  console.log("\n--- Querying practice_assignments for Emmy ---");
  const { data: assignments, error: assignmentsError } = await supabase
    .from('practice_assignments')
    .select('*, spelling_practices(*)')
    .eq('user_id', emmy.id);

  if (assignmentsError) {
    console.error('Error fetching Emmy assignments:', assignmentsError);
  } else {
    console.log('Emmy assignments:', JSON.stringify(assignments, null, 2));
  }

  console.log("\n--- Checking RPC get_student_assignments_unified ---");
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_student_assignments_unified', {
    target_user_id: emmy.id
  });

  if (rpcError) {
    console.error('Error calling get_student_assignments_unified:', rpcError);
  } else {
    console.log('Unified assignments returned for Emmy:', JSON.stringify(rpcData, null, 2));
  }
}

checkEmmy();
