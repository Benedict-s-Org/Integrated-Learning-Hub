import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDeductions() {
  const students = [
    { name: 'Abby', id: 'a021ca6b-9ec5-492d-bd9d-eace437ae382' },
    { name: 'Ben', id: '656c89ec-0c5a-40da-819f-f4fd044916d4' }
  ];

  for (const s of students) {
    console.log(`\n--- Deductions (Negative Coins) for ${s.name} ---`);
    const { data: records } = await supabase
        .from('student_records')
        .select('coin_amount, message, created_at')
        .eq('student_id', s.id)
        .lt('coin_amount', 0);
    
    if (!records || records.length === 0) {
        console.log('No deductions found.');
    } else {
        records.forEach(r => console.log(`- Amount: ${r.coin_amount}, Msg: ${r.message}, Date: ${r.created_at}`));
    }
  }
}

checkDeductions();
