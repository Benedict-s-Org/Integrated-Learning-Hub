
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

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  console.log("Checking Supabase connection...");
  
  const { data: users, error: userError, count } = await supabase
    .from('users')
    .select('id, username, role, class', { count: 'exact' });
    
  if (userError) {
    console.error("Error fetching users:", userError);
  } else {
    console.log("Total users:", count);
    console.log("Admins:", users.filter(u => u.role === 'admin').map(u => u.username));
    console.log("Staff:", users.filter(u => u.role === 'class_staff').map(u => u.username));
    console.log("Sample Students:", users.filter(u => u.role === 'user').slice(0, 5).map(u => u.username));
  }

  const { data: classes, error: classError } = await supabase.from('classes').select('*');
  console.log("Classes in DB:", classes?.length || 0, classError || "");

  const { data: assignments, error: assignError } = await supabase.from('class_staff_assignments').select('*');
  console.log("Staff Assignments:", assignments?.length || 0, assignError || "");

  // Test one specific staff member if exists
  const staffMember = users?.find(u => u.role === 'class_staff');
  if (staffMember) {
    console.log("Checking assignments for staff:", staffMember.username);
    const staffAsgn = assignments?.filter(a => a.staff_user_id === staffMember.id);
    console.log("Assignments:", staffAsgn);
  }
}

debug();
