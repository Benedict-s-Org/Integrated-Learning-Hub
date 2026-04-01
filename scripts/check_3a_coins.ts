import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkClasses() {
  console.log('Checking all class names...');
  const { data: users, error } = await supabase
    .from('users')
    .select('class')
    .not('class', 'is', null);
    
  if (error) {
    console.error('Error fetching classes:', error);
    return;
  }
  
  const classes = [...new Set(users.map(u => u.class))];
  console.log('Class names found in DB:', classes);
}

checkClasses();
