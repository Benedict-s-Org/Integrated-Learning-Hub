import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function calculateIdeal() {
  const students = [
    { name: 'Abby', id: 'a021ca6b-9ec5-492d-bd9d-eace437ae382' },
    { name: 'Ben', id: '656c89ec-0c5a-40da-819f-f4fd044916d4' }
  ];

  for (const s of students) {
    console.log(`\n--- Calculating Ideal Balance for ${s.name} ---`);
    
    // 1. Current balance
    const { data: room } = await supabase.from('user_room_data').select('coins').eq('user_id', s.id).single();
    
    // 2. Sum of student_records
    const { data: records } = await supabase.from('student_records').select('coin_amount, message').eq('student_id', s.id).eq('is_reverted', false);
    const manualSum = records?.reduce((sum, r) => sum + r.coin_amount, 0) || 0;
    
    // 3. Automated rewards potential
    const { count: spellingCount } = await supabase.from('spelling_practice_results').select('*', { count: 'exact', head: true }).eq('user_id', s.id);
    const { count: proofreadingCount } = await supabase.from('proofreading_practice_results').select('*', { count: 'exact', head: true }).eq('user_id', s.id);
    const { count: memorizationCount } = await supabase.from('memorization_practice_sessions').select('*', { count: 'exact', head: true }).eq('user_id', s.id);
    
    const automatedPotential = 
        (spellingCount || 0) * 5 + 
        (proofreadingCount || 0) * 5 + 
        (memorizationCount || 0) * 5;
    
    console.log(`Current Balance: ${room?.coins || 0}`);
    console.log(`Total from Audited Records: ${manualSum}`);
    console.log(`Potential from Practices (Spelling/Proof/Memo): ${automatedPotential}`);
    console.log(`IDEAL TOTAL (Sum of all): ${manualSum + automatedPotential}`);
    
    if (manualSum < (manualSum + automatedPotential)) {
       console.log(`Discrepancy: Missing ~${automatedPotential} coins from unlogged practices.`);
    }
  }
}

calculateIdeal();
