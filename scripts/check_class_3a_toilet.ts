import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkClass3AToilet() {
  console.log('Checking all Class 3A students for toilet breaks...');
  
  // 1. Get all students in 3A
  const { data: users } = await supabase.from('users').select('id, display_name').eq('class', '3A');
  
  if (!users) return;
  
  const userIds = users.map(u => u.id);
  
  // 2. Count toilet breaks for all of them
  const { data: records } = await supabase
    .from('student_records')
    .select('student_id, message')
    .in('student_id', userIds)
    .eq('message', 'Toilet/Break');
    
  if (!records || records.length === 0) {
    console.log('No students in Class 3A have recorded toilet breaks.');
  } else {
    const counts: Record<string, number> = {};
    records.forEach(r => {
      counts[r.student_id] = (counts[r.student_id] || 0) + 1;
    });
    
    users.forEach(u => {
      if (counts[u.id]) {
        console.log(`- ${u.display_name}: ${counts[u.id]} breaks (${counts[u.id] * 20} coins deducted from toilet balance)`);
      }
    });
  }
}

checkClass3AToilet();
