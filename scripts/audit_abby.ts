import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ABBY_ID = 'a021ca6b-9ec5-492d-bd9d-eace437ae382';

async function auditAbby() {
  console.log(`Auditing Abby (${ABBY_ID})...`);
  
  // 1. Current balance
  const { data: room, error: roomError } = await supabase
    .from('user_room_data')
    .select('coins')
    .eq('user_id', ABBY_ID)
    .single();
    
  console.log(`Current coins in user_room_data: ${room?.coins}`);
  
  // 2. Sum of student_records
  const { data: records, error: recordError } = await supabase
    .from('student_records')
    .select('coin_amount, is_reverted')
    .eq('student_id', ABBY_ID);
    
  const totalFromRecords = records?.reduce((sum, r) => sum + (r.is_reverted ? 0 : r.coin_amount), 0);
  console.log(`Total coins from non-reverted student_records: ${totalFromRecords}`);
  
  if (room?.coins !== totalFromRecords) {
    console.log(`DISCREPANCY FOUND: ${room?.coins} != ${totalFromRecords}`);
  } else {
    console.log(`Balances match records. If there's a discrepancy, records themselves are missing.`);
  }
}

auditAbby();
