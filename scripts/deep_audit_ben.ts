import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BEN_ID = '656c89ec-0c5a-40da-819f-f4fd044916d4';

async function deepAuditBenToilet() {
  console.log(`Deep auditing Ben (${BEN_ID}) for toilet breaks...`);
  
  // 1. user_room_data
  const { data: room } = await supabase.from('user_room_data').select('toilet_coins, coins').eq('user_id', BEN_ID).single();
  console.log(`Current user_room_data: toilet_coins=${room?.toilet_coins}, total_coins=${room?.coins}`);
  
  // 2. student_records (any type, partial match)
  const { data: sr } = await supabase
    .from('student_records')
    .select('message, type, created_at')
    .eq('student_id', BEN_ID)
    .ilike('message', '%toilet%');
  
  console.log(`\nFound ${sr?.length || 0} toilet records in student_records:`);
  sr?.forEach(r => console.log(`- Type: ${r.type}, Msg: ${r.message}, Date: ${r.created_at}`));
  
  // 3. coin_transactions
  const { data: ct } = await supabase
    .from('coin_transactions')
    .select('amount, reason, created_at')
    .eq('user_id', BEN_ID)
    .ilike('reason', '%toilet%');
    
  console.log(`\nFound ${ct?.length || 0} toilet records in coin_transactions:`);
  ct?.forEach(t => console.log(`- Amount: ${t.amount}, Reason: ${t.reason}, Date: ${t.created_at}`));
}

deepAuditBenToilet();
